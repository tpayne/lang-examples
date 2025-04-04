const { GoogleGenAI } = require('@google/genai');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./logger'); // Assuming you have a logger module
const morganMiddleware = require('./morganmw'); // Assuming you have a morgan middleware module
const { getConfig, loadProperties } = require('./properties'); // Assuming you have a properties module

dotenv.config();

const app = express();
const ai = new GoogleGenAI({apiKey: process.env.GOOGLE_API_KEY})

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
  if (!ctxStr) return 'Error: Context is not set. Please load one';
  const cachedResponse = getResponse(userInput);
  if (cachedResponse) return cachedResponse;
  try {
    let contxtStr = userInput;
    if (forceJson) {
      contxtStr += '\nYour response must be in json format.';
    }
    const result = await ai.models.generateContent({
      model: getConfig().aiModel,
      contents: `${ctxStr}\n${contxtStr}`,
      generationConfig: {
        maxOutputTokens: Number(getConfig().maxTokens),
        temperature: 1,
        topP: 1,
      },
    });

    const responseMsg = result.text;

    addResponse(contxtStr, responseMsg);
    return responseMsg;
  } catch (err) {
    logger.error('Gemini API error:', err);
    return 'Error processing request';
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
