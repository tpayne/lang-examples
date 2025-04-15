const superagent = require('superagent');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

/**
 * The base URL for the UK DOSA MOT History REST API.
 * Defaults to the beta environment if not set in environment variables.
 * @constant {string}
 */
const DOSA_MOT_HISTORY_API_URL = process.env.DOSA_MOT_HISTORY_API_URL || 'https://beta.dvasa.gov.uk/mot-history-api';

/**
 * Your API key provided by the UK DVSA.
 * Must be set in the .env file.
 * @constant {string}
 */
const DOSA_API_KEY = process.env.DOSA_API_KEY;

/**
 * Your API secret provided by the UK DVSA.
 * Must be set in the .env file.
 * @constant {string}
 */
const DOSA_API_SECRET = process.env.DOSA_API_SECRET;

// Check if API keys are provided
if (!DOSA_API_KEY || !DOSA_API_SECRET) {
    logger.error('Error: DOSA_API_KEY and DOSA_API_SECRET must be set in your .env file.');
    process.exit(1);
}

/**
 * Stores the current authentication token obtained from the DOSA server.
 * @type {string|null}
 */
let authToken = null;

/**
 * Stores the timestamp (in milliseconds) when the current authentication token will expire.
 * @type {number|null}
 */
let tokenExpiry = null;

/**
 * Asynchronously retrieves a valid authentication token from the DOSA server.
 * It caches the token for repeated use within a 59-minute window.
 * If the cached token is expired or doesn't exist, a new token is requested.
 * @returns {Promise<string>} A promise that resolves to the authentication token.
 * @throws {Error} If there is an error obtaining the authentication token.
 */
async function getAuthToken() {
    // Check if a valid cached token exists
    if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
        logger.log('Using cached auth token.');
        return authToken;
    }

    logger.log('Requesting a new auth token from DOSA server...');
    try {
        // Make a POST request to the authentication endpoint
        const response = await superagent
            .post(`${DOSA_MOT_HISTORY_API_URL}/authenticate`)
            .send({ apiKey: DOSA_API_KEY, apiSecret: DOSA_API_SECRET });

        // Check if the request was successful and the response contains a token
        if (response.status === 200 && response.body && response.body.token) {
            authToken = response.body.token;
            // Assuming the token has a 60-minute validity, set expiry to 59 minutes for safety.
            tokenExpiry = Date.now() + (59 * 60 * 1000);
            logger.log('New auth token obtained and cached.');
            return authToken;
        } else {
            logger.error('Error obtaining auth token:', response.status, response.body);
            throw new Error('Failed to obtain auth token from DOSA server.');
        }
    } catch (error) {
        logger.error('Error during auth token request:', error.message);
        throw error;
    }
}

/**
 * Asynchronously queries the MOT history of a vehicle given its registration number.
 * It first ensures a valid authentication token is available before making the API call.
 * @param {string} registrationNumber The registration number of the vehicle to query.
 * @returns {Promise<object|null>} A promise that resolves to the vehicle history data (object)
 * if found, or null if the vehicle is not found (404).
 * @throws {Error} If there is an error during the API call.
 */
async function getVehicleHistory(registrationNumber) {
    try {
        // Get a valid authentication token
        const token = await getAuthToken();
        logger.log(`Querying history for registration: ${registrationNumber}`);

        // Make a GET request to the vehicle history endpoint
        const response = await superagent
            .get(`${DOSA_MOT_HISTORY_API_URL}/vehicles/${encodeURIComponent(registrationNumber)}`)
            .set('Authorization', `Bearer ${token}`);

        // Handle different response statuses
        if (response.status === 200) {
            logger.log('Vehicle history retrieved successfully.');
            return response.body;
        } else if (response.status === 404) {
            logger.log(`Vehicle with registration '${registrationNumber}' not found.`);
            return null;
        } else {
            logger.error('Error querying vehicle history:', response.status, response.body);
            throw new Error(`Failed to query vehicle history: ${response.status}`);
        }
    } catch (error) {
        logger.error('Error during vehicle history query:', error.message);
        throw error;
    }
}
