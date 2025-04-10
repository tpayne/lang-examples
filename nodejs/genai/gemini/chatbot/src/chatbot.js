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
  getFunctions,
} = require('./gitFunctions');

dotenv.config();

const app = express();
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
});
app.use(limiter);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

let ctxStr = '';
const msgCache = new Map();

app.use(bodyParser.json());
app.use(morganMiddleware);

const getKey = (keyString) => keyString.replace(/\W+/g, '').toUpperCase();

const addResponse = (query, response) => {
  const keyStr = getKey(query);
  if (msgCache.has(keyStr)) return true;
  if (msgCache.size > 1000) {
    Array.from(msgCache.keys()).slice(0, 100).forEach((key) => msgCache.delete(key));
  }
  msgCache.set(keyStr, response);
  return true;
};

const getResponse = (query) => msgCache.get(getKey(query)) || '';

const readContext = (contextStr) => {
  try {
    const contextPath = path.resolve('contexts', contextStr);
    if (!contextPath.startsWith(path.resolve('contexts'))) {
      throw new Error('Invalid context path');
    }
    return fs.readFileSync(contextPath, 'utf-8');
  } catch (err) {
    logger.error(`Cannot load '${contextStr}'`, err);
    return '';
  }
};

/* eslint-disable no-return-await */
const callFunctionByName = async (name, args) => {
  const availableFunctions = getAvailableFunctions();
  if (availableFunctions[name]) {
    const argValues = Object.values(args);
    try {
      return await availableFunctions[name].apply(null, argValues);
    } catch (error) {
      logger.error(`Error executing function ${name}:`, error);
      return `Error executing function ${name}: ${error.message}`;
    }
  }
  return `Error: Function ${name} not recognized`;
};

// Function to handle function calls
const handleFunctionCall = async (functionCall) => {
  const { name, args } = functionCall;
  return await callFunctionByName(name, args);
};
/* eslint-enable no-return-await */

const getChatResponse = async (userInput, forceJson = false) => {
  const tools = getFunctions();

  // Handle special commands
  if (userInput.includes('help')) return 'Sample *Help* text';
  if (userInput.includes('bot-echo-string')) {
    return userInput || 'No string to echo';
  }
  if (userInput.includes('bot-context')) {
    const botCmd = userInput.split(' ');
    switch (botCmd[1]) {
      case 'load':
        ctxStr = '';
        ctxStr = readContext(botCmd[2].trim());
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
      contxtStr += '\nYour response must be in json format.';
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
            logger.info(`Function call detected (iteration ${numFunctionCalls}): ${functionName} with args: ${JSON.stringify(functionArgs)}`);
            functionCallResult = await handleFunctionCall(part.functionCall);
            logger.info(`Function call result (iteration ${numFunctionCalls}): ${functionCallResult}`);

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

    if (!finalResponse && functionCallResult !== null) {
      // If the last action was a function call and no final text response was generated
      finalResponse = functionCallResult;
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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/indexBot.html')));
app.get('/version', (req, res) => res.json({ version: '1.0' }));
app.get('/status', (req, res) => res.json({ status: 'live' }));

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  logger.debug(`User message received: ${userMessage}`);
  const resp = await getChatResponse(userMessage);
  logger.debug(`Chatbot response was: - ${(resp) || 'Error: no response was detected'}`);
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

const startServer = () => {
  if (loadProperties('resources/app.properties')) {
    const port = Number(getConfig().port) || 5000;
    app.listen(port, '0.0.0.0', () => logger.info(`Listening on port ${port}`));
  } else {
    process.exit(1);
  }
};

startServer();
