const RateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const util = require('util');
/* eslint-disable no-unused-vars */
const { GoogleGenerativeAI, ChatSession, Part } = require('@google/genai'); // Import necessary types
/* eslint-enable no-unused-vars */

const MemcachedStore = require('connect-memcached')(session);
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

// Updated initialization for @google/genai
const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Stores the conversation history and context for each client session.
 * The key is the client's session ID.
 * @type {Map<string, { context: string, chat: ChatSession | null, history: Part[][], messageCache: Map<string, string> }>}
 */
const sessions = new Map();

const morganMiddleware = require('./morganmw');
const logger = require('./logger');

app.use(session({
  secret: process.env.GOOGLE_API_KEY, // Should use a separate, strong secret
  resave: false,
  saveUninitialized: true,
  store: new MemcachedStore({
    hosts: ['127.0.0.1:11211'],
  }),
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
    sessions.set(sessionId, {
      context: '', chat: null, history: [], messageCache: new Map(),
    });
  }
  const xsession = sessions.get(sessionId);
  const cache = xsession.messageCache;
  const keyStr = getKey(query);
  if (cache.has(keyStr)) return true; // Avoid adding duplicates
  if (cache.size > 1000) { // Simple cache eviction
    // Evict oldest 100 items
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
  const xsession = sessions.get(sessionId);
  if (xsession && xsession.messageCache) {
    return xsession.messageCache.get(getKey(query)) || ''; // Return empty string if not found
  }
  return '';
};

/**
 * Reads the context from a file.
 * @async
 * @param {string} contextStr The name of the context file.
 * @returns {Promise<string>} The content of the context file.
 */
const readContext = async (contextStr) => {
  try {
    // Basic path sanitation
    if (contextStr.includes('..') || contextStr.startsWith('/')) {
        throw new Error('Invalid characters in context path');
    }
    const contextPath = path.resolve('contexts', contextStr);
    const normalizedContextPath = path.normalize(contextPath);
    const normalizedContextsPath = path.normalize(path.resolve('contexts'));

    // Ensure the resolved path is within the contexts directory
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
    // Ensure arguments match expected parameters
    const argValues = params.map((paramName) => args[paramName]);
    try {
      /* eslint-disable prefer-spread */
      const result = await func.apply(null, argValues);
      /* eslint-enable prefer-spread */
      logger.info(`Function '${name}' executed`, { arguments: args, result });
      return result;
    } catch (error) {
      logger.error(`Error executing function '${name}'`, { arguments: args, error: error.message });
      // Return a structured error object for the model
      return { error: 'Function execution failed', details: error.message };
    }
  }
  // Return a structured error object for the model
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
   // Using await here is fine and necessary
   return await callFunctionByName(name, args);
};

/**
 * Gets or creates a chat session for a given client, initializing with history and tools.
 * @param {string} sessionId The ID of the client session.
 * @param {Tool[]} tools An array of tool definitions.
 * @returns {ChatSession} The chat session.
 */
const getChatSession = (sessionId, tools) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { context: '', chat: null, history: [], messageCache: new Map() });
  }
  const xsession = sessions.get(sessionId);

  if (!xsession.chat) {
    // Updated: Use ai.getGenerativeModel and pass tools and history to startChat
    const model = ai.getGenerativeModel({
      model: getConfig().aiModel,
      generationConfig: {
        maxOutputTokens: Number(getConfig().maxTokens),
        temperature: Number(getConfig().temperature),
        topP: Number(getConfig().top_p),
      },
      tools: tools && tools.length > 0 ? tools : undefined, // Pass tools here
    });

    xsession.chat = model.startChat({
      history: xsession.history, // Initialize with stored history
    });
    logger.info(`New chat session created [Session: ${sessionId}]`);
  } else {
     // If session exists, update tools if necessary (though startChat is better for initial tools)
     // For dynamic tool updates mid-session, you'd need to re-create the model or manage tools differently.
     // Keeping tools in startChat simplifies this example.
  }

  return xsession.chat;
};

