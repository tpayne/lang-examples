const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs/promises'); // Use fs.promises for async file operations
const logger = require('./logger');

// Promisify the exec function for easier async/await usage
const execPromise = util.promisify(exec);

let USE_SSH_FOR_HOST_INFO = false;
let SSH_HOST_USER = '';
let SSH_HOST_IP = '';
let SSH_HOST_PASSWORD = ''; // WARNING: Storing and passing passwords directly is INSECURE.

// Docker secret path for the SSH password map
// This file is expected to contain a JSON object where keys are "user@hostname" and values are passwords.
const SSH_PASSWORD_MAP_SECRET_PATH = '/run/secrets/ssh_password_map';

const {
  checkIfRunningInDocker,
} = require('./utilities');

// Detected OS information for the target host
const detectedOS = {
  platform: os.platform(), // 'linux', 'darwin', 'freebsd', etc. (initially container's)
  type: os.type(), // 'Linux', 'Darwin', 'FreeBSD', etc.
  distro: 'Unknown', // e.g., 'Ubuntu', 'CentOS', 'macOS'
  version: 'Unknown',
  kernel: 'Unknown',
};

/**
 * Maps common system information commands to their OS-specific variants or preferred tools.
 * Prioritizes commands that provide structured output (e.g., JSON) if available.
 * Each key is a conceptual command (e.g., 'os_release_info'), and its value is an object
 * mapping OS platforms to an array of commands to try, in order of preference.
 */
