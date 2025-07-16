const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs/promises'); // Use fs.promises for async file operations
const logger = require('./logger');

// Promisify the exec function for easier async/await usage
const execPromise = util.promisify(exec);

// Global flags and configurations
let IS_RUNNING_IN_DOCKER = false;
const HOST_CHROOT_PATH = '/host'; // Expected path if host's root is mounted

let USE_SSH_FOR_HOST_INFO = false;
let SSH_HOST_USER = '';
let SSH_HOST_IP = '';
let SSH_HOST_PASSWORD = ''; // WARNING: Storing and passing passwords directly is INSECURE.

// Docker secret paths (convention for Docker Swarm/Compose secrets)
const SSH_SECRET_HOST_PATH = '/run/secrets/ssh_host';
const SSH_SECRET_USER_PATH = '/run/secrets/ssh_user';
const SSH_SECRET_PASSWORD_PATH = '/run/secrets/ssh_password';

// Detected OS information for the target host
let detectedOS = {
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
  // General OS release information
  'os_release_info': {
    'linux': ['cat /etc/os-release', 'cat /etc/lsb-release', 'cat /etc/redhat-release'],
    'darwin': ['sw_vers'],
    'freebsd': ['freebsd-version'],
    'openbsd': ['sysctl kern.version'], // Similar to uname -a, but more specific for version
    'netbsd': ['sysctl kern.version'],
    'sunos': ['cat /etc/release'], // Solaris/illumos
    'aix': ['oslevel -s'],
  },
  // Kernel version and details
  'kernel_version_info': {
    'linux': ['uname -a'],
    'darwin': ['uname -a'],
    'freebsd': ['uname -a'],
    'openbsd': ['uname -a'],
    'netbsd': ['uname -a'],
    'sunos': ['uname -a'],
    'aix': ['uname -a'],
  },
  // CPU information
  'cpu_info': {
    'linux': ['lscpu', 'cat /proc/cpuinfo'],
    'darwin': ['sysctl -n machdep.cpu.brand_string', 'sysctl -n hw.ncpu'], // Brand string, number of cores
    'freebsd': ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    'openbsd': ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    'netbsd': ['sysctl -n hw.model', 'sysctl -n hw.ncpu'],
    'sunos': ['psrinfo -pv'],
    'aix': ['prtconf | grep "Processor Type"'],
  },
  // Memory information
  'memory_info': {
    'linux': ['free -h', 'cat /proc/meminfo'],
    'darwin': ['sysctl -n hw.memsize', 'sysctl -n hw.pagesize'], // Need to calculate total/free
    'freebsd': ['sysctl -n hw.physmem', 'sysctl -n vm.stats.vm.v_free_pages'],
    'openbsd': ['sysctl -n hw.physmem'],
    'netbsd': ['sysctl -n hw.physmem'],
    'sunos': ['prtconf | grep "Memory size"'],
    'aix': ['lsattr -El mem0 | grep size'],
  },
  // Disk usage and block devices
  'disk_info': {
    'linux': ['df -h', 'lsblk -J', 'fdisk -l'], // lsblk -J for JSON
    'darwin': ['df -h', 'diskutil list -plist'], // plist for structured output
    'freebsd': ['df -h', 'gpart show'],
    'openbsd': ['df -h', 'disklabel'],
    'netbsd': ['df -h', 'disklabel'],
    'sunos': ['df -h', 'format'],
    'aix': ['df -g', 'lspv'],
  },
  // Running processes
  'process_info': {
    'linux': ['ps aux', 'top -bn1 | head -n 20'],
    'darwin': ['ps aux', 'top -l 1 | head -n 20'],
    'freebsd': ['ps aux', 'top -b | head -n 20'],
    'openbsd': ['ps aux', 'top -b | head -n 20'],
    'netbsd': ['ps aux', 'top -b | head -n 20'],
    'sunos': ['ps -ef', 'prstat -n 20 1 1'],
    'aix': ['ps -ef', 'topas -P'],
  },
  // Network services (listening ports)
  'network_services_info': {
    'linux': ['ss -tulnp', 'netstat -tulnp', 'lsof -i -P -n'], // ss is often preferred
    'darwin': ['lsof -i -P -n', 'netstat -anv'],
    'freebsd': ['sockstat -46l', 'netstat -an'],
    'openbsd': ['sockstat -46l', 'netstat -an'],
    'netbsd': ['sockstat -46l', 'netstat -an'],
    'sunos': ['netstat -an', 'fuser -n tcp', 'fuser -n udp'],
    'aix': ['netstat -an', 'rmsock'],
  },
  // Hardware info (lshw, dmidecode)
  'hardware_info': {
    'linux': ['lshw -json', 'dmidecode'],
    'darwin': ['system_profiler SPHardwareDataType -json'], // Structured hardware data
    // BSDs generally rely on sysctl, dmesg, or specific tools for hardware info
    'freebsd': ['pciconf -lv', 'dmidecode', 'dmesg | grep "CPU:"'],
    'openbsd': ['pciconf -lv', 'dmesg | grep "CPU:"'],
    'netbsd': ['pciconf -lv', 'dmesg | grep "CPU:"'],
    'sunos': ['prtconf -v'],
    'aix': ['prtconf -v'],
  },
  // Kernel modules/extensions
  'kernel_modules_info': {
    'linux': ['lsmod'],
    'darwin': ['kextstat'], // macOS kernel extensions
    'freebsd': ['kldstat'],
    'openbsd': ['sysctl kern.modules'], // Less detailed, but available
    'netbsd': ['modstat'],
    'sunos': ['modinfo'],
    'aix': ['genkex'],
  },
  // System control parameters
  'sysctl_info': {
    'linux': ['sysctl -a'],
    'darwin': ['sysctl -a'],
    'freebsd': ['sysctl -a'],
    'openbsd': ['sysctl -a'],
    'netbsd': ['sysctl -a'],
    'sunos': ['sysdef'], // Different command for system definition
    'aix': ['lsattr -El sys0'], // System attributes
  },
  // Network interface configuration (legacy/modern)
  'network_interface_config': {
    'linux': ['ip addr show', 'ifconfig -a'], // ip is preferred
    'darwin': ['ifconfig -a'],
    'freebsd': ['ifconfig -a'],
    'openbsd': ['ifconfig -a'],
    'netbsd': ['ifconfig -a'],
    'sunos': ['ifconfig -a'],
    'aix': ['netstat -in'],
  },
  // Package management info (heuristic)
  'package_manager_info': {
    'linux': ['dpkg -l', 'rpm -qa', 'yum list installed', 'apt list --installed', 'pacman -Q'],
    // macOS has Homebrew/MacPorts, but no universal package manager command like apt/rpm
    // BSDs have their own package managers (pkg, ports), but no single command to list all
  }
};