/**
 * Gets a chat response from the Gemini API, maintaining state per session.
 * Handles special commands, context, caching, and function calling.
 * @async
 * @param {string} sessionId The ID of the client session.
 * @param {string} userInput The user's message.
 * @param {boolean} [forceJson=false] Whether to request a JSON response.
 * @returns {Promise<string|object>} The chatbot's response.
 */
const getChatResponse = async (sessionId, userInput, forceJson = false) => {
  // Ensure integrations (and thus available functions) are loaded
  await loadIntegrations(sessionId);

  // Get function definitions formatted for the API
  const functionDefinitions = getFunctionDefinitionsForTool();
  const tools = functionDefinitions.length > 0 ? [{
      functionDeclarations: functionDefinitions,
  }] : [];

  let xsession = sessions.get(sessionId); // Retrieve the session

  // Initialize the session if it doesn't exist
  if (!xsession) {
    xsession = {
      context: '', chat: null, history: [], messageCache: new Map(),
    };
    sessions.set(sessionId, xsession); // Set the newly created session
    logger.info(`Initializing new session [Session: ${sessionId}]`);
  }

  // Handle special commands per session before interacting with the model
  const lowerInput = userInput.toLowerCase().trim();
  if (lowerInput === 'help') return 'Sample *Help* text';
  if (lowerInput.startsWith('bot-echo-string')) {
    return userInput.substring('bot-echo-string'.length).trim() || 'No string to echo';
  }
  if (lowerInput.startsWith('bot-context')) {
    const parts = lowerInput.split(' ').map(p => p.trim()).filter(p => p);
    const command = parts[1];
    const arg = parts.slice(2).join(' ');

    switch (command) {
      case 'load':
        if (!arg) return 'Usage: bot-context load <context_file_name>';
        xsession.context = await readContext(arg);
        // On context change, reset chat and history to apply the new context effectively
        xsession.chat = null;
        xsession.history = [];
        xsession.messageCache = new Map(); // Clear cache as context changed
        return xsession.context ? `Context '${arg}' loaded and session reset` : `Context file '${arg}' could not be read or is empty`;
      case 'show':
        return xsession.context || 'Context is empty for this session';
      case 'reset':
        xsession.context = '';
        xsession.chat = null; // Ensure a new chat session is created
        xsession.history = []; // Clear history
        xsession.messageCache = new Map(); // Clear cache
        // Consider reloading properties if 'reset' should revert config changes
        // loadProperties('resources/app.properties'); // Optional: uncomment if needed
        return 'Context, chat history, and cache reset for this session';
      default:
        return 'Invalid bot-context command. Use: load <file>, show, reset';
    }
  }

  // If context is required and not set, inform the user
  if (!xsession.context && getConfig().requireContext === 'true') { // Assuming getConfig can provide this
      return 'Error: Context is required and not set for this session. Please use "bot-context load <file>" to load one.';
  }

  // Check cache before calling the API
  const cachedResponse = getResponse(sessionId, userInput);
  if (cachedResponse) {
      logger.info(`Returning cached response [Session: ${sessionId}]`);
      return cachedResponse;
  }

  try {
    // Get or create the chat session with the current tools
    const chat = getChatSession(sessionId, tools);

    // Construct the prompt including the context if available
    let prompt = xsession.context ? `${xsession.context}\n${userInput}` : userInput;
    if (forceJson) {
      prompt += '\nYour response must be in JSON format.';
      // Note: Forcing JSON is better handled by the model's response format setting
      // if the API supports it directly for the chosen model version.
      // Adding it to the prompt is a fallback.
    }

    let chatResponse = null;
    let numSteps = 0;
    const maxSteps = 10; // Limit steps (API calls + function calls)

    // Use a loop to handle potential function calls
    /* eslint-disable no-await-in-loop, no-plusplus */
    while (numSteps < maxSteps) {
      numSteps++;

      logger.info(`Sending message to Gemini [Session: ${sessionId}], Step ${numSteps}`);
      const result = await chat.sendMessage(prompt); // Send the prompt
      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        logger.warn(`Gemini API: No candidates in response [Session: ${sessionId}]`);
        // If no candidates, we can't continue this turn
        chatResponse = 'Could not get a response from the model.';
        break;
      }

      const candidate = response.candidates[0];

      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        const part = candidate.content.parts[0];

        // Check for function calls first
        if (part.functionCall) {
          const functionName = part.functionCall.name;
          const functionArgs = part.functionCall.args;
          logger.info(`Tool call initiated [Session: ${sessionId}], ${functionName} => ${JSON.stringify(functionArgs)}`);

          let functionCallResult;
          try {
              functionCallResult = await handleFunctionCall(part.functionCall);
          } catch (error) {
              logger.error(`Error during handleFunctionCall for ${functionName} [Session: ${sessionId}]`, error);
              // Return a structured error for the model
              functionCallResult = { error: 'Internal error executing function', details: error.message };
          }
          logger.info(`Tool call result [Session: ${sessionId}], ${functionName} => ${util.inspect(functionCallResult)}`);

          // Send the function response back to the model
          // The structure for sending function responses has changed slightly
          prompt = [{
              functionResponse: {
                name: functionName,
                // The response key now directly contains the result object/value
                response: functionCallResult,
              },
          }];
          // The model will process this and generate the next turn (either text or another tool call)
          // We continue the loop with the function response as the new "prompt" for the model.

        } else if (part.text) {
          // If the response is text, this is the final response
          chatResponse = part.text;
          logger.info(`Received final text response [Session: ${sessionId}]`);
          break; // Exit loop as we have the final text response
        } else {
            // Handle other potential part types if necessary, or treat as no response
            logger.warn(`Gemini API: Received unexpected part type [Session: ${sessionId}]`, part);
            chatResponse = 'Received an unexpected response format from the model.';
            break;
        }
      } else {
        logger.warn(`Gemini API: Candidate content is empty or malformed [Session: ${sessionId}]`);
        chatResponse = 'Could not get valid content from the model response.';
        break;
      }
    }
    /* eslint-enable no-await-in-loop, no-plusplus */

    if (!chatResponse) {
        // If loop finished without a response (e.g., maxSteps reached during function calls)
        logger.warn(`Gemini API: Max steps reached without final response [Session: ${sessionId}]`);
        chatResponse = 'Reached maximum processing steps without a final response.';
    }

    // History is managed internally by the ChatSession object in @google/genai
    // You no longer need to manually push turns to xsession.history
    // The chat object itself holds the history. You can retrieve it via `chat.getHistory()` if needed.
    // xsession.history = chat.getHistory(); // Optional: if you need to save history manually elsewhere

    addResponse(sessionId, userInput, chatResponse);
    return chatResponse;

  } catch (err) {
    logger.error(`Gemini API error [Session: ${sessionId}]:`, err);
    // Provide a more informative error to the user
    return `Error processing your request: ${err.message}. Please try again or contact support.`;
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
    let sessionId = req.sessionID || req.ip;
  
  if (!userMessage) {
      logger.warn(`Chat request with empty message [Session: ${sessionId}]`);
      return res.status(400).json({ error: 'Message is required' });
  }

  logger.info(`Chat request received [Session: ${sessionId}]`, { message: userMessage });
  
  try {
    const resp = await getChatResponse(sessionId, userMessage);
      // Ensure response is always a string, even if function call result was an object
    // In this updated logic, getChatResponse aims to return the final text response or an error string.
    res.json({ response: resp });
  } catch (error) {
      logger.error(`Unhandled error in /chat route [Session: ${sessionId}]`, error);
      res.status(500).json({ error: 'An internal server error occurred.' });
  }
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

// Clean shutdown handling
const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully.`);
    // Add any cleanup logic here (e.g., closing database connections, etc.)
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM')); // Often used by process managers like pm2, Docker

// Consider adding error handling for unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Depending on the severity, you might want to shut down or just log
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // This is a critical error, the process is in an unstable state.
    // Perform necessary cleanup and then exit.
    shutdown('UncaughtException'); // Exit after logging
});


const startServer = () => {
  if (loadProperties('resources/app.properties')) {
    const port = Number(getConfig().port) || 5000;
    const host = getConfig().host || '0.0.0.0'; // Allow host to be configured
    app.listen(port, host, () => logger.info(`Listening on ${host}:${port}`));
  } else {
    logger.error('Failed to load application properties. Exiting.');
    process.exit(1);
  }
};

startServer();