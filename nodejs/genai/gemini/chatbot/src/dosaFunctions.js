const superagent = require('superagent');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

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
 * Retrieves an authentication token from the Microsoft OAuth2 server.
 *
 * This function checks if a valid cached token exists. If a valid token is found,
 * it returns the cached token. If not, it requests a new token from the Microsoft
 * authentication endpoint using the client credentials grant type.
 *
 * @async
 * @function getAuthToken
 * @param {string} tenantId - The tenant ID for the Azure Active Directory.
 * @param {string} clientId - The client ID of the application registered in Azure AD.
 * @param {string} clientSecret - The client secret associated with the application.
 * @param {string} scope - The scope for which the token is requested.
 * @param {string} apiKey - The API key to use.
 * @returns {Promise<string>} - A promise that resolves to the authentication token.
 * @throws {Error} - Throws an error if the token request fails.
 */
async function getAuthToken(
  tenantId,
  clientId,
  clientSecret,
  scope,
  apiKey,
) {
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  // Check if a valid cached token exists
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    return authToken;
  }

  if (!apiKey || !clientId || !clientSecret || !tenantId) {
    throw new Error('Parameters not specified');
  }

  try {
    // Make a POST request to the authentication endpoint
    const response = await superagent
      .post(authUrl)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('grant_type=client_credentials')
      .send(`client_id=${clientId}`)
      .send(`client_secret=${clientSecret}`)
      .send(`scope=${scope}`);

    // Check if the request was successful and the response contains a token
    if (response.status === 200 && response.body && response.body.access_token) {
      authToken = response.body.access_token;
      // Assuming the token has a 60-minute validity, set expiry to 59 minutes for safety.
      tokenExpiry = Date.now() + (59 * 60 * 1000);
      return authToken;
    }
    logger.error(`Error obtaining auth token: ${response.status} ${JSON.stringify(response.body)}`);
    throw new Error('Failed to obtain auth token from DOSA server.');
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
  const apiKey = process.env.DOSA_API_KEY;
  const clientId = process.env.DOSA_CLIENT_ID;
  const clientSecret = process.env.DOSA_API_SECRET;
  const tenantId = process.env.DOSA_AUTH_TENANT_ID;
  logger.debug('Invoking get MOT history');
  try {
    // Get a valid authentication token
    const token = await getAuthToken(
      tenantId,
      clientId,
      clientSecret,
      'https://tapi.dvsa.gov.uk/.default',
      apiKey,
    );

    if (!token) {
      throw new Error('Error: The authToken was not generated successfully');
    }

    const apiUrl = `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(registrationNumber)}`;

    // Make a GET request to the vehicle history endpoint
    const response = await superagent
      .get(apiUrl)
      .set('Authorization', `Bearer ${token}`)
      .set('X-API-Key', apiKey)
      .set('Accept', 'application/json');

    // Handle different response statuses
    if (response.status === 200) {
      return response.body;
    } if (response.status === 404) {
      logger.error(`Vehicle with registration '${registrationNumber}' not found.`);
      return null;
    }
    logger.error(`Error querying vehicle history: ${response.status} ${response.body}`);
    throw new Error(`Failed to query vehicle history: ${response.status}`);
  } catch (error) {
    logger.error(`Error during vehicle history query: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getVehicleHistory,
};
