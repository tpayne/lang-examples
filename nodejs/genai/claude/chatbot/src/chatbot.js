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

const Anthropic = require('@anthropic-ai/sdk');

const MemcachedStore = require('connect-memcached')(session);
const { getAvailableFunctions, getFunctionDefinitionsForTool, loadIntegrations } = require('./functions');
const { getConfig, loadProperties } = require('./properties'); // Assuming getConfig is available here
const { cleanupSessionTempDir } = require('./utilities');

dotenv.config();

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (as before)
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.sessionID, // Use session ID for rate limiting
});
app.use(limiter);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Stores the conversation history and context for each client session.
 * The key is the client's session ID.
 * History is now in Claude's Messages API format: an array of
 * { role: 'user' | 'assistant', content } entries, where `content` is
 * either a plain string or an array of content blocks (text, tool_use,
 * tool_result). Unlike OpenAI, Claude does NOT use a 'system' role message
 * inside this array — the system prompt is passed as a separate top-level
 * `system` string on each request (see `xsession.context` below).
 * @type {Map<string, { context: string,
 * history: Array<{ role: 'user'|'assistant', content: string|Array<object> }>,
 * messageCache: Map<string, string> }>}
 */
const sessions = new Map();

const morganMiddleware = require('./morganmw');
const logger = require('./logger');

