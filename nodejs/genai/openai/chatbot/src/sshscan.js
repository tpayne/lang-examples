// Import the 'net' module for network operations
const net = require('net');
// Import the 'os' module to get operating system specific information, like network interfaces
const os = require('os');
// Import the logger module as per the getInfo.js pattern
const logger = require('./logger'); // Assumes logger.js is in the same directory or adjust path

**
 * Automatically determines the base IP address of the local network.
 * It looks for a non-internal IPv4 address.
 * @param {string} sessionId - A unique ID for the current scanning session (for logging).
 * @returns {string|null} The base IP address (e.g., '192.168.1') or null if not found.
 */
function getNetworkBaseIp(sessionId) {
    logger.info(`[Session: ${sessionId}] Attempting to determine network base IP automatically.`);
    const interfaces = os.networkInterfaces();
    let baseIp = null;

    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            // Check for IPv4, not internal (loopback), and a common private IP range
            if (addr.family === 'IPv4' && !addr.internal) {
                // Prioritize common private network ranges
                if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.') || addr.address.startsWith('172.16.')) {
                    const parts = addr.address.split('.');
                    if (parts.length === 4) {
                        baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;
                        logger.info(`[Session: ${sessionId}] Automatically detected base IP: ${baseIp} from interface ${interfaceName} (${addr.address})`);
                        return baseIp; // Return the first suitable one found
                    }
                }
            }
        }
    }
    logger.warn(`[Session: ${sessionId}] Could not automatically determine a suitable base IP address.`);
    return null; // Return null if no suitable IP is found
}

/**
 * Scans a range of IP addresses for open port 22 (SSH).
 * @param {string} sessionId - A unique ID for the current scanning session (for logging).
 * @param {string} baseIp - The base IP address (e.g., '192.168.1').
 * @param {number} startRange - The starting last octet of the IP range (e.g., 1).
 * @param {number} endRange - The ending last octet of the IP range (e.g., 254).
 * @param {number} port - The port to check (default is 22 for SSH).
 * @param {number} timeout - The connection timeout in milliseconds (default is 1000ms).
 */
async function scanNetworkForSSH(sessionId, baseIp, startRange, endRange, port = 22, timeout = 1000) {
    logger.info(`[Session: ${sessionId}] Starting network scan for SSH (port ${port}).`);

    if (!baseIp) {
        logger.error(`[Session: ${sessionId}] Error: Base IP address could not be determined automatically. Please set it manually.`);
        return;
    }

    logger.info(`[Session: ${sessionId}] Scanning network ${baseIp}.0 from ${baseIp}.${startRange} to ${baseIp}.${endRange}`);
    logger.info(`[Session: ${sessionId}] This may take some time depending on the range and network conditions...`);

    const openHosts = [];

    // Iterate through the specified IP range
    for (let i = startRange; i <= endRange; i++) {
        const ip = `${baseIp}.${i}`;
        // Use process.stdout.write for in-line progress updates without newlines,
        // as this is a UI-specific output not typically handled by a general logger.
        process.stdout.write(`\r[Session: ${sessionId}] Checking ${ip}...`);
        logger.debug(`[Session: ${sessionId}] Attempting connection to ${ip}:${port}`);

        try {
            // Use a Promise to handle the asynchronous nature of net.Socket
            const isOpen = await new Promise((resolve) => {
                const socket = new net.Socket();
                let connected = false; // Flag to ensure we only resolve once

                // Set a timeout for the connection attempt
                socket.setTimeout(timeout);

                // Event listener for successful connection
                socket.on('connect', () => {
                    if (!connected) { // Prevent multiple resolutions
                        connected = true;
                        logger.info(`\n[Session: ${sessionId}] [+] SSH port ${port} open on: ${ip}`);
                        socket.destroy(); // Close the socket immediately after connection
                        resolve(true);
                    }
                });

                // Event listener for connection timeout
                socket.on('timeout', () => {
                    if (!connected) { // Prevent multiple resolutions
                        logger.debug(`[Session: ${sessionId}] Timeout connecting to ${ip}:${port}`);
                        socket.destroy(); // Destroy the socket to prevent further events
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
            });

            if (isOpen) {
                openHosts.push(ip);
            }
        } catch (error) {
            // This catch block will primarily handle errors from the Promise itself,
            // though socket.on('error') is usually sufficient for connection issues.
            logger.error(`[Session: ${sessionId}] Unexpected error checking ${ip}: ${error.message}`);
        }
    }

    logger.info(`\n[Session: ${sessionId}] Scan complete!`);
    if (openHosts.length > 0) {
        logger.info(`[Session: ${sessionId}] Machines with SSH (port ${port}) open:`);
        openHosts.forEach(host => logger.info(`[Session: ${sessionId}] - ${host}`));
    } else {
        logger.info(`[Session: ${sessionId}] No machines with SSH (port ${port}) open found in the specified range.`);
    }
    return openHosts; // Return the list of open hosts
}

// Export the main scanning function and the IP detection function
module.exports = {
    scanNetworkForSSH,
};
