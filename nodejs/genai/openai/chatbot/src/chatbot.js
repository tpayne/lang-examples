const OpenAI = require('openai');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const path = require('path');
const RateLimit = require('express-rate-limit');
const util = require('util');
const logger = require('./logger');
const morganMiddleware = require('./morganmw');
const { getConfig } = require('./properties');
const { loadProperties } = require('./properties');

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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      const errStr = error.message;
      logger.error(`Error executing function ${name} ${errStr}`);
      return errStr;
    }
  }
  return `Error: Function ${name} not recognized`;
};

// Function to handle function calls
const handleFunctionCall = async (functionCall) => {
  const { name, args } = functionCall;
  return await callFunctionByName(name, args);
};

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
  if (!ctxStr) return 'Error: Context is not set. Please load one';

  const cachedResponse = getResponse(userInput);
  if (cachedResponse) return cachedResponse;

  try {
    let contxtStr = userInput;
    if (forceJson) {
      contxtStr += '\nYour response must be in json format.';
    }

    const messages = [
      { role: 'system', content: ctxStr },
      { role: 'user', content: contxtStr },
    ];

    let response = await openai.chat.completions.create({
      model: getConfig().aiModel,
      messages,
      tools,
      tool_choice: 'auto',
      response_format: forceJson ? { type: 'json_object' } : undefined,
      max_tokens: Number(getConfig().maxTokens),
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    let responseMsg = response.choices[0].message;

    // Handle tool call
    while (responseMsg.tool_calls) {
      /* eslint-disable no-restricted-syntax, no-unreachable-loop, no-await-in-loop */
      for (const toolCall of responseMsg.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArguments = JSON.parse(toolCall.function.arguments);

        const functionResponse = await handleFunctionCall({
          name: functionName,
          args: functionArguments,
        });

        messages.push(responseMsg);
        messages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(functionResponse),
        });
      }

      // Ask OpenAI to continue the conversation after the tool response
      response = await openai.chat.completions.create({
        model: getConfig().aiModel,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: Number(getConfig().maxTokens),
      });
      /* eslint-enable no-restricted-syntax, no-unreachable-loop, no-await-in-loop */

      responseMsg = response.choices[0].message;
    }

    // No tool calls, normal response
    addResponse(contxtStr, responseMsg.content);
    return responseMsg.content;
  } catch (err) {
    logger.error('OpenAI API error:', err);
    return 'Error processing request';
  }
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/indexBot.html')));
app.get('/version', (req, res) => res.json({ version: '1.0' }));
app.get('/status', (req, res) => res.json({ status: 'live' }));

app.post('/chat', async (req, res) => {
  const resp = await getChatResponse(req.body.message);
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
