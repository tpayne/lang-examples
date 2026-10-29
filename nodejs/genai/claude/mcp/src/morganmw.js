const morgan = require('morgan');
const logger = require('./logger');
const { getConfig } = require('./properties');

const stream = {
  write: (message) => logger.http(`HTTP Request: ${message.trim()}`),
};

const skip = () => {
  if (getConfig().debug !== 'true') {
    return true;
  }
  const env = process.env.NODE_ENV || 'development';
  return env !== 'development';
};

// Custom token for user information (Suggestion 2 & 7)
morgan.token('user', (req) => (req.user ? req.user.id : 'anonymous'));

// Custom format including user information (Suggestion 2)
const httpLogFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms - user[:user]';

const morganMiddleware = morgan(
  httpLogFormat,
  { stream, skip },
);

module.exports = morganMiddleware;
