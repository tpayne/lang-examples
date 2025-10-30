/**
 * @fileoverview Financial API Functions for Finage Stock Data.
 *
 * This module contains utility functions for integrating with the Finage REST API
 * to retrieve aggregated stock market data. These tools are designed to be callable
 * by the chatbot to facilitate financial analysis, trend identification, and
 * stock prediction tasks.
 *
 * It requires the 'superagent' library for making HTTP requests and relies on the
 * FINAGE_API_KEY environment variable for authentication.
 */
const superagent = require('superagent');
const logger = require('./logger'); // Assuming a logger utility exists

// Finage API specific constants - these would ideally come from environment variables or configuration
// The FINAGE_API_KEY must be set in the environment for this function to work.
const FINAGE_API_URL = 'https://api.finage.co.uk';
const { FINAGE_API_KEY } = process.env;

/**
 * Retrieves the last known stock price and timestamp for a specified UK stock symbol.
 *
 * This function is ideal for quickly checking the most recent trading price for a stock
 * for real-time analysis or immediate decision-making.
 *
 * @function getLastStockPrice
 * @param {string} symbol - The UK stock symbol (e.g., 'BP', 'HSBA', 'BARC').
 * @returns {Promise<object>} A promise that resolves to the last price data, containing fields like
 * 'symbol', 'price', and 'timestamp' (in milliseconds).
 * @throws {Error} If the FINAGE_API_KEY is missing or the request fails.
 */
async function getLastStockPrice(symbol) {
  if (!FINAGE_API_KEY) {
    throw new Error('FINAGE_API_KEY environment variable is not set. Cannot fetch stock data.');
  }

  // Input validation (basic example)
  if (!symbol) {
    throw new Error('The stock symbol parameter is required.');
  }

  try {
    // Construct the API URL based on the Finage documentation
    const url = `${FINAGE_API_URL}/last/stock/uk/${symbol}`;
    logger.debug(`Fetching Finage last stock price for ${symbol}`);

    const response = await superagent
      .get(url)
      // The API key is passed as a query parameter
      .query({ apikey: FINAGE_API_KEY })
      .set('User-Agent', 'AIBot-Financial-Tool')
      .set('Accept', 'application/json');

    // Finage returns a JSON object, so we return the body directly
    return response.body;
  } catch (err) {
    logger.error(`Failed to fetch last stock price for ${symbol}: ${err.message}`, err);
    if (err.response) {
      logger.error(`Finage API response error: ${err.response.text}`);
      throw new Error(`Finage API error for ${symbol}: ${err.response.text}`);
    }
    throw err;
  }
}

/**
 * Retrieves aggregated UK stock market data for a given symbol over a specified time period.
 *
 * This function fetches aggregated data, which includes daily or intraday price action (Open, High, Low, Close)
 * and volume, essential for historical analysis, identifying price trends, and calculating technical indicators.
 *
 * @function getAggregatedStockData
 * @param {string} symbol - The UK stock symbol (e.g., 'BP', 'HSBA', 'BARC').
 * @param {'1min'|'5min'|'1h'|'1day'} time - The aggregation period (e.g., '1min', '1day').
 * @param {string} from - The start date for the aggregation period in 'YYYY-MM-DD' format (e.g., '2025-06-01').
 * @param {string} to - The end date for the aggregation period in 'YYYY-MM-DD' format (e.g., '2025-06-05').
 * @returns {Promise<object>} - A promise that resolves with the aggregated stock data. The object contains:
 * - symbol: The stock symbol.
 * - totalResults: The number of results returned.
 * - results: An array of objects, where each object has properties 'o' (open), 'h' (high), 'l' (low), 'c' (close), 'v' (volume), and 't' (timestamp in milliseconds).
 * @throws {Error} If the FINAGE_API_KEY is missing or the request fails.
 */
async function getAggregatedStockData(symbol, time, from, to) {
  if (!FINAGE_API_KEY) {
    throw new Error('FINAGE_API_KEY environment variable is not set. Cannot fetch stock data.');
  }

  // Input validation (basic example)
  if (!symbol || !time || !from || !to) {
    throw new Error('All parameters (symbol, time, from, to) are required.');
  }

  try {
    // Construct the API URL based on the Finage documentation
    const url = `${FINAGE_API_URL}/agg/stock/global/uk/${symbol}/${time}/${from}/${to}`;
    logger.debug(`Fetching Finage aggregated stock data for ${symbol} from ${from} to ${to} with time interval ${time}`);

    const response = await superagent
      .get(url)
      // The API key is passed as a query parameter
      .query({ apikey: FINAGE_API_KEY })
      .set('User-Agent', 'AIBot-Financial-Tool')
      .set('Accept', 'application/json');

    // Finage returns a JSON object, so we return the body directly
    return response.body;
  } catch (err) {
    logger.error(`Failed to fetch aggregated stock data for ${symbol}: ${err.message}`, err);
    if (err.response) {
      logger.error(`Finage API response error: ${err.response.text}`);
      throw new Error(`Finage API error for ${symbol}: ${err.response.text}`);
    }
    // Re-throw other errors (network issues, etc.)
    throw err;
  }
}

module.exports = {
  getAggregatedStockData,
  getLastStockPrice,
};
