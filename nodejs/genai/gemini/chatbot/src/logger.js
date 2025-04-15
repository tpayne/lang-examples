const winston = require('winston');
const fs = require('fs');
const { getConfig } = require('./properties'); // Assuming this is still needed for other config

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// This method set the current severity based on
// the current NODE_ENV: show all the log levels
// if the server was run in development mode; otherwise,
// if it was run in production, show only warn and error messages.
const level = () => {
  if (getConfig().debug === 'true') {
    return 'debug';
  }
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const isProduction = process.env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: !isProduction }),
  isProduction ? winston.format.json() : winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const errorFileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(), // Always JSON for error file in prod for better analysis
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: `${logDir}/error.log`,
    level: 'error',
    format: errorFileFormat,
  }),
  new winston.transports.File({
    filename: `${logDir}/combined.log`,
    format: logFormat,
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports,
});

module.exports = logger;