const commandMap = {
  linux_platform: {
    linux: ['uname -s'],
    darwin: ['uname -s'],
    freebsd: ['uname -s'],
    openbsd: ['uname -s'],
    netbsd: ['uname -s'],
    sunos: ['uname -s'],
    aix: ['uname -s'],
  },
  // General OS release information
  os_release_info: {
    linux: ['cat /etc/os-release', 'cat /etc/lsb-release', 'cat /etc/redhat-release'],
    darwin: ['sw_vers'],
    freebsd: ['freebsd-version'],
    openbsd: ['sysctl kern.version'], // Similar to uname -a, but more specific for version
    netbsd: ['sysctl kern.version'],
    sunos: ['cat /etc/release'], // Solaris/illumos
    aix: ['oslevel -s'],
  },
  // Kernel version and details
  kernel_version_info: {
    linux: ['uname -a'],
    darwin: ['uname -a'],
    freebsd: ['uname -a'],
    openbsd: ['uname -a'],
    netbsd: ['uname -a'],
    sunos: ['uname -a'],
    aix: ['uname -a'],
  },
  // CPU information
  cpu_info: {
    linux: ['lscpu', 'cat /proc/cpuinfo'],
    darwin: ['sysctl -n machdep.cpu.brand_string', 'sysctl -n hw.ncpu'], // Brand string, number of cores
    freebsd: ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    openbsd: ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    netbsd: ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    sunos: ['psrinfo -pv'],
    aix: ['prtconf | grep "Processor Type"'],
  },
  // Memory information
  memory_info: {
    linux: ['free -h', 'cat /proc/meminfo'],
    darwin: ['sysctl -n hw.memsize', 'sysctl -n hw.pagesize'], // Need to calculate total/free
    freebsd: ['sysctl -n hw.physmem', 'sysctl -n vm.stats.vm.v_free_pages'],
    openbsd: ['sysctl -n hw.physmem'],
    netbsd: ['sysctl -n hw.physmem'],
    sunos: ['prtconf | grep "Memory size"'],
    aix: ['lsattr -El mem0 | grep size'],
  },
  // Disk usage and block devices
  disk_info: {
    linux: ['df -h', 'lsblk -J', 'fdisk -l'], // lsblk -J for JSON
    darwin: ['df -h', 'diskutil list -plist'], // plist for structured output
    freebsd: ['df -h', 'gpart show'],
    openbsd: ['df -h', 'disklabel'],
    netbsd: ['df -h', 'disklabel'],
    sunos: ['df -h', 'format'],
    aix: ['df -g', 'lspv'],
  },
  // Running processes
  process_info: {
    linux: ['ps aux', 'top -bn1 | head -n 20'],
    darwin: ['ps aux | head -n 75', 'top -l 1 | head -n 20'], // Generally, there are too many processes to show all as AI hits limit
    freebsd: ['ps aux', 'top -b | head -n 20'],
    openbsd: ['ps aux', 'top -b | head -n 20'],
    netbsd: ['ps aux', 'top -b | head -n 20'],
    sunos: ['ps -ef', 'prstat -n 20 1 1'],
    aix: ['topas -P'],
  },
  // Network services (listening ports)
  network_services_info: {
    linux: ['ss -tulnp', 'netstat -tulnp', 'lsof -i -P -n'], // ss is often preferred
    darwin: ['lsof -i -P -n', 'netstat -anv'],
    freebsd: ['sockstat -46l', 'netstat -an'],
    openbsd: ['sockstat -46l', 'netstat -an'],
    netbsd: ['sockstat -46l', 'netstat -an'],
    sunos: ['netstat -an', 'fuser -n tcp', 'fuser -n udp'],
    aix: ['netstat -an', 'rmsock'],
  },
  // Hardware info (lshw, dmidecode)
  hardware_info: {
    linux: ['lshw -json', 'dmidecode'],
    darwin: ['system_profiler SPHardwareDataType -json'], // Structured hardware data
    // BSDs generally rely on sysctl, dmesg, or specific tools for hardware info
    freebsd: ['pciconf -lv', 'dmidecode', 'dmesg | grep "CPU:"'],
    openbsd: ['pciconf -lv', 'dmesg | grep "CPU:"'],
    netbsd: ['pciconf -lv', 'dmesg | grep "CPU:"'],
    sunos: ['prtconf -v'],
    aix: ['prtconf -v'],
  },
  // Kernel modules/extensions
  kernel_modules_info: {
    linux: ['lsmod'],
    darwin: ['kextstat'], // macOS kernel extensions
    freebsd: ['kldstat'],
    openbsd: ['sysctl kern.modules'], // Less detailed, but available
    netbsd: ['modstat'],
    sunos: ['modinfo'],
    aix: ['genkex'],
  },
  // System control parameters
  sysctl_info: {
    linux: ['sysctl -a'],
    darwin: ['sysctl -a'],
    freebsd: ['sysctl -a'],
    openbsd: ['sysctl -a'],
    netbsd: ['sysctl -a'],
    sunos: ['sysdef'], // Different command for system definition
    aix: ['lsattr -El sys0'], // System attributes
  },
  hostname: {
    linux: ['hostname', 'uname -n'],
    darwin: ['hostname', 'uname -n'],
    freebsd: ['hostname', 'uname -n'],
    openbsd: ['hostname', 'uname -n'],
    netbsd: ['hostname', 'uname -n'],
    sunos: ['hostname', 'uname -n'],
    aix: ['hostname', 'uname -n'],
  },
  // Network interface configuration (legacy/modern)
  network_interface_config: {
    linux: ['ip addr show', 'ifconfig -a'], // ip is preferred
    darwin: ['ifconfig -a'],
    freebsd: ['ifconfig -a'],
    openbsd: ['ifconfig -a'],
    netbsd: ['ifconfig -a'],
    sunos: ['ifconfig -a'],
    aix: ['netstat -in'],
  },
  // Package management info (heuristic)
  package_manager_info: {
    linux: ['dpkg -l', 'rpm -qa', 'yum list installed', 'apt list --installed', 'pacman -Q'],
    darwin: ['pkgutil --pkgs', '/opt/homebrew/bin/brew list'], // Homebrew
    // BSDs have their own package managers (pkg, ports), but no single command to list all
  },
  // Add this new entry for listing all services across different OS types
  list_all_services: {
    linux: [
      'systemctl list-units --type=service --all --no-pager', // For systemd-based Linux (e.g., Ubuntu, CentOS)
      'rc-service --list', // For OpenRC-based Linux (e.g., Alpine)
      'rc-status --all', // For OpenRC-based Linux (e.g., Alpine)
      'service --status-all', // For SysVinit-based Linux
      'chkconfig --list', // For SysVinit-based Linux (e.g., CentOS/RHEL)
      'ls /etc/init.d/', // List init scripts
      'ls /etc/systemd/system/', // List systemd service files
    ],
    darwin: [ // For macOS, using launchctl to list user agents and daemons
      'launchctl list',
    ],
    freebsd: [ // For FreeBSD, using service command
      'service -e', // List all enabled services
      'service -l', // List all services
    ],
    openbsd: [ // For OpenBSD, using rcctl to list services
      'rcctl ls', // List all services
    ],
    netbsd: [ // For NetBSD, using rcorder to list services
      'rcorder /etc/rc.d/*', // List all services in order
    ],
    sunos: [ // For Solaris/Illumos, using svcs to list services
      'svcs -a', // List all services
    ],
    aix: [ // For AIX, using lssrc to list services
      'lssrc -a', // List all services
    ],
  },
};

/**
 * Executes a shell command.
 * @param {string} commandKey - The key from `commandMap` representing the desired information.
 * @param {boolean} [targetHost=false] - If true, attempts to run the command on the host.
 * @param {string} [overridePlatform=detectedOS.platform] - Allows overriding the detected platform for command selection.
 * @returns {Promise<string|null>} - The stdout of the command, or null if an error occurs.
 */
