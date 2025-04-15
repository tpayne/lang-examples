const { GoogleGenAI } = require('@google/genai');

const RateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('./logger'); // Assuming you have a logger module
const morganMiddleware = require('./morganmw'); // Assuming you have a morgan middleware module

const { getConfig, loadProperties } = require('./properties'); // Assuming you have a properties module

const {
  getAvailableFunctions,
  getFunctionDefinitionsForTool,
} = require('./functions');

dotenv.config();

const app = express();
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
  keyGenerator: (req) => req.ip, // Rate limit per IP address (Suggestion 4)
});
app.use(limiter);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

let ctxStr = '';
const msgCache = new Map();

app.use(bodyParser.json());
app.use(morganMiddleware);

/**
 * Normalizes a string to create a consistent key for the message cache.
 * Removes non-alphanumeric characters and converts to uppercase.
 * @param {string} keyString The string to normalize.
 * @returns {string} The normalized key.
 */
const getKey = (keyString) => keyString.replace(/\W+/g, '').toUpperCase();

/**
 * Adds a query and its response to the message cache.
 * Limits the cache size to 1000 entries, removing the oldest 100 if full.
 * @param {string} query The user's query.
 * @param {string} response The chatbot's response.
 * @returns {boolean} True if the response was added to the cache.
 */
const addResponse = (query, response) => {
  const keyStr = getKey(query);
  if (msgCache.has(keyStr)) return true;
  if (msgCache.size > 1000) {
    Array.from(msgCache.keys()).slice(0, 100).forEach((key) => msgCache.delete(key));
  }
  msgCache.set(keyStr, response);
  return true;
};

/**
 * Retrieves a cached response for a given query.
 * @param {string} query The user's query.
 * @returns {string} The cached response, or an empty string if not found.
 */
const getResponse = (query) => msgCache.get(getKey(query)) || '';

/**
 * Reads the context from a file in the 'contexts' directory.
 * Validates the path to prevent accessing files outside the context directory.
 * Uses asynchronous file reading for better performance.
 * @param {string} contextStr The name of the context file.
 * @returns {Promise<string>} The content of the context file
 */
const readContext = async (contextStr) => {
  try {
    const contextPath = path.resolve('contexts', contextStr);
    const normalizedContextPath = path.normalize(contextPath);
    const normalizedContextsPath = path.normalize(path.resolve('contexts'));
    if (!normalizedContextPath.startsWith(normalizedContextsPath)) {
      throw new Error('Invalid context path');
    }
    return await fs.promises.readFile(contextPath, 'utf-8'); // Suggestion 1
  } catch (err) {
    logger.error(`Cannot load '${contextStr}'`, err);
    return '';
  }
};

/* eslint-disable no-return-await, prefer-spread */
/**
 * Calls a function by its name, using the provided arguments.
 * Retrieves the function definition from the available functions registry.
 * Handles potential errors during function execution and logs them.
 * Returns a structured error object on failure.
 * @param {string} name The name of the function to call.
 * @param {object} args An object containing the arguments for the function.
 * @returns {Promise<any>} The result of the function call, or an error object.
 */
const callFunctionByName = async (name, args) => {
  const functionInfo = getAvailableFunctions()[name];
  if (functionInfo && functionInfo.func) {
    const { func, params } = functionInfo;
    const argValues = params.map((paramName) => args[paramName]);

    try {
      const result = await func.apply(null, argValues);
      logger.info(`Function '${name}' executed successfully`, { arguments: args, result }); // Suggestion 6
      return result;
    } catch (error) {
      const errStr = error.message;
      logger.error(`Error executing function '${name}'`, { arguments: args, error: errStr }); // Suggestion 6
      return { error: 'Function execution failed', details: errStr }; // Suggestion 3
    }
  }
  return { error: `Function '${name}' not recognized` };
};

/**
 * Handles a function call initiated by the Gemini API.
 * Extracts the function name and arguments and calls the corresponding function.
 * @param {object} functionCall The function call object received from the Gemini API.
 * @returns {Promise<any>} The result of the function call.
 */
const handleFunctionCall = async (functionCall) => {
  const { name, args } = functionCall;
  return await callFunctionByName(name, args);
};
/* eslint-enable no-return-await,prefer-spread */

/**
 * Gets a chat response from the Gemini API based on user input and the current context.
 * Handles special commands, retrieves cached responses, and manages multi-turn function calls.
 * @param {string} userInput The user's message.
 * @param {boolean} [forceJson=false] Whether to force the Gemini response to be in JSON format
 * @returns {Promise<string|object>} The chatbot's response or an error message/object.
 */
