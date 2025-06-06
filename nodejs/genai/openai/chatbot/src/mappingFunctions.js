const superagent = require('superagent');
const dotenv = require('dotenv');
const logger = require('./logger'); // Assuming you have a logger module

dotenv.config(); // Load environment variables from .env file

/**
 * Generates an HTTP link to the Google Maps website for a given route.
 * Note: This link is for displaying the route on the Google Maps website/app,
 * not for embedding or using the Directions API result directly.
 *
 * @param {object} params - The original parameters used for the planRoute API call.
 * @param {string} params.origin - The starting point.
 * @param {string} params.destination - The ending point.
 * @param {string[]} [params.waypoints] - Optional array of intermediate locations.
 * @param {string} [params.mode] - Optional mode of transport (e.g., "driving", "walking").
 * @returns {string} The constructed Google Maps URL.
 */
async function generateGoogleMapsLink(params) {
  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  const queryParts = [];

  // Add origin and destination - URL encode them to handle spaces and special characters
  if (params.origin) {
    queryParts.push(`origin=${encodeURIComponent(params.origin)}`);
  }
  if (params.destination) {
    queryParts.push(`destination=${encodeURIComponent(params.destination)}`);
  }

  // Add waypoints if they exist - URL encode each one
  if (params.waypoints && params.waypoints.length > 0) {
    const encodedWaypoints = params.waypoints.map((wp) => encodeURIComponent(wp)).join('|');
    queryParts.push(`waypoints=${encodedWaypoints}`);
  }

  // Add mode if specified (optional)
  if (params.mode) {
    // Google Maps URL uses different mode names sometimes,
    // mapping Directions API modes to URL modes if necessary.
    let mapMode = params.mode;
    if (mapMode === 'bicycling') mapMode = 'bicycling'; // Same
    if (mapMode === 'transit') mapMode = 'transit'; // Same
    if (mapMode === 'walking') mapMode = 'walking'; // Same
    // 'driving' is the default and doesn't usually need to be specified,
    // but adding it doesn't hurt.
    if (mapMode === 'driving') mapMode = 'driving';

    queryParts.push(`travelmode=${mapMode}`);
  }

  // Join all parts with '&'
  return `${baseUrl}&${queryParts.join('&')}`;
}

/**
 * @typedef {object} DirectionsParameters
 * @property {string} origin - The starting point for the directions request.
 * @property {string} destination - The ending point for the directions request.
 * @property {string[]} [waypoints] - An array of intermediate locations to include
 * in the route.
 * @property {string} [mode] - Specifies the mode of transport. (e.g., "driving",
 * "walking", "bicycling", "transit")
 * @property {string} [language] - The language to use for the results.
 * @property {string} [units] - Specifies the unit system to use. (e.g., "metric",
 * "imperial")
 * @property {boolean} [alternatives] - If true, more than one route may be returned.
 * @property {string} [avoid] - Indicates features to avoid. (e.g., "tolls", "highways",
 * "ferries", "indoor")
 * @property {string} [transit_mode] - Specifies the desired modes of transit. (e.g.,
 * "bus", "subway", "train", "tram", "rail")
 * @property {string} [transit_routing_preference] - Specifies preferences for transit
 * routes. (e.g., "less_walking", "fewer_transfers")
 * @property {string} [departure_time] - The desired time of departure. Can be a
 * timestamp or "now".
 * @property {string} [arrival_time] - The desired time of arrival (for transit).
 * Can be a timestamp.
 * @property {string} [traffic_model] - Specifies the assumptions to use when calculating
 * time in traffic. (e.g., "best_guess", "optimistic", "pessimistic")
 * @property {boolean} [optimizeWaypoints] - If true and waypoints are provided, the
 * API will attempt to reorder the waypoints to minimize the total travel time.
 */

/**
 * Plans a route between multiple points using the Google Maps Directions API.
 *
 * @async
 * @function planRoute
 * @param {string} sessionId - The unique identifier for the session (if
 * needed for logging or context).
 * @param {DirectionsParameters} params - An object containing the parameters
 * for the directions request.
 * @returns {Promise<object|null>} A promise that resolves to the route data
 * (object) in JSON format,
 * or null if the route cannot be planned.
 * @throws {Error} If there is an error during the API call or if the API key is
 * missing.
 */
async function planRoute(sessionId, params) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Ensure your API key is in your .env file
  if (!apiKey) {
    logger.error(`Google Maps API Key not found in environment variables [Session: ${sessionId}]`);
    throw new Error('Google Maps API Key is not configured.');
  }

  const apiUrl = 'https://maps.googleapis.com/maps/api/directions/json';

  // Construct the query parameters
  const queryParams = {
    origin: params.origin,
    destination: params.destination,
    key: apiKey,
  };

  // Add optional parameters if they exist
  if (params.waypoints && params.waypoints.length > 0) {
    // Join waypoints with '|' for the API
    queryParams.waypoints = params.waypoints.join('|');
    if (params.optimizeWaypoints) {
      queryParams.waypoints = `optimize:true|${queryParams.waypoints}`;
    }
  }
  if (params.mode) queryParams.mode = params.mode;
  if (params.language) queryParams.language = params.language;
  if (params.units) queryParams.units = params.units;
  if (params.alternatives !== undefined) queryParams.alternatives = params.alternatives;
  if (params.avoid) queryParams.avoid = params.avoid;
  if (params.transit_mode) queryParams.transit_mode = params.transit_mode;
  if (params.transit_routing_preference) {
    queryParams.transit_routing_preference = params.transit_routing_preference;
  }
  if (params.departure_time) queryParams.departure_time = params.departure_time;
  if (params.arrival_time) queryParams.arrival_time = params.arrival_time;
  if (params.traffic_model) queryParams.traffic_model = params.traffic_model;

  logger.debug(`Invoking Google Maps Directions API [Session: ${sessionId}] `
    + `with params: ${JSON.stringify(queryParams)}`);

  try {
    const response = await superagent
      .get(apiUrl)
      .query(queryParams)
      .set('Accept', 'application/json');

    // Handle different response statuses and API specific statuses
    if (response.status === 200) {
      const data = response.body;
      if (data.status === 'OK') {
        return data; // Return the full JSON response
      }
      logger.error(`Google Maps Directions API error [Session: ${sessionId}]: `
        + `Status - ${data.status}, Error Message - ${data.error_message || 'No error message provided'}`);
      // Return the error response from the API for the chatbot to handle
      return data;
    }
    logger.error(`Error querying Google Maps Directions API [Session: ${sessionId}]: `
      + `Status - ${response.status}, Response - ${JSON.stringify(response.body)}`);
    throw new Error(`Failed to query Google Maps Directions API: ${response.status}`);
  } catch (error) {
    logger.error(`Error during Google Maps Directions API query [Session: ${sessionId}]: `
      + `${error.message}`);
    throw error;
  }
}

module.exports = {
  generateGoogleMapsLink,
  planRoute,
};
