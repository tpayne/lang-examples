const { GoogleGenAI } = require('@google/genai');

const RateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const logger = require('./logger'); // Assuming you have a logger module
const morganMiddleware = require('./morganmw'); // Assuming you have a morgan middleware module
const path = require('path');
const util = require('util');

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

const getChatResponse = async (userInput, forceJson = false) => {
  const tools = getFunctions();

  // Handle special commands
  if (userInput.includes('help')) return 'Sample *Help* text';
  if (userInput.includes('bot-context')) {
    const botCmd = userInput.split(' ');
    switch (botCmd[1]) {
      case 'load':
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

    const functionDefs = tools.map(func => func.function);

    // Generate content using the AI model
    const result = await ai.models.generateContent({
      model: getConfig().aiModel,
      contents: `${ctxStr}\n${contxtStr}`,
      generationConfig: {
        maxOutputTokens: Number(getConfig().maxTokens),
        temperature: 1,
        topP: 1,
      },
      config: {
        tools: [{
          functionDeclarations: functionDefs
        }],
      },
    });

    // Log the entire result object for debugging
    // Need this for working out what the fetch api is doing
    // Documentation and samples are not correct
    //logger.debug(`Result from AI model: ${util.inspect(result, { depth: null })}`);

    // Check if result is valid
    if (!result || typeof result !== 'object') {
      logger.error('Gemini API error: Result is not an object or is undefined');
      return 'Error: No response from the API';
    }

    // Check if response is defined
    const response = result;
    //logger.debug(`Response from AI model: ${util.inspect(response, { depth: null })}`);
    if (!response) {
      logger.error('Gemini API error: Response is undefined');
      return 'Error: No response from the API';
    }

    let responseTxt = null;

    if (response.candidates) {
      if (response.candidates[0].content.parts[0].functionCall) {
        if (response.functionCalls && response.functionCalls.length > 0) {
          const functionCall = response.functionCalls[0];
          const functionResponse = await handleFunctionCall(functionCall); // Handle the function call
          responseTxt = functionResponse; // Return the function response directly
        }   
      } else if (response.candidates[0].content.parts[0].text) {
        responseTxt = response.candidates[0].content.parts[0].text;
      }
    }
    if (!responseTxt) {
      throw Error('Not able to get a response from Gemini');
    }
    addResponse(contxtStr, responseTxt);
    return responseTxt;
  } catch (err) {
    logger.error('Gemini API error:', err);
    return `Error processing request - ${err}`;
  }
};

// Function to handle function calls
const handleFunctionCall = async (functionCall) => {
  // Implement the logic to handle the function call
  // This could involve calling another function or processing the call in some way
  // For example:
  const { name, args } = functionCall;
  // Call the appropriate function based on the name and arguments
  // Return the result of the function call
  return await callFunctionByName(name, args);
};

// Example function to call based on function name
const callFunctionByName = async (name, args) => {
  const availableFunctions = getAvailableFunctions();
  if (availableFunctions[name]) {
    const argValues = Object.values(args);
    return await availableFunctions[name].apply(null,argValues);
  } else {
    return `Error: Function ${name} not recognized`;
  }
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/indexBot.html')));
app.get('/version', (req, res) => res.json({ version: '1.0' }));
app.get('/status', (req, res) => res.json({ status: 'live' }));

app.post('/chat', async (req, res) => {
  const resp = await getChatResponse(req.body.message);
  res.json({ response: resp });
});

process.on('SIGINT', () => {
  logger.info('\nGracefully shutting down from SIGINT (Ctrl-C)');
  // some other closing procedures go here
  process.exit(0);
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