const getChatResponse = async (userInput, forceJson = false) => {
  const tools = getFunctionDefinitionsForTool();

  // Handle special commands (Suggestion 8 - could be moved to config for more flexibility)
  if (userInput.includes('help')) return 'Sample *Help* text';
  if (userInput.includes('bot-echo-string')) {
    return userInput || 'No string to echo';
  }
  if (userInput.includes('bot-context')) {
    const botCmd = userInput.split(' ');
    switch (botCmd[1]) {
      case 'load':
        ctxStr = '';
        ctxStr = await readContext(botCmd[2].trim()); // Await the async function
        return ctxStr ? 'Context loaded' : 'Context file could not be read or is empty';
      case 'show':
        return ctxStr || 'Context is empty - ignored';
      case 'reset':
        ctxStr = '';
        return 'Context reset';
      default:
        return 'Invalid command';
    }
  }

  // Check if context is set
  if (!ctxStr) return 'Error: Context is not set. Please load one';

  // Check for cached response
  const cachedResponse = getResponse(userInput);
  if (cachedResponse) return cachedResponse;

  try {
    let contxtStr = userInput;
    if (forceJson) {
      contxtStr += '\nYour response must be in json format.'; // Note: Gemini's direct JSON enforcement might differ
    }

    const functionDefs = tools.map((func) => func.function);
    const generationConfig = {
      maxOutputTokens: Number(getConfig().maxTokens),
      temperature: 1,
      topP: 1,
    };
    const parts = [{ role: 'user', text: `${ctxStr}\n${contxtStr}` }];
    const toolsConfig = { tools: [{ functionDeclarations: functionDefs }] };

    let finalResponse = null;
    let functionCallResult = null;
    let numFunctionCalls = 0;
    const maxFunctionCalls = 5; // Limit to prevent infinite loops

    /* eslint-disable no-return-await,max-len,no-plusplus,no-await-in-loop */
    while (!finalResponse && numFunctionCalls < maxFunctionCalls) {
      if (getConfig().debug === 'true') {
        logger.debug(`Input into AI model (iteration ${numFunctionCalls}): ${util.inspect(parts, { depth: null })}`);
      }
      const result = await ai.models.generateContent({
        model: getConfig().aiModel,
        contents: parts,
        generationConfig,
        config: toolsConfig.tools.length > 0 ? toolsConfig : [],
      });

      if (!result || typeof result !== 'object') {
        logger.error('Gemini API error: No response object');
        return 'Error: No response from the API';
      }

      const response = result;
      if (getConfig().debug === 'true') {
        logger.debug(`Response from AI model (iteration ${numFunctionCalls}): ${util.inspect(response, { depth: null })}`);
      }
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const part = candidate.content.parts[0];
          if (part.functionCall) {
            numFunctionCalls++;
            const functionName = part.functionCall.name;
            const functionArgs = part.functionCall.args;

            logger.info(`Initiating tool call, ${functionName} => ${JSON.stringify(functionArgs)}`); // Suggestion 6

            functionCallResult = await handleFunctionCall(part.functionCall);

            if (getConfig().debug === 'true') {
              logger.debug(`Function call detected (iteration ${numFunctionCalls}): ${functionName} with args: ${JSON.stringify(functionArgs)}`);
              logger.debug(`Function call result (iteration ${numFunctionCalls}): ${functionCallResult}`);
            }

            const functionResponsePart = {
              name: functionName,
              response: { functionCallResult },
            };

            // Send the function call result back to the model for a follow-up
            parts.push({
              role: 'model',
              parts: [{
                functionCall: part.functionCall,
              }],
            });
            parts.push({
              role: 'user',
              parts: [{
                functionResponse: functionResponsePart,
              }],
            });
          } else if (part.text) {
            finalResponse = part.text;
          }
        }
      } else {
        logger.warn('Gemini API: No candidates in the response.');
        break;
      }

      if (numFunctionCalls >= maxFunctionCalls && !finalResponse) {
        finalResponse = 'Error: Maximum function call limit reached without a final response.';
      }
    }
    /* eslint-enable no-return-await,max-len,no-plusplus,no-await-in-loop */

    if (!finalResponse && functionCallResult !== null && typeof functionCallResult !== 'object' && !functionCallResult.error) {
      // If the last action was a successful function call and no final text response
      finalResponse = functionCallResult;
    } else if (!finalResponse && functionCallResult && functionCallResult.error) {
      finalResponse = `Function call failed: ${functionCallResult.error} - ${functionCallResult.details || ''}`;
    }

    if (!finalResponse) {
      throw Error('Not able to get a final response from Gemini.');
    }

    addResponse(contxtStr, finalResponse);
    return finalResponse;
  } catch (err) {
    logger.error('Gemini API error:', err);
    return `Error processing request - ${err}`;
  }
};

/**
 * Handles GET requests to the root path, serving the 'indexBot.html' file.
 * @param {object} req The Express.js request object.
 * @param {object} res The Express.js response object.
 */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/indexBot.html')));

/**
 * Handles GET requests to the '/version' path, returning the application version as JSON.
 * @param {object} req The Express.js request object.
 * @param {object} res The Express.js response object.
 */
app.get('/version', (req, res) => res.json({ version: '1.0' }));

/**
 * Handles GET requests to the '/status' path, returning the application status as JSON.
 * @param {object} req The Express.js request object.
 * @param {object} res The Express.js response object.
 */
app.get('/status', (req, res) => res.json({ status: 'live' }));

/**
 * Handles POST requests to the '/chat' path
 * Logs the user input.
 * @param {object} req The Express.js request object, containing the user's message in the body.
 * @param {object} res The Express.js response object, sending the chatbot's response as JSON.
 */
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  logger.info('Chat request received', { message: userMessage }); // Suggestion 5
  const resp = await getChatResponse(userMessage);
  res.json({ response: (resp) || 'Error: no response was detected' });
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGILL', () => {
  process.exit(1);
});

process.on('SIGSEG', () => {
  process.exit(1);
});

process.on('SIGBUS', () => {
  process.exit(1);
});

/**
 * Starts the Express.js server after loading application properties.
 * Exits the process if the properties file cannot be loaded.
 */
const startServer = () => {
  if (loadProperties('resources/app.properties')) {
    const port = Number(getConfig().port) || 5000;
    app.listen(port, '0.0.0.0', () => logger.info(`Listening on port ${port}`));
  } else {
    process.exit(1);
  }
};

startServer();
