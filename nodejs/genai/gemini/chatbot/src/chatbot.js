const RateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs').promises;
const logger = require('./logger');
const morganMiddleware = require('./morganmw');
const path = require('path');
const session = require('express-session');
const util = require('util');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getAvailableFunctions, getFunctionDefinitionsForTool, loadIntegrations } = require('./functions');
const { getConfig, loadProperties } = require('./properties');

dotenv.config();

const app = express();

// Rate limiting (as before)
const limiter = RateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.sessionID, // Use session ID for rate limiting
});
app.use(limiter);

const ai = new GoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Stores the conversation history and context for each client session.
 * The key is the client's session ID.
 * @type {Map<string, { context: string, chat: import('@google/generative-ai').ChatSession | null, history: Array<import('@google/generative-ai').Part[]> }>}
 */
const sessions = new Map();

const MemcachedStore = require('connect-memcached')(session);

app.use(session({
    secret: process.env.GOOGLE_API_KEY,
    resave: false,
    saveUninitialized: true,
    store: new MemcachedStore({
        hosts: ['127.0.0.1:11211']
    })
}));

app.use(bodyParser.json());
app.use(morganMiddleware);

/**
 * Normalizes a string to create a consistent key.
 * @param {string} keyString The string to normalize.
 * @returns {string} The normalized key.
 */
const getKey = (keyString) => keyString.replace(/\W+/g, '').toUpperCase();

/**
 * Adds a query and its response to a specific session's message cache.
 * Limits the cache size per session.
 * @param {string} sessionId The ID of the client session.
 * @param {string} query The user's query.
 * @param {string} response The chatbot's response.
 * @returns {boolean} True if the response was added to the cache.
 */
const addResponse = (sessionId, query, response) => {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { context: '', chat: null, history: [], messageCache: new Map() });
    }
    const session = sessions.get(sessionId);
    const cache = session.messageCache;
    const keyStr = getKey(query);
    if (cache.has(keyStr)) return true;
    if (cache.size > 1000) {
        Array.from(cache.keys()).slice(0, 100).forEach((key) => cache.delete(key));
    }
    cache.set(keyStr, response);
    return true;
};

/**
 * Retrieves a cached response for a given query within a specific session.
 * @param {string} sessionId The ID of the client session.
 * @param {string} query The user's query.
 * @returns {string} The cached response, or an empty string if not found.
 */
const getResponse = (sessionId, query) => {
    const session = sessions.get(sessionId);
    return session?.messageCache?.get(getKey(query)) || '';
};

/**
 * Reads the context from a file.
 * @async
 * @param {string} contextStr The name of the context file.
 * @returns {Promise<string>} The content of the context file.
 */
const readContext = async (contextStr) => {
    try {
        const contextPath = path.resolve('contexts', contextStr);
        const normalizedContextPath = path.normalize(contextPath);
        const normalizedContextsPath = path.normalize(path.resolve('contexts'));
        if (!normalizedContextPath.startsWith(normalizedContextsPath)) {
            throw new Error('Invalid context path');
        }
        return await fs.readFile(contextPath, 'utf-8');
    } catch (err) {
        logger.error(`Cannot load context '${contextStr}'`, err);
        return '';
    }
};

/**
 * Calls a function by its name with provided arguments.
 * @async
 * @param {string} name The name of the function.
 * @param {object} args The arguments for the function.
 * @returns {Promise<any>} The result of the function call.
 */
const callFunctionByName = async (name, args) => {
    const functionInfo = getAvailableFunctions()[name];
    if (functionInfo && functionInfo.func) {
        const { func, params } = functionInfo;
        const argValues = params.map((paramName) => args[paramName]);
        try {
            const result = await func.apply(null, argValues);
            logger.info(`Function '${name}' executed`, { arguments: args, result });
            return result;
        } catch (error) {
            logger.error(`Error executing function '${name}'`, { arguments: args, error: error.message });
            return { error: 'Function execution failed', details: error.message };
        }
    }
    return { error: `Function '${name}' not found` };
};

/**
 * Handles a function call from the Gemini API.
 * @async
 * @param {object} functionCall The function call details.
 * @returns {Promise<any>} The result of the function call.
 */
const handleFunctionCall = async (functionCall) => {
    const { name, args } = functionCall;
    return await callFunctionByName(name, args);
};

/**
 * Gets or creates a chat session for a given client, initializing with history.
 * @param {string} sessionId The ID of the client session.
 * @returns {import('@google/generative-ai').ChatSession} The chat session.
 */
const getChatSession = (sessionId) => {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { context: '', chat: null, history: [], messageCache: new Map() });
    }
    const session = sessions.get(sessionId);
    if (!session.chat) {
        const model = ai.generativeModel({ model: getConfig().aiModel });
        session.chat = model.startChat({
            history: session.history, // Initialize with stored history
            generationConfig: {
                maxOutputTokens: Number(getConfig().maxTokens),
                temperature: Number(getConfig().temperature),
                topP: Number(getConfig().top_p),
            },
        });
    }
    return session.chat;
};

/**
 * Gets a chat response from the Gemini API, maintaining state per session.
 * @async
 * @param {string} sessionId The ID of the client session.
 * @param {string} userInput The user's message.
 * @param {boolean} [forceJson=false] Whether to request a JSON response.
 * @returns {Promise<string|object>} The chatbot's response.
 */
