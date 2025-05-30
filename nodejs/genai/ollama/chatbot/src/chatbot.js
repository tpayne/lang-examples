const RateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs').promises; // Keep the async fs for other operations
const fsSync = require('fs'); // Add sync fs for reading certs synchronously
const path = require('path');
const session = require('express-session');
const util = require('util');
// Add the 'https' module for creating an HTTPS server
const https = require('https');
// Add the 'http' module for creating an HTTP server (for fallback)
const http = require('http');

// Import Ollama
const { Ollama } = require('ollama');
const MemcachedStore = require('connect-memcached')(session);
const { getAvailableFunctions, getFunctionDefinitionsForTool, loadIntegrations } = require('./functions');
const { getConfig, loadProperties } = require('./properties'); // Assuming getConfig is available here
const { cleanupSessionTempDir } = require('./utilities');

dotenv.config();

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP/session to 100 requests per windowMs
  keyGenerator: (req) => req.sessionID, // Use session ID for rate limiting
});
app.use(limiter);

// Initialize Ollama client
// Assumes Ollama is running on http://localhost:11434
// You can configure it: const ollama = new Ollama({ host: 'http://custom.host:port' });
const ollama = new Ollama( process.env.OLLAMA_HOST ? { host: process.env.OLLAMA_HOST } : { host: 'http://localhost:11434' });

/**
 * Stores the conversation history and context for each client session.
 * The key is the client's session ID.
 * History is now in Ollama's messages format.
 * @type {Map<string, {
 * context: string,
 * history: Array<{
 * role: 'system' | 'user' | 'assistant' | 'tool',
 * content: string,
 * images?: string[], // For user messages, Ollama can accept images
 * tool_calls?: Array<{ id: string, type: 'function', function: { name: string, arguments: object } }>, // For assistant messages
 * tool_call_id?: string // For tool messages
 * }>,
 * messageCache: Map<string, string>
 * }>}
 */
const sessions = new Map();

const morganMiddleware = require('./morganmw');
const logger =require('./logger');