async function runCommand(commandKey, targetHost = false, overridePlatform = detectedOS.platform) {
  const commandsToTry = (commandMap[commandKey] && commandMap[commandKey][overridePlatform]) || [commandKey];
  let executionContext = 'container';
  let prefix = '';

  if (targetHost) {
    if (USE_SSH_FOR_HOST_INFO) {
      prefix = `sshpass -p '${SSH_HOST_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SSH_HOST_USER}@${SSH_HOST_IP} `;
      executionContext = 'host via SSH';
    } else if (checkIfRunningInDocker() && overridePlatform === 'linux') {
      executionContext = 'local host';
    } else {
      // Not in Docker and not using SSH, implies the script is running directly on the desired host.
      executionContext = 'local host';
    }
  }

  logger.debug(`Attempting to execute "${commandsToTry}"`);
  logger.debug(`For commandKey "${commandKey}" on platform "${overridePlatform}"`);
  logger.debug(`With targetHost=${targetHost} using executionContext="${executionContext}"`);

  // Refactored to avoid 'for' loop and 'await-in-loop'
  async function executeCommandSequentially(index) {
    if (index >= commandsToTry.length) {
      logger.warn(`All attempts to get info for "${commandKey}" on ${overridePlatform} failed.`);
      return 'N/A'; // All commands failed
    }

    const cmd = commandsToTry[index];
    const finalCommand = `${prefix}${cmd}`;

    let loggableCommand = finalCommand;
    if (USE_SSH_FOR_HOST_INFO) {
      loggableCommand = finalCommand.replace(/-p '.*?'/, '').trim(); // Remove password from the command entirely
    }
    logger.debug(`Attempting to execute (${executionContext}): ${loggableCommand}`);

    try {
      const { stdout } = await execPromise(finalCommand, { shell: '/bin/bash', timeout: 20000, killSignal: 'SIGTERM' });
      return stdout.trim(); // Return on first success
    } catch (error) {
      let errorLogCommand = finalCommand;
      let errorMessage = error.message || 'Unknown error';
      if (USE_SSH_FOR_HOST_INFO) {
        errorLogCommand = finalCommand.replace(/-p '.*?'/, '').trim();
        errorMessage = error.message.replace(/-p '.*?'/, '').trim();
      }
      logger.debug(`Command failed (${executionContext}): "${errorLogCommand}" - ${errorMessage}`);

      if (executionContext === 'host via SSH') {
        if (error.message.includes('Permission denied')) {
          logger.error('SSH Permission Denied. Check user, password, and host permissions.');
          return 'N/A';
        } if (error.message.includes('No route to host') || error.message.includes('Connection refused')) {
          logger.error('SSH Connection Failed. Check host IP, firewall, and SSH service status.');
          return 'N/A';
        } if (error.message.includes('sshpass: command not found')) {
          logger.error('sshpass is not installed in the container. Please install it.');
          return 'N/A';
        }
      }
      return executeCommandSequentially(index + 1);
    }
  }
  return executeCommandSequentially(0); // Start the execution sequence
}

/**
 * Detects the operating system of the target host.
 * This function will be called once at the beginning of collectSystemInfo
 * to set `detectedOS` for subsequent command selections.
 * @param {boolean} isTargetHost - True if detecting the host OS (via SSH), false for container OS.
 */
