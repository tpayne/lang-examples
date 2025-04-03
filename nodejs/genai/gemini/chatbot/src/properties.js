const fs = require('fs');
const logger = require('./logger');

const config = {};
const getConfig = () => config;

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

module.exports = {
  getConfig,
  loadProperties,
};
