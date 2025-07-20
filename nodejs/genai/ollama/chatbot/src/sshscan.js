// Import the 'net' module for network operations
const net = require('net');
// Import the 'os' module to get operating system specific information, like network interfaces
const os = require('os');
// Import the logger module as per the getInfo.js pattern
const logger = require('./logger'); // Assumes logger.js is in the same directory or adjust path

/**
 * Automatically determines the base IP address of the local network.
 * It looks for a non-internal IPv4 address.
 * @param {string} sessionId - A unique ID for the current scanning session (for logging).
 * @returns {string|null} The base IP address (e.g., '192.168.1') or null if not found.
 */
function getNetworkBaseIp(sessionId) {
  logger.info(`[Session: ${sessionId}] Attempting to determine network base IP automatically.`);
  const interfaces = os.networkInterfaces();
  let foundBaseIp = null;

  // Use Object.keys() and .some() for safer iteration with early exit capability
  Object.keys(interfaces).some((interfaceName) => {
    const addresses = interfaces[interfaceName];
    // Use .some() for array iteration with early exit capability
    addresses.some((addr) => {
      // Check for IPv4, not internal (loopback), and a common private IP range
      if (addr.family === 'IPv4' && !addr.internal) {
        // Prioritize common private network ranges
        if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.') || addr.address.startsWith('172.16.')) {
          const parts = addr.address.split('.');
          if (parts.length === 4) {
            foundBaseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;
            return true; // Return true to stop the inner .some() loop
          }
        }
      }
      return false; // Return false to continue to the next address in the inner loop
    });
    return !!foundBaseIp; // Return true to stop the outer .some() loop if foundBaseIp is set
  });
  return foundBaseIp;
}

/**
 * Scans a given IP range for machines with an open SSH port.
 * @param {string} sessionId - A unique ID for the current scanning session (for logging).
 * @param {string} baseIp - The base IP address (e.g., '192.168.1').
 * @param {number} startRange - The starting last octet of the IP range (e.g., 1).
 * @param {number} endRange - The ending last octet of the IP range (e.g., 254).
 * @param {number} port - The SSH port to check (default: 22).
 * @param {number} timeout - Connection timeout in milliseconds (default: 1000).
 * @returns {Promise<string[]>} A promise that resolves to an array of IPs with open SSH ports.
 */
async function scanNetworkForSSH(sessionId, baseIp, startRange = 1, endRange = 254, port = 22, timeout = 1000) {
  logger.info(`[Session: ${sessionId}] Starting SSH network scan for ${baseIp}.0/${startRange}-${endRange} on port ${port} with timeout ${timeout}ms.`);
  const openHosts = [];
  const promises = []; // Array to hold all connection promises
  let baseIpProvided = !!baseIp; // Check if baseIp is provided

  if (!baseIpProvided) {
    logger.debug(`[Session: ${sessionId}] No base IP provided. Attempting to auto-detect...`);
    baseIpProvided = getNetworkBaseIp(sessionId);
    if (!baseIpProvided) {
      logger.error(`[Session: ${sessionId}] Unable to determine base IP address. Exiting scan.`);
      return openHosts; // Return empty array if no base IP found
    }
  }

  for (let i = startRange; i <= endRange; i += 1) { // Changed i++ to i += 1
    const ip = `${baseIp}.${i}`;

    // Create a promise for each IP check and add it to the array
    promises.push(new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;

      // Set a timeout for the connection attempt
      socket.setTimeout(timeout);

      // Event listener for successful connection
      socket.on('connect', () => {
        connected = true;
        logger.debug(`[Session: ${sessionId}] SSH port ${port} open on ${ip}`);
        socket.destroy(); // Close the socket immediately after connection
        resolve(true);
      });

      // Event listener for connection timeout
      socket.on('timeout', () => {
        if (!connected) {
          logger.debug(`[Session: ${sessionId}] Connection to ${ip}:${port} timed out.`);
          socket.destroy(); // Destroy the socket
          resolve(false);
        }
      });

      // Event listener for connection errors (e.g., host unreachable, connection refused)
      socket.on('error', (err) => {
        if (!connected) { // Prevent multiple resolutions
          logger.debug(`[Session: ${sessionId}] Error connecting to ${ip}:${port}: ${err.message}`);
          socket.destroy(); // Destroy the socket
          resolve(false);
        }
      });

      // Attempt to connect to the target IP and port
      socket.connect(port, ip);
    }));
  }

  // Await all promises concurrently
  const results = await Promise.all(promises);

  // Process results to populate openHosts
  for (let i = 0; i < results.length; i += 1) { // Changed i++ to i += 1
    if (results[i]) { // If the promise resolved to true (connection open)
      openHosts.push(`${baseIp}.${startRange + i}`); // Reconstruct IP based on original range and index
    }
  }

  logger.info(`\n[Session: ${sessionId}] Scan complete!`);
  if (openHosts.length > 0) {
    logger.info(`[Session: ${sessionId}] Machines with SSH (port ${port}) open:`);
    openHosts.forEach((host) => logger.info(`[Session: ${sessionId}] - ${host}`));
  } else {
    logger.info(`[Session: ${sessionId}] No machines with SSH (port ${port}) open found in the specified range.`);
  }
  return openHosts; // Consistent return
}

// Export the main scanning function and the IP detection function
module.exports = {
  scanNetworkForSSH,
};