const getChatResponse = async (sessionId, userInput, forceJson = false) => {
    await loadIntegrations(sessionId);
    const tools = getFunctionDefinitionsForTool();
    let session = sessions.get(sessionId); // Retrieve the session

    // Initialize the session if it doesn't exist
    if (!session) {
        session = { context: '', chat: null, history: [], messageCache: new Map() };
        sessions.set(sessionId, session); // Set the newly created session
    }

    // Handle special commands per session
    if (userInput.includes('help')) return 'Sample *Help* text';
    if (userInput.includes('bot-echo-string')) {
        return userInput || 'No string to echo';
    }
    if (userInput.includes('bot-context')) {
        const botCmd = userInput.split(' ');
        switch (botCmd[1]) {
            case 'load':
                session.context = await readContext(botCmd[2].trim()); // Now session is guaranteed to be defined
                return session.context ? 'Context loaded for this session' : 'Context file could not be read or is empty';
            case 'show':
                return session.context || 'Context is empty for this session';
            case 'reset':
                session.context = '';
                session.chat = null; // Ensure a new chat session is created on reset
                session.history = []; // Clear history
                session.messageCache = new Map(); // Clear cache
                loadProperties('resources/app.properties'); // Reload properties if needed
                return 'Context and chat history reset for this session';
            default:
                return 'Invalid command';
        }
    }

    if (!session.context) return 'Error: Context is not set for this session. Please load one.';

    const cachedResponse = getResponse(sessionId, userInput);
    if (cachedResponse) return cachedResponse;

    try {
        const chat = getChatSession(sessionId);
        let prompt = `${session.context}\n${userInput}`;
        if (forceJson) {
            prompt += '\nYour response must be in JSON format.';
        }

        const functionDefs = tools.map((tool) => tool.function);
        const toolConfig = tools.length > 0 ? { tools: [{ functionDeclarations: functionDefs }] } : {};

        let finalResponse = null;
        let functionCallResult = null;
        let numFunctionCalls = 0;
        const maxFunctionCalls = 5;
        let currentTurnParts = [{ text: prompt }];

        while (!finalResponse && numFunctionCalls < maxFunctionCalls) {
            const result = await chat.sendMessage({
                parts: currentTurnParts,
                ...toolConfig,
            });
            const response = await result.response;

            if (response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const part = candidate.content.parts[0];
                    session.history.push(currentTurnParts); // Store user's turn

                    if (part.functionCall) {
                        numFunctionCalls++;
                        const functionName = part.functionCall.name;
                        const functionArgs = part.functionCall.args;
                        logger.info(`Tool call initiated [Session: ${sessionId}], ${functionName} => ${JSON.stringify(functionArgs)}`);
                        functionCallResult = await handleFunctionCall(part.functionCall);
                        logger.info(`Tool call result [Session: ${sessionId}], ${functionName} => ${util.inspect(functionCallResult)}`);

                        const functionResponsePart = {
                            functionResponse: {
                                name: functionName,
                                response: { functionCallResult },
                            },
                        };
                        session.history.push([functionResponsePart]); // Store function response turn
                        await chat.sendMessage({ parts: [functionResponsePart] });
                    } else if (part.text) {
                        finalResponse = part.text;
                        session.history.push([{ text: finalResponse }]); // Store bot's final response
                    }
                }
            } else {
                logger.warn(`Gemini API: No candidates in response [Session: ${sessionId}]`);
                break;
            }

            if (numFunctionCalls >= maxFunctionCalls && !finalResponse) {
                finalResponse = 'Error: Maximum function call limit reached without a final response.';
            }
            currentTurnParts = []; // Clear for the next potential turn in the loop
        }

        if (!finalResponse && functionCallResult !== null && typeof functionCallResult !== 'object' && !functionCallResult.error) {
            finalResponse = functionCallResult;
            session.history.push([{ text: finalResponse }]);
        } else if (!finalResponse && functionCallResult && functionCallResult.error) {
            finalResponse = `Function call failed: ${functionCallResult.error} - ${functionCallResult.details || ''}`;
            session.history.push([{ text: finalResponse }]);
        }

        if (!finalResponse) {
            throw Error('Not able to get a final response from Gemini.');
        }

        addResponse(sessionId, userInput, finalResponse);
        return finalResponse;

    } catch (err) {
        logger.error(`Gemini API error [Session: ${sessionId}]:`, err);
        return `Error processing request - ${err}`;
    }
};

/**
 * Handles incoming chat requests.
 * @async
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {Promise<void>}
 */
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const sessionId = req.sessionID;
    logger.info(`Chat request received [Session: ${sessionId}]`, { message: userMessage });
    const resp = await getChatResponse(sessionId, userMessage);
    res.json({ response: (resp) || 'Error: no response was detected' });
});

/**
 * Serves the index.html file for the root path.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/indexBot.html')));

/**
 * Returns the current version of the chatbot.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/version', (req, res) => res.json({ version: '1.0' }));

/**
 * Returns the current status of the chatbot.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/status', (req, res) => res.json({ status: 'live' }));

process.on('SIGINT', () => process.exit(0));
process.on('SIGILL', () => process.exit(1));
process.on('SIGSEG', () => process.exit(1));
process.on('SIGBUS', () => process.exit(1));

const startServer = () => {
    if (loadProperties('resources/app.properties')) {
        const port = Number(getConfig().port) || 5000;
        app.listen(port, '0.0.0.0', () => logger.info(`Listening on port ${port}`));
    } else {
        process.exit(1);
    }
};

startServer();