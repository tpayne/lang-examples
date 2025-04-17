const fs = require('fs');
const logger = require('./logger');

const config = {};
const getConfig = () => config;

const loadProperties = (propFile) => {
    try {
        const data = fs.readFileSync(propFile, 'utf-8');
        data.split('\n').forEach((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const index = trimmedLine.indexOf('=');
                if (index > 0) {
                    const key = trimmedLine.substring(0, index).trim();
                    const value = trimmedLine.substring(index + 1).trim();
                    config[key] = value;
                }
            }
        });

        /* eslint-disable no-restricted-syntax */
        for (const key in config) {
            if (process.env[key]) {
                config[key] = process.env[key].trim();
                logger.info(`Configuration '${key}' overridden by environment variable.`);
            }
        }
        /* eslint-enable no-restricted-syntax */

        return true;
    } catch (err) {
        logger.error(`Cannot load ${propFile}: ${err.message || err}`);
        return false;
    }
};

const loadPropertiesAsync = async (propFile) => {
    try {
        const data = await fs.promises.readFile(propFile, 'utf-8');
        const newConfig = {};
        data.split('\n').forEach((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const index = trimmedLine.indexOf('=');
                if (index > 0) {
                    const key = trimmedLine.substring(0, index).trim();
                    const value = trimmedLine.substring(index + 1).trim();
                    newConfig[key] = value;
                }
            }
        });
        // Update the global config object
        Object.assign(config, newConfig);

        /* eslint-disable no-restricted-syntax */
        for (const key in config) {
            if (process.env[key]) {
                config[key] = process.env[key].trim();
                logger.info(`Configuration '${key}' overridden by environment variable.`);
            }
        }
        /* eslint-enable no-restricted-syntax */

        return true;
    } catch (err) {
        logger.error(`Cannot load ${propFile}: ${err.message || err}`);
        return false;
    }
};

// Initialize with default configuration (Suggestion 7)
config.defaultSetting = 'defaultValue';

module.exports = {
    getConfig,
    loadProperties, // Export the synchronous version by default
    loadPropertiesAsync, // Export the asynchronous version explicitly
};