app.use(session({
  // Prefer a dedicated SESSION_SECRET; falling back to the API key only
  // preserves the original behavior of this file.
  secret: process.env.SESSION_SECRET || process.env.ANTHROPIC_API_KEY,
  resave: false,
  saveUninitialized: true,
  store: new MemcachedStore({
    hosts: ['127.0.0.1:11211'],
  }),
  cookie: {
    // Set secure to true only if running HTTPS, false for HTTP fallback
    // This will be handled dynamically based on which server starts
    secure: false, // Initially set to false, will be updated if HTTPS starts
    httpOnly: true, // Prevent client-side access to the cookie
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Function to update session cookie secure flag
const setSessionSecure = (isSecure) => {
  app.use(session({
    secret: process.env.SESSION_SECRET || process.env.ANTHROPIC_API_KEY,
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
 * @param {object} args The arguments for the function (already parsed from JSON string).
 * @returns {Promise<any>} The result of the function call.
 */
const callFunctionByName = async (sessionId, name, args) => {
  const functionCache = await getAvailableFunctions(sessionId);
  const functionInfo = functionCache[name];

  if (functionInfo && functionInfo.func) {
    try {
      // Destructure 'required' from functionInfo - this assumes 'required' is stored in the registry
      const {
        func, params, needSession, required,
      } = functionInfo;
      const functionArgs = { ...args }; // Clone args to avoid mutation

      // Check if functionInfo.required exists before filtering
      const missingParams = (required || []).filter((paramName) => functionArgs[paramName] === undefined);

      if (missingParams.length > 0) {
        logger.error(`Missing required arguments for function '${name}': ${missingParams.join(', ')} [Session: ${sessionId}]`);
        return JSON.stringify({ error: `Missing required arguments for function '${name}'`, details: `Missing: ${missingParams.join(', ')}` });
      }

      // As the genai parser (often) generates rubbish, we need to check if the args are valid
      // Specifically check for the 'code' parameter for save_code_to_file if needed
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
      // Return a stringified error for the model
      return JSON.stringify({ error: 'Function execution failed', details: error.message });
    }
  }
  // Return a stringified error for the model
  return JSON.stringify({ error: `Function '${name}' not found` });
};

/**
 * Gets a chat response from the Claude (Anthropic) API, maintaining state per session.
 * Handles special commands, context, caching, and tool use.
 * @async
 * @param {string} sessionId The ID of the client session.
 * @param {string} userInput The user's message.
 * @param {boolean} [forceJson=false] Whether to request a JSON-only response.
 * Note: unlike OpenAI, Claude has no response_format parameter — this is
 * implemented by appending a JSON-only instruction to the system prompt.
 * @returns {Promise<string|object>} The chatbot's response (usually text).
 */
const getChatResponse = async (sessionId, userInput, forceJson = false) => {
  // Ensure integrations (and thus available functions) are loaded
  await loadIntegrations(sessionId);

  // Get function definitions formatted for Claude's Messages API
  // getFunctionDefinitionsForTool now returns an array of Claude tool objects
  // e.g., [{ name: '...', description: '...', input_schema: {...} }]
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
  if (lowerInput.startsWith('/bot-context')) {
    const parts = lowerInput.split(' ').map((p) => p.trim()).filter((p) => p);
    const command = parts[1];
    const arg = parts.slice(2).join(' ');

    switch (command) {
      case 'load':
        if (!arg) return 'Usage: /bot-context load <context_file_name>';
        /* eslint-disable no-case-declarations */
        const newContext = await readContext(arg);
        /* eslint-enable no-case-declarations */
        if (newContext) {
          xsession.context = newContext;
          // Reset conversation history on context change. Note: Claude does
          // NOT use a 'system' role message in the history array — the
          // context is sent as the top-level `system` parameter on each
          // request instead (see getChatResponse's request loop below).
          xsession.history = [];
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
        // Consider reloading properties if 'reset' should revert config changes
        // loadProperties('resources/app.properties'); // Optional: uncomment if needed
        logger.info(`Context, chat history, and cache reset [Session: ${sessionId}]`);
        return 'Context, chat history, and cache reset for this session';
      default:
        return 'Invalid /bot-context command. Use: load <file>, show, reset';
    }
  }

  // If context is required and not set, inform the user
  if (!xsession.context && getConfig().requireContext === 'true') { // Assuming getConfig can provide this
    return 'Error: Context is required and not set for this session. Please use "/bot-context load <file>" to load one.';
  }

  // Check cache before calling the API
  const cachedResponse = getResponse(sessionId, userInput);
  if (cachedResponse) {
    logger.info(`Returning cached response [Session: ${sessionId}]`);
    return cachedResponse;
  }

  try {
    // Note: no system-role splicing needed here — Claude takes the system
    // prompt as a separate top-level `system` string on every request
    // (built from xsession.context just below), not as a message in the
    // history array. xsession.context is used as-is each turn.

    // Add the user's message to the history for this turn
    xsession.history.push({ role: 'user', content: userInput });
    logger.debug(`Added user message to history [Session: ${sessionId}]`);

    let chatResponse = null;
    let numSteps = 0;
    const maxSteps = (() => {
      const parsed = Number(getConfig().maxChatSteps);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
      logger.warn(`Claude API: 'maxChatSteps' missing or invalid in config (got ${JSON.stringify(getConfig().maxChatSteps)}); defaulting to 10 [Session: ${sessionId}]`);
      return 10;
    })(); // Limit steps (API calls + function calls)

    // Build the system prompt. Claude has no JSON response_format param
    // (unlike OpenAI), so a forced-JSON request is implemented by appending
    // an instruction to the system prompt instead.
    let systemPrompt = xsession.context || undefined;
    if (forceJson) {
      const jsonInstruction = 'Respond with ONLY a single valid JSON object and no other text, markdown, or commentary.';
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}` : jsonInstruction;
      logger.info(`Requesting JSON-only response via system prompt [Session: ${sessionId}]`);
    }

    // Loop to handle potential tool use and subsequent AI responses
    /* eslint-disable no-await-in-loop, no-plusplus */
    while (numSteps < maxSteps) {
      numSteps++;

      const { aiModel } = getConfig();
      if (!aiModel || typeof aiModel !== 'string' || aiModel.trim() === '') {
        throw new Error('Invalid or missing AI model configuration. Please check the "aiModel" setting.');
      }

      // Retrieve configuration values
      const rawTemp = getConfig().temperature;
      const rawTopP = getConfig().top_p;

      // Parse numeric values if set (ignore empty strings, null, or undefined)
      const tempVal = (rawTemp !== undefined && rawTemp !== null && rawTemp !== '') ? Number(rawTemp) : undefined;
      const topPVal = (rawTopP !== undefined && rawTopP !== null && rawTopP !== '') ? Number(rawTopP) : undefined;

      const isTempSet = tempVal !== undefined && !Number.isNaN(tempVal) && tempVal >= 0 && tempVal <= 1;
      const isTopPSet = topPVal !== undefined && !Number.isNaN(topPVal) && topPVal >= 0 && topPVal <= 1;

      if (isTempSet && isTopPSet) {
        throw new Error('Invalid configuration: Both "temperature" and "top_p" are set. Please set only one or neither.');
      }

      const validTools = Array.isArray(tools) && tools.length > 0 && tools.every((t) => t.name && t.description && t.input_schema)
        ? tools
        : undefined;

      const parsedMaxTokens = Number(getConfig().maxTokens);
      const maxTokens = (!Number.isNaN(parsedMaxTokens) && parsedMaxTokens > 0) ? parsedMaxTokens : 4096;

      const completionParams = {
        model: aiModel,
        messages: xsession.history,
        max_tokens: maxTokens,
        ...(systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() !== '' && { system: systemPrompt }),
        ...(validTools && { tools: validTools }),
        ...(isTempSet && { temperature: tempVal }),
        ...(isTopPSet && { top_p: topPVal }),
      };

      const response = await anthropic.messages.create(completionParams);

      logger.debug(`Claude API response [Session: ${sessionId}]: ${util.inspect(response, { depth: null })}`);

      const { content, stop_reason: stopReason } = response;

      if (!content || content.length === 0) {
        logger.warn(`Claude API: No content in response [Session: ${sessionId}]`);
        chatResponse = 'Could not get a valid message from the model.';
        break;
      }

      const toolUseBlocks = content.filter((block) => block.type === 'tool_use');

      if (toolUseBlocks.length === 0 && stopReason === 'max_tokens') {
        logger.error(`Claude API: Response was cut off by max_tokens with no completed tool call. [Session: ${sessionId}]`);
        chatResponse = 'I received an incomplete response from the AI. Please try rephrasing your request.';
        break;
      }

      // Add the assistant's response (text and/or tool_use blocks) to history.
      // Claude requires the *full* content block array to be replayed back,
      // exactly as received, when continuing the conversation.
      xsession.history.push({ role: 'assistant', content });
      logger.debug(`Added assistant message to history [Session: ${sessionId}]`, {
        stopReason,
        blocks: content.map((block) => block.type),
      });

      // Check if the model wants to call one or more tools
      /* eslint-disable no-await-in-loop, no-plusplus, no-restricted-syntax */
      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        // Claude may request multiple tool calls in a single turn; every
        // tool_use block must get a matching tool_result block, and all of
        // them must be returned together in a single 'user' message.
        const toolResultBlocks = [];

        for (const toolUseBlock of toolUseBlocks) {
          const functionName = toolUseBlock.name;
          const functionArgs = toolUseBlock.input; // Already a parsed object, no JSON.parse needed
          const toolCallId = toolUseBlock.id;

          logger.info(`Tool call initiated [Session: ${sessionId}], ${functionName} => ${JSON.stringify(functionArgs)}`);

          let functionCallResult;
          let isError = false;
          try {
            functionCallResult = await callFunctionByName(sessionId, functionName, functionArgs);
            // The result should ideally be a stringified JSON object or a simple string
            if (typeof functionCallResult !== 'string') {
              functionCallResult = JSON.stringify(functionCallResult);
            }
          } catch (error) {
            logger.error(`Error during tool call execution for ${functionName} [Session: ${sessionId}]`, error);
            functionCallResult = JSON.stringify({ error: 'Function execution failed', details: error.message });
            isError = true;
          }
          try {
            const parsedResult = JSON.parse(functionCallResult);
            logger.info(`Tool call result [Session: ${sessionId}], ${functionName} => ${JSON.stringify(parsedResult, null, 2)}`);
          } catch (error) {
            logger.info(`Tool call result [Session: ${sessionId}], ${functionName} => ${functionCallResult}`);
          }

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolCallId, // Important: links result to the specific tool_use block
            content: functionCallResult,
            ...(isError && { is_error: true }),
          });
        }

        // All tool results for this turn go in a single user message
        xsession.history.push({ role: 'user', content: toolResultBlocks });
        logger.debug(`Added ${toolResultBlocks.length} tool result(s) to history [Session: ${sessionId}]`);
        // The loop continues, and the next API call will include the tool result message.
        // The model will then likely generate a text response based on the tool result.
      } else {
        const textBlocks = content.filter((block) => block.type === 'text');
        if (textBlocks.length > 0) {
          // If the response is text, this is the final response
          chatResponse = textBlocks.map((block) => block.text).join('\n');
          logger.info(`Received final text response [Session: ${sessionId}]`);
          cleanupSessionTempDir(sessionId); // Clean up temp directory if used
          break; // Exit loop as we have the final text response
        }
        // Handle cases where the response has neither text nor tool_use (e.g. a refusal stop_reason)
        logger.warn(`Claude API: Received message with no text or tool_use blocks [Session: ${sessionId}]`, { stopReason });
        chatResponse = 'Received an unexpected response format from the model.';
        break;
      }
    }
    /* eslint-enable no-await-in-loop, no-plusplus, no-restricted-syntax */

    if (chatResponse === null) {
      // Loop actually exhausted maxSteps without ever setting a response
      logger.warn(`Claude API: Max steps reached without final text response [Session: ${sessionId}]`);
      chatResponse = 'Reached maximum processing steps without a final text response.';
    } else if (chatResponse === '') {
      logger.warn(`Claude API: Received an empty text response [Session: ${sessionId}]`);
      chatResponse = 'I didn\'t receive a complete response — could you try rephrasing your request?';
    }

    // Ensure history doesn't grow indefinitely — keep the last N turns.
    // (No system message lives in this array for Claude, so there's nothing
    // special to preserve here — unlike the OpenAI version.)
    const maxHistoryLength = 500;
    if (xsession.history.length > maxHistoryLength) {
      xsession.history = xsession.history.slice(-maxHistoryLength);
      // If the trim landed in the middle of a tool_use / tool_result pair,
      // the leading tool_result would reference a tool_use block that no
      // longer exists, which the Messages API will reject. Drop any leading
      // messages that are purely tool_result content until we land on a
      // clean turn boundary.
      while (
        xsession.history.length > 0
        && Array.isArray(xsession.history[0].content)
        && xsession.history[0].content.every((block) => block.type === 'tool_result')
      ) {
        xsession.history.shift();
      }
      logger.debug(`Trimmed history to ${xsession.history.length} messages [Session: ${sessionId}]`);
    }

    addResponse(sessionId, userInput, chatResponse);
    return chatResponse;
  } catch (err) {
    logger.error(`Claude API error [Session: ${sessionId}]`, err);
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
  // Use sessionID if available, fallback to IP (less reliable for sessions)
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
    logger.error(`Unhandled error in /chat route [Session: ${sessionId}]`, error);
    // Ensure an error response is sent if something goes wrong
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

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
  // Consider saving session data if necessary
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
  if (logger && typeof logger.error === 'function') {
    logger.error('Uncaught Exception:', err);
  } else {
    // eslint-disable-next-line no-console
    console.error('Uncaught Exception (logger uninitialized):', err);
  }
  shutdown('UncaughtException');
});

const startServer = () => {
  if (!loadProperties('/app/public/resources/app.properties')) {
    logger.error('Failed to load application properties. Exiting.');
    process.exit(1);
  }

  const host = getConfig().host || '0.0.0.0'; // Allow host to be configured

  // --- Attempt to start HTTPS Server ---
  let privateKey = null;
  let certificate = null;

  const certsPath = getConfig().certsPath || '/app/certs'; // Directory where certificates are copied in Docker

  try {
    // Read certificate files synchronously
    privateKey = fsSync.readFileSync(path.join(certsPath, 'server.key'), 'utf8');
    certificate = fsSync.readFileSync(path.join(certsPath, 'server.crt'), 'utf8');
    // Uncomment the line below if you have a CA certificate chain file
    // const ca = fsSync.readFileSync(path.join(certsPath, 'ca.crt'), 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
      // ca: ca // Uncomment if you have a CA certificate
    };

    // Create and start the HTTPS server
    const httpsPort = Number(getConfig().httpsPort) || 8443;
    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(httpsPort, host, () => {
      logger.info(`HTTPS Listening on ${host}:${httpsPort}`);
      setSessionSecure(true); // Set session cookie to secure
    });

    logger.info('HTTPS server started successfully.');

    // Optional: If you also want to listen on HTTP for redirection or fallback
    // const httpPort = Number(getConfig().port) || 8080;
    // const httpServer = http.createServer(app);
    // httpServer.listen(httpPort, host, () => {
    //   logger.info(`HTTP Listening on ${host}:${httpPort}`);
    // });
  } catch (err) {
    // --- Fallback to HTTP Server ---
    logger.warn('Failed to load SSL certificates or start HTTPS server. Falling back to HTTP.', err);

    const httpPort = Number(getConfig().port) || 8080;
    const httpServer = http.createServer(app); // Create an HTTP server

    httpServer.listen(httpPort, host, () => {
      logger.info(`HTTP Listening on ${host}:${httpPort}`);
      setSessionSecure(false); // Ensure session cookie is not secure for HTTP
    });

    logger.info('HTTP server started as fallback.');
  }
};

// Start the server (either HTTPS or HTTP)
startServer();