/**
 * Detects the operating system of the target host.
 * This function will be called once at the beginning of collectSystemInfo
 * to set `detectedOS` for subsequent command selections.
 * @param {boolean} isTargetHost - True if detecting the host OS (via SSH/chroot), false for container OS.
 */
async function detectOperatingSystem(isTargetHost) {
  const currentPlatform = os.platform(); // 'linux', 'darwin', 'freebsd', etc.

  detectedOS.platform = currentPlatform;
  detectedOS.type = os.type();
  detectedOS.kernel = await runCommand('uname -r', isTargetHost, currentPlatform); // Get kernel release

  // Try to get more specific distro info
  if (currentPlatform === 'linux') {
    const osRelease = await runCommand('cat /etc/os-release', isTargetHost, currentPlatform);
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
    const swVers = await runCommand('sw_vers', isTargetHost, currentPlatform);
    if (swVers) {
      const productNameMatch = swVers.match(/ProductName:\s*(.*)$/m);
      const productVersionMatch = swVers.match(/ProductVersion:\s*(.*)$/m);
      if (productNameMatch && productNameMatch[1]) detectedOS.distro = productNameMatch[1].trim();
      if (productVersionMatch && productVersionMatch[1]) detectedOS.version = productVersionMatch[1].trim();
      detectedOS.type = 'macOS';
    }
  } else if (currentPlatform.includes('bsd')) { // freebsd, openbsd, netbsd
    const unameS = await runCommand('uname -s', isTargetHost, currentPlatform);
    if (unameS) detectedOS.distro = unameS.trim();
    const unameR = await runCommand('uname -r', isTargetHost, currentPlatform);
    if (unameR) detectedOS.version = unameR.trim();
    detectedOS.type = `${detectedOS.distro} Unix`; // e.g., "FreeBSD Unix"
  } else if (currentPlatform === 'sunos') {
    detectedOS.type = 'Solaris/Illumos Unix';
  } else if (currentPlatform === 'aix') {
    detectedOS.type = 'AIX Unix';
  }

  logger.info(`Detected Target OS: ${JSON.stringify(detectedOS)}`);
}


