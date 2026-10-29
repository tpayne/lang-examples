// Import the 'net' module for network operations
const net = require('net');
// Import the 'os' module to get operating system specific information, like network interfaces
const os = require('os');
// Import the logger module
// Import dns for reverse lookups and util to promisify dns.reverse
const dns = require('dns');
const util = require('util');
const logger = require('./logger'); // Assumes logger.js is in the same directory or adjust path

// Promisify dns.reverse for async/await usage
const reversePromise = util.promisify(dns.reverse);

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
 * @returns {Promise<Array<{ip: string, hostname: string | null}>>} A promise that resolves to an array of objects
 * with IP addresses and their corresponding hostnames (or null if not found) for open SSH ports.
 */
async function scanNetworkForSSH(sessionId, baseIp, startRange = 1, endRange = 254, port = 22, timeout = 1000) {
  const openHosts = [];

  let effectiveBaseIp = baseIp;
  if (!effectiveBaseIp) {
    logger.debug(`[Session: ${sessionId}] No base IP provided. Attempting to auto-detect...`);
    effectiveBaseIp = getNetworkBaseIp(sessionId);
    if (!effectiveBaseIp) {
      logger.error(`[Session: ${sessionId}] Unable to determine base IP address. Exiting scan.`);
      return openHosts;
    }
  }

  logger.info(`[Session: ${sessionId}] Starting SSH network scan for ${effectiveBaseIp}.0/${startRange}-${endRange} on port ${port} with timeout ${timeout}ms.`);

  const connectionPromises = [];

  for (let i = startRange; i <= endRange; i += 1) {
    const ip = `${effectiveBaseIp}.${i}`;

    connectionPromises.push(new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false; // Flag to ensure promise is resolved only once
      let bannerHostname = null;

      // Helper to resolve the promise
      const finishConnection = (success, hostname = null) => {
        if (!resolved) {
          resolved = true;
          socket.destroy(); // Ensure socket is closed
          resolve({ ip, success, bannerHostname: hostname });
        }
      };

      socket.setTimeout(timeout);

      // On successful connection
      socket.on('connect', () => {
        logger.debug(`[Session: ${sessionId}] SSH port ${port} open on ${ip}. Waiting for banner...`);
        // Do not resolve yet, wait for banner data or subsequent timeout/error
      });

      // On data received (expecting banner)
      socket.on('data', (data) => {
        const banner = data.toString().split('\n')[0]; // Get the first line
        // Use array destructuring as per ESLint's 'prefer-destructuring' rule
        // The first element of the array is the full match, the second is the first capturing group.
        // Use || [] to handle cases where match() returns null (no match found)
        const [, capturedHostname] = banner.match(/^SSH-2\.0-\S+\s(\S+)/) || [];

        if (capturedHostname) { // Check if the captured group is not undefined/null
          bannerHostname = capturedHostname;
          logger.debug(`[Session: ${sessionId}] Found banner hostname for ${ip}: ${bannerHostname}`);
        }
        finishConnection(true, bannerHostname); // Resolve with success and captured banner hostname
      });

      // On timeout
      socket.on('timeout', () => {
        logger.debug(`[Session: ${sessionId}] Connection to ${ip}:${port} timed out.`);
        finishConnection(false); // Resolve as failure
      });

      // On error
      socket.on('error', (err) => {
        logger.debug(`[Session: ${sessionId}] Error connecting to ${ip}:${port}: ${err.message}`);
        finishConnection(false); // Resolve as failure
      });

      // Attempt to connect
      socket.connect(port, ip);
    }));
  }

  // Await all connection and banner-read promises concurrently
  const connectionResults = await Promise.all(connectionPromises);

  const hostnameResolutionTasks = connectionResults
    .filter((result) => result.success) // Only process successfully connected IPs
    .map(async (result) => {
      let hostname = null;
      try {
        const dnsHostnames = await reversePromise(result.ip);
        hostname = dnsHostnames[0] || null; // Prefer DNS hostname
        if (hostname) {
          logger.debug(`[Session: ${sessionId}] Resolved hostname via DNS for ${result.ip}: ${hostname}`);
        } else {
          logger.debug(`[Session: ${sessionId}] No DNS hostname for ${result.ip}.`);
        }
      } catch (err) {
        logger.debug(`[Session: ${sessionId}] DNS error for ${result.ip}: ${err.message}`);
      }

      // Fallback to banner hostname if DNS lookup failed
      if (!hostname && result.bannerHostname) {
        hostname = result.bannerHostname;
        logger.debug(`[Session: ${sessionId}] Falling back to banner hostname for ${result.ip}: ${hostname}`);
      }

      return { ip: result.ip, hostname };
    });

  const resolvedHosts = await Promise.all(hostnameResolutionTasks);
  openHosts.push(...resolvedHosts); // Add all resolved hosts to openHosts

  logger.info(`\n[Session: ${sessionId}] Scan complete!`);
  if (openHosts.length > 0) {
    logger.info(`[Session: ${sessionId}] Machines with SSH (port ${port}) open:`);
    openHosts.forEach((host) => logger.info(`[Session: ${sessionId}] - ${host.ip}${host.hostname ? ` (${host.hostname})` : ''}`));
  } else {
    logger.info(`[Session: ${sessionId}] No machines with SSH (port ${port}) open found in the specified range.`);
  }
  return openHosts;
}

// Export the main scanning function and the IP detection function
module.exports = {
  scanNetworkForSSH,
};