// IMPORTANT: Use a dedicated session secret from .env or a default (log warning if default in prod)
const sessionSecret = process.env.SESSION_SECRET || 'your-very-secure-session-secret';
if (sessionSecret === 'your-very-secure-session-secret' && process.env.NODE_ENV === 'production') {
  logger.warn('WARNING: Using default insecure session secret in production! Please set SESSION_SECRET in your .env file.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  store: new MemcachedStore({
    hosts: ['127.0.0.1:11211'], // Default memcached host and port
  }),
  cookie: {
    // Set secure to true only if running HTTPS, false for HTTP fallback
    // This will be handled dynamically based on which server starts
    secure: false, // Initially set to false, will be updated if HTTPS starts
    httpOnly: true, // Prevent client-side access to the cookie
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

/**
 * Function to update session cookie secure flag after server starts.
 * This re-initializes the session middleware with the updated secure flag.
 * @param {boolean} isSecure True if HTTPS is running, false otherwise.
 */
const setSessionSecure = (isSecure) => {
  app.use(session({
    secret: sessionSecret, // Use the same dedicated secret
    resave: false,
    saveUninitialized: true,
    store: new MemcachedStore({
      hosts: ['127.0.0.1:11211'],
    }),
    cookie: {
      secure: isSecure, // Set based on whether HTTPS is running
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
};

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
      context: '', history: [], messageCache: new Map(),
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
 * @param {string} sessionId The ID of the client session.
 * @param {string} name The name of the function.
 * @param {object} args The arguments for the function (already parsed from JSON string by OpenAI, or directly an object from Ollama).
 * @returns {Promise<any>} The result of the function call, stringified.
 */
const callFunctionByName = async (sessionId, name, args) => {
  const functionCache = await getAvailableFunctions(sessionId);
  const functionInfo = functionCache[name];

  if (functionInfo && functionInfo.func) {
    try {
      // Destructure 'required' from functionInfo
      const {
        func, params, needSession, required,
      } = functionInfo;
      const functionArgs = { ...args }; // Clone args

      // Check if functionInfo.required exists before filtering
      const missingParams = (required || []).filter((paramName) => functionArgs[paramName] === undefined);

      if (missingParams.length > 0) {
        logger.error(`Missing required arguments for function '${name}': ${missingParams.join(', ')} [Session: ${sessionId}]`);
        return JSON.stringify({ error: `Missing required arguments for function '${name}'`, details: `Missing: ${missingParams.join(', ')}` });
      }

      // Specific validation example
      if (name === 'save_code_to_file' && typeof functionArgs.code !== 'string') {
        logger.error(`Invalid or missing 'code' argument for save_code_to_file [Session: ${sessionId}]`);
        return JSON.stringify({
          error: 'Invalid or missing \'code\' argument for save_code_to_file',
          details: '\'code\' must be a string.',
        });
      }

      const argValues = params.map((paramName) => functionArgs[paramName]);
      if (needSession) {
        argValues.unshift(sessionId);
      }
      /* eslint-disable prefer-spread */
      logger.info(`Calling Function '${name}' [Session: ${sessionId}]`);
      const result = await func.apply(null, argValues);
      logger.info(`Function '${name}' executed successfully [Session: ${sessionId}]`, { arguments: functionArgs, result });
      /* eslint-enable prefer-spread */

      // Ensure result is stringified if it's an object/array before returning to model
      if (typeof result !== 'string') {
        return JSON.stringify(result);
      }
      return result;
    } catch (error) {
      logger.error(`Error executing function '${name}' [Session: ${sessionId}]`, { arguments: args, error: error.message });
      return JSON.stringify({ error: 'Function execution failed', details: error.message });
    }
  }
  return JSON.stringify({ error: `Function '${name}' not found` });
};

/**
 * Gets a chat response from the Ollama API, maintaining state per session.
 * Handles special commands, context, caching, and function calling.
 * @async
 * @param {string} sessionId The ID of the client session.
 * @param {string} userInput The user's message.
 * @param {boolean} [forceJson=false] Whether to request a JSON response from Ollama.
 * @returns {Promise<string|object>} The chatbot's response (usually text, or object if forceJson and model returns structured JSON).
 */
const getChatResponse = async (sessionId, userInput, forceJson = false) => {
  // Ensure integrations (and thus available functions) are loaded
  await loadIntegrations(sessionId);

  // Get function definitions formatted for Ollama tools
  const availableTools = await getFunctionDefinitionsForTool(sessionId);
  const tools = availableTools && availableTools.length > 0 ? availableTools : undefined;

  let xsession = sessions.get(sessionId); // Retrieve the session

  // Initialize the session if it doesn't exist
  if (!xsession) {
    xsession = {
      context: '', history: [], messageCache: new Map(),
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
    const parts = lowerInput.split(' ').map((p) => p.trim()).filter((p) => p);
    const command = parts[1];
    const arg = parts.slice(2).join(' ');

    switch (command) {
      case 'load':
        if (!arg) return 'Usage: bot-context load <context_file_name>';
        /* eslint-disable no-case-declarations */
        const newContext = await readContext(arg);
        /* eslint-enable no-case-declarations */
        if (newContext) {
          xsession.context = newContext;
          xsession.history = [{ role: 'system', content: xsession.context }]; // Reset history with new system context
          xsession.messageCache = new Map(); // Clear cache as context changed
          logger.info(`Context '${arg}' loaded and session reset [Session: ${sessionId}]`);
          return `Context '${arg}' loaded and session reset`;
        }
        logger.warn(`Context file '${arg}' could not be read or is empty [Session: ${sessionId}]`);
        return `Context file '${arg}' could not be read or is empty`;

      case 'show':
        return xsession.context || 'Context is empty for this session';
      case 'reset':
        cleanupSessionTempDir(sessionId);
        xsession.context = '';
        xsession.history = []; // Clear history
        xsession.messageCache = new Map(); // Clear cache
        logger.info(`Context, chat history, and cache reset [Session: ${sessionId}]`);
        return 'Context, chat history, and cache reset for this session';
      default:
        return 'Invalid bot-context command. Use: load <file>, show, reset';
    }
  }

  // If context is required and not set, inform the user
  if (!xsession.context && getConfig().requireContext === 'true') {
    return 'Error: Context is required and not set for this session. Please use "bot-context load <file>" to load one.';
  }

  // Check cache before calling the API
  const cachedResponse = getResponse(sessionId, userInput);
  if (cachedResponse) {
    logger.info(`Returning cached response [Session: ${sessionId}]`);
    return cachedResponse;
  }

  try {
    // Add system message if context exists and it's the first message or history is empty
    if (xsession.context && (xsession.history.length === 0 || xsession.history[0].role !== 'system')) {
      xsession.history.unshift({ role: 'system', content: xsession.context });
      logger.info(`Added system message from context [Session: ${sessionId}]`);
    } else if (!xsession.context && xsession.history.length > 0 && xsession.history[0].role === 'system') {
      // If context was removed, remove the old system message
      xsession.history.shift();
      logger.info(`Removed system message (context is empty) [Session: ${sessionId}]`);
    }

    // Add the user's message to the history for this turn
    xsession.history.push({ role: 'user', content: userInput });
    logger.debug(`Added user message to history [Session: ${sessionId}]`);

    let chatResponseContent = null;
    let numSteps = 0;
    const maxSteps = getConfig().maxChatSteps; // Limit steps (API calls + function calls)

    // Loop to handle potential function calls and subsequent AI responses
    /* eslint-disable no-await-in-loop, no-plusplus */
    while (numSteps < maxSteps) {
      numSteps++;

      const ollamaOptions = {
        temperature: Number(getConfig().temperature),
        top_p: Number(getConfig().top_p),
        // Other Ollama specific options can be added here from config
        // e.g., num_ctx, repeat_penalty, mirostat, etc.
      };

      const maxTokensConfig = getConfig().maxTokens;
      if (maxTokensConfig && maxTokensConfig !== 'auto') {
        const numPredict = Number(maxTokensConfig);
        if (!isNaN(numPredict) && numPredict > 0) {
          ollamaOptions.num_predict = numPredict; // Max tokens for Ollama
        } else if (numPredict !== -1) { // Allow -1 for infinite generation if explicitly set
            logger.warn(`Invalid maxTokens value '${maxTokensConfig}', using Ollama's default for num_predict. Set to -1 for 'infinite'.`);
        } else {
            ollamaOptions.num_predict = -1; // User explicitly wants infinite
        }
      }


      const requestPayload = {
        model: getConfig().aiModel, // e.g., 'llama3', 'mistral'
        messages: xsession.history, // Send the full conversation history
        stream: false, // We are not using streaming in this example
        tools: tools, // Pass the tools here for Ollama
        options: ollamaOptions,
      };

      // const requestPayload = {
      //   model: getConfig().aiModel, // e.g., 'llama3', 'mistral' - this should still be 'mixtral:8x7b'
      //   messages: [{ role: 'user', content: 'what is a car?' }], // Simplified message history
      //   stream: false, // We are not using streaming in this example
      //   // Temporarily remove 'tools' completely
      //   options: ollamaOptions,
      // };

      if (forceJson) {
        requestPayload.format = 'json'; // Request JSON output from Ollama
        logger.info(`Requesting JSON response format from Ollama [Session: ${sessionId}]`);
      }

      logger.debug(`Ollama API request [Session: ${sessionId}]: ${util.inspect(requestPayload, { depth: 3 })}`); // Log request
      const response = await ollama.chat(requestPayload);
      logger.debug(`Ollama API response [Session: ${sessionId}]: ${util.inspect(response, { depth: null })}`); // Log full response

      const message = response.message; // Ollama response structure

      if (!message) {
        logger.warn(`Ollama API: No message in response [Session: ${sessionId}]`);
        chatResponseContent = 'Could not get a valid message from the model.';
        break;
      }

      // Add assistant's response (which might include tool calls) to history
      // Ensure not to push undefined tool_calls if it's not present.
      const assistantMessageToPush = {
          role: message.role,
          content: message.content,
          ...(message.tool_calls && message.tool_calls.length > 0 && { tool_calls: message.tool_calls })
      };
      xsession.history.push(assistantMessageToPush);
      logger.debug(`Added assistant message to history [Session: ${sessionId}]`, {
        role: message.role,
        content: message.content,
        tool_calls: message.tool_calls ? message.tool_calls.length : undefined,
      });

      // Check if the model wants to call a tool
      /* eslint-disable no-await-in-loop, no-plusplus, no-restricted-syntax */
      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.info(`Tool call(s) initiated by Ollama model [Session: ${sessionId}]`);
        // Process all tool calls issued by the model in this turn
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = toolCall.function.arguments; // This is an object from Ollama
          const toolCallId = toolCall.id; // ID for linking the tool call and its result

          if (!toolCallId) {
            logger.warn(`Tool call from Ollama for function ${functionName} is missing an ID. This might cause issues with tool result attribution. [Session: ${sessionId}]`);
            // Depending on strictness, you might want to throw an error or generate a temp ID.
          }

          logger.info(`Tool call details [Session: ${sessionId}], Name: ${functionName}, Args: ${JSON.stringify(functionArgs)}, ID: ${toolCallId}`);

          let functionCallResult;
          try {
            functionCallResult = await callFunctionByName(sessionId, functionName, functionArgs);
            // Ensure the result is a string as expected by the history.
            if (typeof functionCallResult !== 'string') {
              functionCallResult = JSON.stringify(functionCallResult);
            }
          } catch (error) {
            logger.error(`Error during tool call execution or parsing arguments for ${functionName} [Session: ${sessionId}]`, error);
            functionCallResult = JSON.stringify({ error: 'Function execution or argument parsing failed', details: error.message });
          }

          // Log the structured result if it's JSON, otherwise log as is.
          try {
            const parsedResult = JSON.parse(functionCallResult);
            logger.info(`Tool call result [Session: ${sessionId}], ${functionName} => ${JSON.stringify(parsedResult, null, 2)}`);
          } catch (error) {
            logger.info(`Tool call result (non-JSON or parsing error) [Session: ${sessionId}], ${functionName} => ${functionCallResult}`);
          }

          // Add the tool result to the history
          const toolResponseMessage = {
            role: 'tool',
            content: functionCallResult, // Result of the function call (as a string)
          };
          // Crucially, add tool_call_id to link it back to the assistant's request.
          if (toolCallId) {
             toolResponseMessage.tool_call_id = toolCallId;
          }

          xsession.history.push(toolResponseMessage);
          logger.debug(`Added tool result to history [Session: ${sessionId}]`, toolResponseMessage);
        }
        // The loop continues, and the next API call will include the tool result message(s).
        // The model will then likely generate a text response based on the tool result(s).
      } else if (message.content) {
        // If the response is text, this is the final response for this turn
        chatResponseContent = message.content;
        logger.info(`Received final text response from Ollama [Session: ${sessionId}]`);
        cleanupSessionTempDir(sessionId); // Clean up temp directory if used
        break; // Exit loop as we have the final text response
      } else {
        // Handle cases where message exists but has neither content nor tool_calls
        logger.warn(`Ollama API: Received message with no content or tool_calls [Session: ${sessionId}]`, message);
        chatResponseContent = 'Received an unexpected response format from the model.';
        break;
      }

      // Check if Ollama model indicates it's done (e.g. after tool calls, it might not be done yet)
      // `response.done` from ollama.chat indicates if the specific chat turn is complete.
      // If it's false after tool calls, the loop should continue to get the next part of the response.
      // However, with stream:false, `response.done` should generally be true.
      if (!response.done && numSteps >= maxSteps) {
          logger.warn(`Ollama API: Max steps reached, but model indicates it's not done processing its current turn. [Session: ${sessionId}]`);
      }
    }
    /* eslint-enable no-await-in-loop, no-plusplus, no-restricted-syntax */

    if (!chatResponseContent) {
      // If loop finished without a final text response
      logger.warn(`Ollama API: Max steps reached or no final text response generated [Session: ${sessionId}]`);
      chatResponseContent = 'Reached maximum processing steps or could not get a final text response from the model.';
    }

    // Ensure history doesn't grow indefinitely
    const maxHistoryLength = 500; // Adjust as needed for Ollama models
    if (xsession.history.length > maxHistoryLength) {
      // Keep the system message and the last N turns
      const systemMessage = xsession.history.find((msg) => msg.role === 'system');
      let historyToKeep = systemMessage ? [systemMessage] : [];
      const messagesWithoutSystem = xsession.history.filter((msg) => msg.role !== 'system');
      const messagesToKeep = messagesWithoutSystem.slice(
        -(maxHistoryLength - (systemMessage ? 1 : 0)),
      );
      historyToKeep = historyToKeep.concat(messagesToKeep);
      xsession.history = historyToKeep;
      logger.debug(`Trimmed history to ${xsession.history.length} messages [Session: ${sessionId}]`);
    }

    addResponse(sessionId, userInput, chatResponseContent);
    return chatResponseContent;
  } catch (err) {
    logger.error(`Ollama API error or processing error [Session: ${sessionId}]`, err);
    // Provide more informative error to the user
    if (err.message && err.message.includes('model not found')) {
        return `Error: The specified Ollama model '${getConfig().aiModel}' was not found. Please ensure it is pulled and spelled correctly.`;
    }
    if (err.cause && err.cause.code === 'ECONNREFUSED') { // Node.js HTTP errors often have err.cause
        return `Error: Could not connect to Ollama. Please ensure Ollama is running. (${err.message})`;
    }
    return `Error processing your request with Ollama: ${err.message}. Please try again or contact support.`;
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
  // Use sessionID if available, fallback to IP (less reliable for sessions but a fallback)
  const sessionId = req.sessionID || req.ip;

  if (!userMessage) {
    logger.warn(`Chat request with empty message [Session: ${sessionId}]`);
    return res.status(400).json({ error: 'Message is required' });
  }

  logger.info(`Chat request received [Session: ${sessionId}]`, { message: userMessage });

  try {
    const resp = await getChatResponse(sessionId, userMessage);
    // The response from getChatResponse is intended to be the final text response
    return res.json({ response: resp });
  } catch (error) {
    // This catch is for unexpected errors not handled within getChatResponse
    logger.error(`Unhandled error in /chat route [Session: ${sessionId}]`, error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Serves the index.html file for the root path.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'indexBot.html'));
});

/**
 * Returns the current version of the chatbot.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/version', (req, res) => res.json({ version: '1.0-ollama' })); // Updated version string

/**
 * Returns the current status of the chatbot.
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @returns {void}
 */
app.get('/status', (req, res) => res.json({ status: 'live' }));

/**
 * Handles graceful shutdown of the server.
 * @param {string} signal The signal received (e.g., 'SIGINT', 'SIGTERM').
 */
const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully.`);
  // Add any cleanup logic here (e.g., closing database connections, saving sessions if needed)
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // kill command

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // This is a critical error, the process is in an undefined state.
  // Perform minimal cleanup if possible and then exit.
  shutdown('UncaughtException'); // Exit after logging
});

/**
 * Initializes and starts the Express server (HTTPS with HTTP fallback).
 */
const startServer = () => {
  if (!loadProperties('resources/app.properties')) {
    logger.error('Failed to load application properties. Exiting.');
    process.exit(1); // Critical error: properties not loaded
  }

  const host = getConfig().host || '0.0.0.0'; // Allow host to be configured, default to all interfaces

  // --- Attempt to start HTTPS Server ---
  let privateKey = null;
  let certificate = null;
  // Default path for certificates, can be overridden by config
  const certsPath = getConfig().certsPath || path.join(__dirname, 'certs'); // More sensible default path

  try {
    // Read certificate files synchronously as they are needed at startup
    privateKey = fsSync.readFileSync(path.join(certsPath, 'server.key'), 'utf8');
    certificate = fsSync.readFileSync(path.join(certsPath, 'server.crt'), 'utf8');
    // Uncomment if you have a CA certificate chain file
    // const ca = fsSync.readFileSync(path.join(certsPath, 'ca.crt'), 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
      // ca: ca // Uncomment if you have a CA certificate
    };

    const httpsPort = Number(getConfig().httpsPort) || 8443;
    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(httpsPort, host, () => {
      logger.info(`HTTPS Listening on ${host}:${httpsPort}`);
      setSessionSecure(true); // Set session cookie to secure for HTTPS
    });

    logger.info('HTTPS server started successfully.');

    // Optional: If you also want an HTTP server for redirection or non-sensitive health checks
    // const httpPortForRedirect = Number(getConfig().port) || 8080;
    // http.createServer((req, res) => {
    //   res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    //   res.end();
    // }).listen(httpPortForRedirect, host, () => {
    //   logger.info(`HTTP server for redirection listening on ${host}:${httpPortForRedirect}`);
    // });

  } catch (err) {
    // --- Fallback to HTTP Server ---
    logger.warn(`Failed to load SSL certificates or start HTTPS server (Error: ${err.message}). Falling back to HTTP.`);
    logger.info(`Ensure 'server.key' and 'server.crt' are in '${certsPath}' or configure 'certsPath' in properties.`);

    const httpPort = Number(getConfig().port) || 8080;
    const httpServer = http.createServer(app); // Create an HTTP server

    httpServer.listen(httpPort, host, () => {
      logger.info(`HTTP Listening on ${host}:${httpPort}`);
      setSessionSecure(false); // Ensure session cookie is not secure for HTTP
    });

    logger.info('HTTP server started as fallback.');
  }
};

// Start the server
startServer();