/**
 * Executes a shell command.
 * @param {string} commandKey - The key from `commandMap` representing the desired information.
 * @param {boolean} [targetHost=false] - If true, attempts to run the command on the host.
 * @param {string} [overridePlatform=detectedOS.platform] - Allows overriding the detected platform for command selection.
 * @returns {Promise<string|null>} - The stdout of the command, or null if an error occurs.
 */
async function runCommand(commandKey, targetHost = false, overridePlatform = detectedOS.platform) {
  const commandsToTry = commandMap[commandKey]?.[overridePlatform] || [commandKey]; // Fallback to commandKey if not mapped
  let executionContext = 'container';
  let prefix = '';

  if (targetHost) {
    if (USE_SSH_FOR_HOST_INFO) {
      prefix = `sshpass -p '${SSH_HOST_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SSH_HOST_USER}@${SSH_HOST_IP} `;
      executionContext = 'host via SSH';
    } else if (IS_RUNNING_IN_DOCKER && overridePlatform === 'linux') { // chroot only makes sense for Linux hosts
      prefix = `chroot ${HOST_CHROOT_PATH} `;
      executionContext = 'host via chroot';
    } else if (IS_RUNNING_IN_DOCKER && (overridePlatform === 'darwin' || overridePlatform.includes('bsd') || overridePlatform === 'sunos' || overridePlatform === 'aix')) {
        logger.warn(`Cannot use chroot for non-Linux host (${overridePlatform}). SSH is required.`);
        return null; // Cannot gather host info without SSH
    } else {
      // Not in Docker and not using SSH, implies the script is running directly on the desired host.
      executionContext = 'local host';
    }
  }

  for (const cmd of commandsToTry) {
    const finalCommand = `${prefix}${cmd}`;
    logger.debug(`Attempting to execute (${executionContext}): ${finalCommand}`);
    try {
      // Use /bin/bash for proper command parsing and escaping, especially with sshpass
      const { stdout } = await execPromise(finalCommand, { shell: '/bin/bash', timeout: 10000 }); // 10 sec timeout
      return stdout.trim();
    } catch (error) {
      logger.debug(`Command failed (${executionContext}): "${finalCommand}" - ${error.message}`);
      if (executionContext === 'host via SSH') {
        if (error.message.includes('Permission denied')) {
            logger.error("SSH Permission Denied. Check user, password, and host permissions.");
            return null; // Stop trying if permission denied
        } else if (error.message.includes('No route to host') || error.message.includes('Connection refused')) {
            logger.error("SSH Connection Failed. Check host IP, firewall, and SSH service status.");
            return null; // Stop trying if connection failed
        } else if (error.message.includes('sshpass: command not found')) {
            logger.error("sshpass is not installed in the container. Please install it.");
            return null; // Stop trying if sshpass is missing
        }
      }
      // Continue to next command in list if current one fails
    }
  }

  logger.warn(`All attempts to get info for "${commandKey}" on ${overridePlatform} failed.`);
  return 'N/A'; // Return N/A if all commands fail
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
 * @param {string} paramSshHost - SSH host passed as a function parameter.
 * @param {string} paramSshUser - SSH user passed as a function parameter.
 * @param {string} paramSshPassword - SSH password passed as a function parameter.
 */
async function initializeSshConfig(paramSshHost, paramSshUser, paramSshPassword) {
  logger.info("Attempting to initialize SSH configuration...");

  // 1. Try to load from Docker secrets first
  const secretHost = await readDockerSecret(SSH_SECRET_HOST_PATH);
  const secretUser = await readDockerSecret(SSH_SECRET_USER_PATH);
  const secretPassword = await readDockerSecret(SSH_SECRET_PASSWORD_PATH);

  if (secretHost && secretUser && secretPassword) {
    SSH_HOST_IP = secretHost;
    SSH_HOST_USER = secretUser;
    SSH_HOST_PASSWORD = secretPassword;
    USE_SSH_FOR_HOST_INFO = true;
    logger.info("SSH details loaded successfully from Docker secrets.");
  } else if (paramSshHost && paramSshUser && paramSshPassword) {
    // 2. Fallback to parameters if secrets are not available
    SSH_HOST_IP = paramSshHost;
    SSH_HOST_USER = paramSshUser;
    SSH_HOST_PASSWORD = paramSshPassword;
    USE_SSH_FOR_HOST_INFO = true;
    logger.info("SSH details loaded successfully from function parameters.");
  } else {
    USE_SSH_FOR_HOST_INFO = false;
    logger.warn("No SSH details found in Docker secrets or function parameters.");
  }

  if (USE_SSH_FOR_HOST_INFO) {
    logger.info(`SSH to host configured: ${SSH_HOST_USER}@${SSH_HOST_IP}`);
  }
}

/**
 * Gathers general system information.
 * Note: Node.js `os` module calls reflect the environment where Node.js is running (the container).
 * Commands executed via `runCommand` with `targetHost=true` will attempt to get host info.
 * @returns {Promise<object>} - An object containing general system info.
 */
async function getGeneralInfo() {
  const generalInfo = {
    // Container-specific info (from Node.js os module)
    container_info: {
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
    },
    // Host-specific info (gathered via SSH/chroot or locally if not in Docker)
    host_info: {
      detected_os: detectedOS,
      os_release: await runCommand('os_release_info', true),
      kernel_version: await runCommand('kernel_version_info', true),
      cpu_details: await runCommand('cpu_info', true),
      memory_details: await runCommand('memory_info', true),
      network_interface_config: await runCommand('network_interface_config', true),
    },
    // Add fields to explicitly state the execution context
    is_running_in_docker_container: IS_RUNNING_IN_DOCKER,
    host_info_collection_method: USE_SSH_FOR_HOST_INFO ? 'SSH' : (IS_RUNNING_IN_DOCKER ? 'chroot' : 'local'),
    ssh_host_details: USE_SSH_FOR_HOST_INFO ? `${SSH_HOST_USER}@${SSH_HOST_IP}` : 'N/A',
    chroot_path_if_used: IS_RUNNING_IN_DOCKER && !USE_SSH_FOR_HOST_INFO ? HOST_CHROOT_PATH : 'N/A',
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
      } else if (detectedOS.platform === 'darwin' && lshwOutput.includes('<plist version')) {
        // For macOS, system_profiler SPHardwareDataType -json returns JSON, not plist
        hardwareInfo.detailed_hardware_info = JSON.parse(lshwOutput);
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
 * Main function to collect all system information.
 * This serves as the single entry point for the chatbot.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshHost=''] - The IP address or hostname of the SSH host (from function parameter).
 * @param {string} [sshUser=''] - The username for SSH authentication (from function parameter).
 * @param {string} [sshPassword=''] - The password for SSH authentication (from function parameter). WARNING: INSECURE.
 * @returns {Promise<object>} - A JSON object containing the comprehensive system information.
 */
async function collectSystemInfo(sessionId, sshHost = '', sshUser = '', sshPassword = '') {
  logger.info(`[Session: ${sessionId}] Starting system information collection.`);

  // Determine if running in Docker
  await checkIfRunningInDocker();

  // Initialize SSH configuration, prioritizing secrets over parameters
  await initializeSshConfig(sshHost, sshUser, sshPassword);

  // Detect the target host's OS *after* determining if SSH will be used
  // because the detection commands will be run on the target host.
  await detectOperatingSystem(USE_SSH_FOR_HOST_INFO || !IS_RUNNING_IN_DOCKER);

  const systemInfo = {};

  try {
    systemInfo.general = await getGeneralInfo();
    systemInfo.processes = await getProcessInfo();
    systemInfo.disk = await getDiskInfo();
    systemInfo.kernel = await getKernelInfo();
    systemInfo.network_services = await getNetworkServices();
    systemInfo.identified_services = await getIdentifiableServices();
    systemInfo.hardware = await getHardwareInfo();

    logger.info(`[Session: ${sessionId}] System information collection completed successfully.`);
    return systemInfo;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Failed to collect system information: ${error.message}`, error);
    // Return a structured error for the chatbot to handle
    return { error: 'Failed to collect system information', details: error.message };
  }
}

// Export the main collection function
module.exports = {
  collectSystemInfo,
};