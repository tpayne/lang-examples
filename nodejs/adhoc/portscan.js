// Import the 'net' module for network operations
const net = require('net');
// Import the 'os' module to get operating system specific information, like network interfaces
const os = require('os');

/**
 * Scans a range of IP addresses for open port 22 (SSH).
 * @param {string} baseIp - The base IP address (e.g., '192.168.1').
 * @param {number} startRange - The starting last octet of the IP range (e.g., 1).
 * @param {number} endRange - The ending last octet of the IP range (e.g., 254).
 * @param {number} port - The port to check (default is 22 for SSH).
 * @param {number} timeout - The connection timeout in milliseconds (default is 1000ms).
 */
async function scanNetworkForSSH(baseIp, startRange, endRange, port = 22, timeout = 1000) {
    if (!baseIp) {
        console.error('Error: Base IP address could not be determined automatically. Please set it manually.');
        return;
    }

    console.log(`Starting scan for SSH (port ${port}) on network ${baseIp}.0 from ${baseIp}.${startRange} to ${baseIp}.${endRange}`);
    console.log('This may take some time depending on the range and network conditions...');

    const openHosts = [];

    // Iterate through the specified IP range
    for (let i = startRange; i <= endRange; i++) {
        const ip = `${baseIp}.${i}`;
        process.stdout.write(`\rChecking ${ip}...`); // Provide feedback on current IP being scanned

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
                        console.log(`\n[+] SSH port ${port} open on: ${ip}`);
                        socket.destroy(); // Close the socket immediately after connection
                        resolve(true);
                    }
                });

                // Event listener for connection timeout
                socket.on('timeout', () => {
                    if (!connected) { // Prevent multiple resolutions
                        socket.destroy(); // Destroy the socket to prevent further events
                        resolve(false);
                    }
                });

                // Event listener for connection errors (e.g., host unreachable, connection refused)
                socket.on('error', (err) => {
                    if (!connected) { // Prevent multiple resolutions
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
            console.error(`\nError checking ${ip}: ${error.message}`);
        }
    }

    console.log('\nScan complete!');
    if (openHosts.length > 0) {
        console.log('\nMachines with SSH (port 22) open:');
        openHosts.forEach(host => console.log(`- ${host}`));
    } else {
        console.log('\nNo machines with SSH (port 22) open found in the specified range.');
    }
}

/**
 * Automatically determines the base IP address of the local network.
 * It looks for a non-internal IPv4 address.
 * @returns {string|null} The base IP address (e.g., '192.168.1') or null if not found.
 */
function getNetworkBaseIp() {
    const interfaces = os.networkInterfaces();
    let baseIp = null;

    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            // Check for IPv4, not internal (loopback), and a common private IP range
            // This prioritizes non-loopback, external-facing IPs
            if (addr.family === 'IPv4' && !addr.internal) {
                // Simple check for common private network ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
                // This helps in picking a relevant network interface if multiple exist
                if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.') || addr.address.startsWith('172.16.')) {
                     // Extract the first three octets
                    const parts = addr.address.split('.');
                    if (parts.length === 4) {
                        baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;
                        console.log(`Automatically detected base IP: ${baseIp} from interface ${interfaceName} (${addr.address})`);
                        return baseIp; // Return the first suitable one found
                    }
                }
            }
        }
    }
    console.warn('Could not automatically determine a suitable base IP address.');
    return null; // Return null if no suitable IP is found
}

// --- Configuration ---
// The BASE_IP will now be determined automatically.
// If automatic detection fails, you might need to uncomment and set it manually.
const AUTO_DETECTED_BASE_IP = getNetworkBaseIp();
const START_RANGE = 1;       // Start of the last octet (e.g., 1 for .1)
const END_RANGE = 254;       // End of the last octet (e.g., 254 for .254)
const SSH_PORT = 22;         // SSH default port
const CONNECTION_TIMEOUT = 500; // Milliseconds to wait for a connection attempt

// Call the scanning function with the automatically detected base IP
scanNetworkForSSH(AUTO_DETECTED_BASE_IP, START_RANGE, END_RANGE, SSH_PORT, CONNECTION_TIMEOUT);