async function detectOperatingSystem(isTargetHost = false) {
  let platform = 'Unknown';
  let type = 'Unknown';

  logger.debug(`[detectOperatingSystem] isTargetHost: ${isTargetHost}`);

  try {
    // Ensure this 'uname -s' command is being routed through SSH when isTargetHost is true
    const unameOutput = await runCommand('linux_platform', isTargetHost, 'linux');
    logger.debug(`[detectOperatingSystem] linux_platform output from target host: "${unameOutput}"`);

    if (unameOutput) {
      if (unameOutput.toLowerCase().includes('linux')) {
        platform = 'linux';
        type = 'Linux';
      } else if (unameOutput.toLowerCase().includes('darwin')) {
        platform = 'darwin';
        type = 'Darwin';
      } else if (unameOutput.toLowerCase().includes('freebsd')) {
        platform = 'freebsd';
        type = 'FreeBSD';
      } else {
        // Log if unameOutput is not recognized
        logger.warn(`[detectOperatingSystem] Unrecognized linux_platform output: "${unameOutput}"`);
      }
    }
    // Update the global detectedOS object
    detectedOS.platform = platform;
    detectedOS.type = type;
  } catch (e) {
    logger.error(`[detectOperatingSystem] Error running uname -s on target host: ${e.message}`);
    detectedOS.platform = os.platform(); // Fallback to container's platform
    detectedOS.type = os.type(); // Fallback to container's type
  }

  const currentPlatform = detectedOS.platform; // Use the detected platform for subsequent commands
  detectedOS.kernel = await runCommand('kernel_version_info', isTargetHost, currentPlatform); // Get kernel release

  // Try to get more specific distro info
  if (currentPlatform === 'linux') {
    const osRelease = await runCommand('os_release_info', true, currentPlatform); // Use `true` for host commands
    if (osRelease) {
      const idMatch = osRelease.match(/^ID=(.*)$/m);
      const versionIdMatch = osRelease.match(/^VERSION_ID=(.*)$/m);
      const prettyNameMatch = osRelease.match(/^PRETTY_NAME="(.*)"$/m);

      if (idMatch && idMatch[1]) detectedOS.distro = idMatch[1].replace(/"/g, '');
      if (versionIdMatch && versionIdMatch[1]) detectedOS.version = versionIdMatch[1].replace(/"/g, '');
      if (prettyNameMatch && prettyNameMatch[1]) detectedOS.type = prettyNameMatch[1].replace(/"/g, ''); // Use pretty name for type

      // Specific checks for common distros
      if (detectedOS.distro.includes('ubuntu') || detectedOS.distro.includes('debian')) {
        detectedOS.type = 'Debian/Ubuntu Linux';
      } else if (detectedOS.distro.includes('centos') || detectedOS.distro.includes('fedora') || detectedOS.distro.includes('rhel')) {
        detectedOS.type = 'Red Hat/CentOS/Fedora Linux';
      }
    }
  } else if (currentPlatform === 'darwin') {
    const swVers = await runCommand('os_release_info', true, currentPlatform); // Use `true` for host commands
    if (swVers) {
      const productNameMatch = swVers.match(/ProductName:\s*(.*)$/m);
      const productVersionMatch = swVers.match(/ProductVersion:\s*(.*)$/m);
      if (productNameMatch && productNameMatch[1]) detectedOS.distro = productNameMatch[1].trim();
      if (productVersionMatch && productVersionMatch[1]) detectedOS.version = productVersionMatch[1].trim();
      detectedOS.type = 'macOS';
    }
  } else if (currentPlatform.includes('bsd')) { // freebsd, openbsd, netbsd
    const unameS = await runCommand('kernel_version_info', true, currentPlatform); // uname -s for BSD name
    if (unameS) detectedOS.distro = unameS.split(' ')[0].trim(); // Extract name like FreeBSD
    const unameR = await runCommand('kernel_version_info', true, currentPlatform); // uname -r for BSD release
    if (unameR) detectedOS.version = unameR.split(' ')[2].trim(); // Extract version like 13.2-RELEASE
    detectedOS.type = `${detectedOS.distro} Unix`; // e.g., "FreeBSD Unix"
  } else if (currentPlatform === 'sunos') {
    detectedOS.type = 'Solaris/Illumos Unix';
  } else if (currentPlatform === 'aix') {
    detectedOS.type = 'AIX Unix';
  }

  logger.info(`Detected Target OS: ${JSON.stringify(detectedOS)}`);
}

/**
 * Attempts to read content from a Docker secret file.
 * @param {string} secretPath - The path to the Docker secret file.
 * @returns {Promise<string|null>} - The content of the secret, or null if not found/readable.
 */
async function readDockerSecret(secretPath) {
  try {
    const content = await fs.readFile(secretPath, 'utf8');
    return content.trim();
  } catch (error) {
    logger.debug(`Could not read Docker secret from ${secretPath}: ${error.message}`);
    return null;
  }
}

/**
 * Initializes SSH configuration, prioritizing Docker secrets over passed parameters.
 * If no username is specified, attempts to get one from the Docker secret that matches the machine name provided.
 * @param {string} sshTarget - SSH target in 'user@hostname' or 'hostname' format.
 * @returns {Promise<void|Error>} - Returns void if successful, throws Error if SSH target is provided but not found.
 */
async function initializeSshConfig(sshTarget) {
  logger.info(`Attempting to initialize SSH configuration for ${sshTarget}...`);

  let userFromParam = '';
  let hostFromParam = '';

  // If sshTarget is not provided, we cannot proceed with SSH
  if (!sshTarget) {
    logger.error('No sshTarget provided. SSH will not be used for host info.');
    USE_SSH_FOR_HOST_INFO = false;
    throw new Error('No sshTarget provided. SSH configuration cannot proceed.');
  }

  // Parse sshTarget: if it contains '@', split into user and host; else, only host is provided
  if (sshTarget.includes('@')) {
    const parts = sshTarget.split('@');
    if (parts.length === 2) {
      [userFromParam, hostFromParam] = parts;
    } else {
      logger.warn(`Invalid sshTarget format: "${sshTarget}". Expected 'user@hostname' or 'hostname'.`);
      throw new Error(`Invalid sshTarget format: "${sshTarget}". Expected 'user@hostname' or 'hostname'.`);
    }
  } else {
    hostFromParam = sshTarget;
  }

  // Try to load password from Docker secret map
  let passwordFromSecretMap = null;
  let usernameFromSecretMap = null;

  if (hostFromParam) {
    try {
      const secretMapContent = await readDockerSecret(SSH_PASSWORD_MAP_SECRET_PATH);
      if (secretMapContent) {
        let passwordMap = {};
        try {
          passwordMap = JSON.parse(secretMapContent);
        } catch (jsonErr) {
          logger.error(`SSH password map secret is not valid JSON: ${jsonErr.message}`);
        }

        if (userFromParam) {
          // Username specified: look for user@host
          passwordFromSecretMap = passwordMap[`${userFromParam}@${hostFromParam}`];
          if (passwordFromSecretMap) {
            usernameFromSecretMap = userFromParam;
            logger.info(`Password found in Docker secret map for ${userFromParam}@${hostFromParam}.`);
          } else {
            logger.warn(`No password found in Docker secret map for key: ${userFromParam}@${hostFromParam}.`);
          }
        } else {
          // No username specified: try to find any username for this host
          const foundEntry = Object.entries(passwordMap).find(([key, val]) => {
            const [user, host] = key.split('@');
            return host === hostFromParam && user && val;
          });
          if (foundEntry) {
            [usernameFromSecretMap, hostFromParam] = foundEntry[0].split('@');
            [, passwordFromSecretMap] = foundEntry;
            logger.info(`Username "${usernameFromSecretMap}" and password found in Docker secret map for host ${hostFromParam}.`);
          } else {
            logger.warn(`No username found in Docker secret map for host: ${hostFromParam}.`);
          }
        }
      }
    } catch (e) {
      logger.error(`Failed to parse SSH password map secret: ${e.message}`);
      throw new Error(`Failed to parse SSH password map secret: ${e.message}`);
    }
  }

  if (userFromParam && hostFromParam) {
    if (!passwordFromSecretMap) {
      USE_SSH_FOR_HOST_INFO = false;
      throw new Error(`No SSH password found for target "${userFromParam}@${hostFromParam}".`);
    }
    SSH_HOST_IP = hostFromParam;
    SSH_HOST_USER = userFromParam;
    SSH_HOST_PASSWORD = passwordFromSecretMap;
    USE_SSH_FOR_HOST_INFO = true;
    logger.info('SSH details loaded successfully.');
  } else if (usernameFromSecretMap && hostFromParam && passwordFromSecretMap) {
    SSH_HOST_IP = hostFromParam;
    SSH_HOST_USER = usernameFromSecretMap;
    SSH_HOST_PASSWORD = passwordFromSecretMap;
    USE_SSH_FOR_HOST_INFO = true;
    logger.info(`SSH details loaded successfully from secret for ${SSH_HOST_USER}@${SSH_HOST_IP}.`);
  } else if (hostFromParam && !usernameFromSecretMap) {
    USE_SSH_FOR_HOST_INFO = false;
    throw new Error(`No username exists for machine "${hostFromParam}" in Docker secret map.`);
  } else {
    USE_SSH_FOR_HOST_INFO = false;
  }

  if (USE_SSH_FOR_HOST_INFO) {
    logger.info(`SSH to host configured: ${SSH_HOST_USER}@${SSH_HOST_IP}`);
  }
}

/**
 * Tests SSH connectivity for a given sshTarget ('user@host' or 'host').
 * Checks:
 *   1. Format is correct ('user@host' or 'host')
 *   2. Username and password exist in Docker secret for this target
 *   3. SSH connection can be established (using sshpass)
 * Returns true if all checks pass, otherwise throws an Error with the reason.
 * @param {string} sessiondId - Session ID for logging purposes.
 * @param {string} sshTarget - SSH target in 'user@hostname' or 'hostname' format.
 * @returns {Promise<boolean>} - Resolves true if connection is successful.
 * @throws {Error} - If any check fails, with a descriptive message.
 */
async function testSshConnect(sessiondId, sshTarget) {
  logger.info(`Testing SSH connectivity for ${sessiondId} to ${sshTarget}...`);

  // 1. Validate format
  if (!sshTarget || typeof sshTarget !== 'string') {
    throw new Error('Invalid sshTarget specified. Expected "user@hostname" or "hostname".');
  }

  let user = '';
  let host = '';

  if (sshTarget.includes('@')) {
    const parts = sshTarget.split('@');
    if (parts.length === 2) {
      const [userPart, hostPart] = parts;
      user = userPart;
      host = hostPart;
    } else {
      throw new Error('Invalid sshTarget format. Expected "user@hostname" or "hostname".');
    }
  } else {
    host = sshTarget;
  }

  // 2. Check username and password in Docker secret
  const secretMapContent = await readDockerSecret(SSH_PASSWORD_MAP_SECRET_PATH);
  if (!secretMapContent) {
    throw new Error('Could not read Docker secret for SSH password map.');
  }
  let passwordMap;
  try {
    passwordMap = JSON.parse(secretMapContent);
  } catch (e) {
    throw new Error('SSH password map secret is not valid JSON.');
  }

  let password = null;
  let foundUser = user;

  if (user) {
    password = passwordMap[`${user}@${host}`];
    if (!password) {
      throw new Error(`No SSH password found for target "${user}@${host}".`);
    }
  } else {
    // No username specified: try to find any username for this host
    const foundEntry = Object.entries(passwordMap).find(([key, val]) => {
      const [entryUser, entryHost] = key.split('@');
      return entryHost === host && entryUser && val;
    });
    if (foundEntry) {
      [foundUser, host] = foundEntry[0].split('@');
      [, password] = foundEntry;
    } else {
      throw new Error(`No username exists for machine "${host}" in Docker secret map.`);
    }
  }

  try {
    await checkIfRunningInDocker();
    await initializeSshConfig(foundUser ? `${foundUser}@${host}` : host);
  } catch (error) {
    logger.warn(`SSH initialization failed: ${error.message}`);
    throw error;
  }

  // 3. Test SSH connection (non-interactive, no command, just exit)
  try {
    await runCommand('linux_platform', true);
    logger.info(`SSH connection to ${foundUser}@${host} successful.`);
    return true;
  } catch (err) {
    let msg = err && err.message ? err.message : String(err);
    // Hide password in error message
    msg = msg.replace(/-p '.*?'/, "-p '***'");
    throw new Error(`SSH connection test failed: ${msg}`);
  }
}

/**
 * Gathers general system information.
 * Note: Node.js `os` module calls reflect the environment where Node.js is running (the container).
 * Commands executed via `runCommand` with `targetHost=true` will attempt to get host info.
 * @returns {Promise<object>} - An object containing general system info.
 */
async function getGeneralInfo() {
  // Refactored to remove nested ternary
  let hostInfoCollectionMethod;
  if (USE_SSH_FOR_HOST_INFO) {
    hostInfoCollectionMethod = 'SSH';
  } else {
    hostInfoCollectionMethod = 'local';
  }

  const generalInfo = {
    // Container-specific info (from Node.js os module)
    container_info: (checkIfRunningInDocker())
      ? {
        hostname: os.hostname(),
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        uptime: os.uptime(), // in seconds
        loadavg: os.loadavg(), // 1, 5, and 15 minute load averages
        cpu_model: os.cpus()[0] ? os.cpus()[0].model : 'N/A',
        cpu_cores: os.cpus().length,
        cpu_speed: os.cpus()[0] ? os.cpus()[0].speed : 'N/A', // in MHz
        total_memory_bytes: os.totalmem(),
        free_memory_bytes: os.freemem(),
        total_memory_gb: (os.totalmem() / (1024 ** 3)).toFixed(2),
        free_memory_gb: (os.freemem() / (1024 ** 3)).toFixed(2),
        network_interfaces: os.networkInterfaces(),
      }
      : {},
    // Host-specific info (gathered via SSH or locally if not in Docker)
    host_info: {
      hostname: await runCommand('hostname', true),
      detected_os: detectedOS,
      os_release: await runCommand('os_release_info', true),
      kernel_version: await runCommand('kernel_version_info', true),
      cpu_details: await runCommand('cpu_info', true),
      memory_details: await runCommand('memory_info', true),
      network_interface_config: await runCommand('network_interface_config', true),
    },
    // Add fields to explicitly state the execution context
    is_running_in_docker_container: checkIfRunningInDocker(),
    host_info_collection_method: hostInfoCollectionMethod, // Using the refactored variable
    ssh_host_details: USE_SSH_FOR_HOST_INFO ? `${SSH_HOST_USER}@${SSH_HOST_IP}` : 'N/A',
  };

  return generalInfo;
}

/**
 * Gathers information about running processes.
 * @returns {Promise<object>} - An object containing process info.
 */
async function getProcessInfo() {
  const processInfo = {
    all_processes: await runCommand('process_info', true), // Host's processes
  };
  return processInfo;
}

/**
 * Gathers disk and block device information.
 * @returns {Promise<object>} - An object containing disk info.
 */
async function getDiskInfo() {
  const diskInfo = {
    filesystem_usage: await runCommand('disk_info', true), // Host's filesystem usage
    block_devices_details: null, // Will try to parse JSON/plist if available
  };

  const lsblkOutput = await runCommand('disk_info', true); // This will try multiple commands
  if (lsblkOutput) {
    try {
      if (detectedOS.platform === 'linux' && lsblkOutput.includes('{') && lsblkOutput.includes('}')) {
        diskInfo.block_devices_details = JSON.parse(lsblkOutput);
      } else if (detectedOS.platform === 'darwin' && lsblkOutput.includes('<plist version')) {
        // For macOS, diskutil list -plist returns XML, might need an XML parser
        diskInfo.block_devices_details = lsblkOutput; // Store raw XML for now
      } else {
        diskInfo.block_devices_details = lsblkOutput; // Store raw output if not parsable JSON/plist
      }
    } catch (e) {
      logger.error(`Failed to parse disk info output for host (${detectedOS.platform}):`, e.message);
      diskInfo.block_devices_details = lsblkOutput; // Store raw output if parsing fails
    }
  }

  return diskInfo;
}

/**
 * Gathers kernel configuration and module information.
 * @returns {Promise<object>} - An object containing kernel info.
 */
async function getKernelInfo() {
  const kernelInfo = {
    kernel_config_sysctl: await runCommand('sysctl_info', true), // Host's kernel config
    loaded_modules: await runCommand('kernel_modules_info', true), // Host's loaded modules
  };
  return kernelInfo;
}

/**
 * Gathers information about network services (listening ports).
 * Requires sudo for full details (PID/Program Name) on many systems.
 * @returns {Promise<object>} - An object containing network service info.
 */
async function getNetworkServices() {
  const networkServices = {
    listening_ports: await runCommand('network_services_info', true), // Host's network services
  };
  return networkServices;
}

/**
 * Retrieves services running on the target host.
 *
 * This asynchronous function gathers information about various services, including databases,
 * web servers, and other services, by executing OS-specific commands. It also checks the status
 * of the Docker daemon if applicable. The results are organized into categories and returned
 * as an object for further inspection or processing.
 *
 * @async
 * @function getServices
 * @returns {Promise<Object>} An object containing arrays of identified services categorized as
 *                            databases, web servers, other services, and the Docker daemon status.
 */
async function getServices() {
  const generalServices = {
    all_services: [], // Initialize the details property as an empty array
  };

  // Use the commandMap to get all services information.
  // Ensure 'detectedOS.platform' has a fallback value to avoid errors if not set.
  const platform = detectedOS.platform || os.platform(); // Fallback to container's platform if not set
  // 'detectedOS.platform' ensures the correct OS-specific command(s) are chosen from the commandMap.
  const allServicesOutput = await runCommand('list_all_services', true, platform);

  if (allServicesOutput && allServicesOutput !== 'N/A') {
    allServicesOutput.split('\n').forEach((line) => {
      if (line.trim()) {
        generalServices.all_services.push(line.trim());
      }
    });
  }

  generalServices.all_services = [...new Set(generalServices.all_services)];

  return generalServices;
}

/**
 * Attempts to identify running databases and other common services.
 * This is heuristic-based and might not be exhaustive or perfectly accurate.
 * @returns {Promise<object>} - An object containing identified services.
 */
async function getIdentifiableServices() {
  const identifiedServices = {
    databases: [],
    web_servers: [],
    other_services: [],
    docker_daemon_status: null,
    package_info: await runCommand('package_manager_info', true), // Raw package info
  };

  const psOutput = await runCommand('process_info', true); // Get process list from host
  if (psOutput && psOutput !== 'N/A') {
    // Common database processes
    if (psOutput.includes('mysqld') || psOutput.includes('mysql')) identifiedServices.databases.push('MySQL');
    if (psOutput.includes('postgres') || psOutput.includes('pg_ctl')) identifiedServices.databases.push('PostgreSQL');
    if (psOutput.includes('mongod')) identifiedServices.databases.push('MongoDB');
    if (psOutput.includes('oracle')) identifiedServices.databases.push('Oracle');
    if (psOutput.includes('redis-server')) identifiedServices.databases.push('Redis');
    if (psOutput.includes('memcached')) identifiedServices.other_services.push('Memcached');

    // Common web servers
    if (psOutput.includes('apache2') || psOutput.includes('httpd')) identifiedServices.web_servers.push('Apache HTTP Server');
    if (psOutput.includes('nginx')) identifiedServices.web_servers.push('Nginx');
    if (psOutput.includes('lighttpd')) identifiedServices.web_servers.push('Lighttpd');
    if (psOutput.includes('caddy')) identifiedServices.web_servers.push('Caddy');

    // Docker daemon status
    if (psOutput.includes('dockerd')) identifiedServices.docker_daemon_status = 'Running';
    else identifiedServices.docker_daemon_status = 'Not Running (process not found)';
  }

  // Check systemd services (Linux specific)
  if (detectedOS.platform === 'linux') {
    const systemctlServices = await runCommand('systemctl list-units --type=service --all --no-pager', true);
    if (systemctlServices && systemctlServices !== 'N/A') {
      if (systemctlServices.includes('mysql.service') || systemctlServices.includes('mariadb.service')) {
        if (!identifiedServices.databases.includes('MySQL')) identifiedServices.databases.push('MySQL (systemd)');
      }
      if (systemctlServices.includes('postgresql.service')) {
        if (!identifiedServices.databases.includes('PostgreSQL')) identifiedServices.databases.push('PostgreSQL (systemd)');
      }
      if (systemctlServices.includes('mongod.service')) {
        if (!identifiedServices.databases.includes('MongoDB')) identifiedServices.databases.push('MongoDB (systemd)');
      }
      if (systemctlServices.includes('redis.service')) {
        if (!identifiedServices.databases.includes('Redis')) identifiedServices.databases.push('Redis (systemd)');
      }
      if (systemctlServices.includes('apache2.service') || systemctlServices.includes('httpd.service')) {
        if (!identifiedServices.web_servers.includes('Apache HTTP Server')) identifiedServices.web_servers.push('Apache HTTP Server (systemd)');
      }
      if (systemctlServices.includes('nginx.service')) {
        if (!identifiedServices.web_servers.includes('Nginx')) identifiedServices.web_servers.push('Nginx (systemd)');
      }
      if (systemctlServices.includes('docker.service')) {
        if (identifiedServices.docker_daemon_status === 'Not Running (process not found)') {
          identifiedServices.docker_daemon_status = 'Running (systemd)';
        }
      }
    }
  }

  // Deduplicate lists
  identifiedServices.databases = [...new Set(identifiedServices.databases)];
  identifiedServices.web_servers = [...new Set(identifiedServices.web_servers)];
  identifiedServices.other_services = [...new Set(identifiedServices.other_services)];

  return identifiedServices;
}

/**
 * Gathers detailed hardware information using lshw, dmidecode, system_profiler etc.
 * These commands often require root privileges.
 * @returns {Promise<object>} - An object containing hardware info.
 */
async function getHardwareInfo() {
  const hardwareInfo = {
    detailed_hardware_info: null, // Will try to parse JSON/plist if available
    dmi_info: null, // For Linux/BSD dmidecode
  };

  const lshwOutput = await runCommand('hardware_info', true);
  if (lshwOutput) {
    try {
      if (detectedOS.platform === 'linux' && lshwOutput.includes('{') && lshwOutput.includes('}')) {
        hardwareInfo.detailed_hardware_info = JSON.parse(lshwOutput);
      } else if (detectedOS.platform === 'darwin' && lshwOutput.includes('{') && lshwOutput.includes('}')) {
        // For macOS, system_profiler SPHardwareDataType -json returns JSON
        const parsedOutput = JSON.parse(lshwOutput);
        hardwareInfo.detailed_hardware_info = parsedOutput;
      } else {
        hardwareInfo.detailed_hardware_info = lshwOutput; // Store raw output
      }
    } catch (e) {
      logger.error(`Failed to parse hardware info output for host (${detectedOS.platform}):`, e.message);
      hardwareInfo.detailed_hardware_info = lshwOutput; // Store raw output if parsing fails
    }
  }

  // dmidecode is primarily Linux/BSD
  if (detectedOS.platform === 'linux' || detectedOS.platform.includes('bsd')) {
    hardwareInfo.dmi_info = await runCommand('dmidecode', true);
  }

  return hardwareInfo;
}

/**
 * Collects basic system information except for processes and all services.
 * This serves as the main entry point for collecting general system info.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshTarget=''] - The SSH target in 'user@hostname' format.
 * @returns {Promise<object>} - A JSON object containing the general system information.
 */
async function collectBasicSystemInfo(sessionId, sshTarget = '') {
  logger.info(`[Session: ${sessionId}] Starting general system information collection.`);

  await checkIfRunningInDocker();
  try {
    await initializeSshConfig(sshTarget);
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to get ssh info ${error.message}`, error);
    return { error: 'Failed to get ssh info ', details: error.message };
  }

  await detectOperatingSystem(USE_SSH_FOR_HOST_INFO || !(checkIfRunningInDocker()));

  const systemInfo = {};

  try {
    systemInfo.general = await getGeneralInfo();
    systemInfo.hardware = await getHardwareInfo();

    logger.info(`[Session: ${sessionId}] General system information collection completed successfully.`);
    return systemInfo;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to collect general system information: ${error.message}`, error);
    return { error: 'Failed to collect general system information', details: error.message };
  }
}

/**
 * Collects detailed system information except for processes and all services.
 * This serves as the main entry point for collecting general system info.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshTarget=''] - The SSH target in 'user@hostname' format.
 * @returns {Promise<object>} - A JSON object containing the general system information.
 */
async function collectDetailedSystemInfo(sessionId, sshTarget = '') {
  logger.info(`[Session: ${sessionId}] Starting general system information collection.`);

  await checkIfRunningInDocker();
  try {
    await initializeSshConfig(sshTarget);
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to get ssh info ${error.message}`, error);
    return { error: 'Failed to get ssh info ', details: error.message };
  }

  await detectOperatingSystem(USE_SSH_FOR_HOST_INFO || !(checkIfRunningInDocker()));

  const systemInfo = {};

  try {
    systemInfo.disk = await getDiskInfo();
    systemInfo.kernel = await getKernelInfo();
    systemInfo.network_services = await getNetworkServices();

    logger.info(`[Session: ${sessionId}] Additional system information collection completed successfully.`);
    return systemInfo;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to collect additional system information: ${error.message}`, error);
    return { error: 'Failed to collect general system information', details: error.message };
  }
}

/**
 * Collects only process information.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshTarget=''] - The SSH target in 'user@hostname' format.
 * @returns {Promise<object>} - A JSON object containing process information.
 */
async function collectProcessInfo(sessionId, sshTarget = '') {
  logger.info(`[Session: ${sessionId}] Starting process information collection.`);

  await checkIfRunningInDocker();
  try {
    await initializeSshConfig(sshTarget);
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to get ssh info ${error.message}`, error);
    return { error: 'Failed to get ssh info ', details: error.message };
  }

  await detectOperatingSystem(USE_SSH_FOR_HOST_INFO || !(checkIfRunningInDocker()));

  try {
    const processes = await getProcessInfo();
    logger.info(`[Session: ${sessionId}] Process information collection completed successfully.`);
    return processes;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to collect process information: ${error.message}`, error);
    return { error: 'Failed to collect process information', details: error.message };
  }
}

/**
 * Collects only service information (all services).
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshTarget=''] - The SSH target in 'user@hostname' format.
 * @returns {Promise<object>} - A JSON object containing all services information.
 */
async function collectAllServicesInfo(sessionId, sshTarget = '') {
  logger.info(`[Session: ${sessionId}] Starting all services information collection.`);

  await checkIfRunningInDocker();
  try {
    await initializeSshConfig(sshTarget);
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to get ssh info ${error.message}`, error);
    return { error: 'Failed to get ssh info ', details: error.message };
  }

  await detectOperatingSystem(USE_SSH_FOR_HOST_INFO || !(checkIfRunningInDocker()));

  try {
    const serviceInfo = {};
    serviceInfo.all_services = await getServices();
    serviceInfo.identifiable_services = await getIdentifiableServices();
    logger.info(`[Session: ${sessionId}] All services information collection completed successfully.`);
    return serviceInfo;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to collect all services information: ${error.message}`, error);
    return { error: 'Failed to collect all services information', details: error.message };
  }
}

// Export the main collection functions
module.exports = {
  collectBasicSystemInfo,
  collectDetailedSystemInfo,
  collectProcessInfo,
  collectAllServicesInfo,
  testSshConnect,
};
