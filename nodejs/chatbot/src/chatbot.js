const OpenAI = require('openai');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const morganMiddleware = require('./morganmw');

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let ctxStr = '';
const config = {};
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

const loadProperties = (propFile) => {
  try {
    const data = fs.readFileSync(propFile, 'utf-8');
    data.split('\n').forEach((line) => {
      const [key, value] = line.split('=');
      if (key && value) config[key.trim()] = value.trim();
    });
    return true;
  } catch (err) {
    logger.error(`Cannot load ${propFile}`, err);
    return false;
  }
};

const readContext = (contextStr) => {
  try {
    return fs.readFileSync(path.join('contexts', contextStr), 'utf-8');
  } catch (err) {
    logger.error(`Cannot load '${contextStr}'`, err);
    return '';
  }
};

const getChatResponse = async (userInput, forceJson = false) => {
  if (/hello/i.test(userInput)) return 'Hello there! How can I help you?';
  if (/help/i.test(userInput)) return 'Sample *Help* text';
  if (/bot-context/i.test(userInput)) {
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
    const response = await openai.chat.completions.create({
      model: config.gptModel,
      messages: [
        { role: 'system', content: ctxStr },
        { role: 'user', content: userInput },
      ],
      response_format: forceJson ? { type: 'json_object' } : undefined,
      max_tokens: Number(config.maxTokens),
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    const responseMsg = response.choices[0].message.content;
    addResponse(userInput, responseMsg);
    return responseMsg;
  } catch (err) {
    logger.error('OpenAI API error:', err);
    return 'Error processing request';
  }
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates/index.html')));
app.get('/version', (req, res) => res.json({ version: '1.0' }));
app.get('/status', (req, res) => res.json({ status: 'live' }));

app.post('/chat', async (req, res) => {
  const response = await getChatResponse(req.body.message);
  res.json({ response });
});

process.on('SIGINT', () => {
  logger.info('\nGracefully shutting down from SIGINT (Ctrl-C)');
  // some other closing procedures go here
  process.exit(0);
});

const startServer = () => {
  if (loadProperties('resources/app.properties')) {
    const port = Number(config.port) || 5000;
    app.listen(port, '0.0.0.0', () => logger.info(`Listening on port ${port}`));
  } else {
    process.exit(1);
  }
};

startServer();
