const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const logger = require('./logger'); // Assuming a logger utility exists

// Promisify the exec function for easier async/await usage
const execPromise = util.promisify(exec);

// Global flags and configurations
let IS_RUNNING_IN_DOCKER = false;
const HOST_CHROOT_PATH = '/host'; // Expected path if host's root is mounted

let USE_SSH_FOR_HOST_INFO = false;
let SSH_HOST_USER = '';
let SSH_HOST_IP = '';
let SSH_HOST_PASSWORD = ''; // WARNING: Storing and passing passwords directly is INSECURE.

/**
 * Checks if the current process is running inside a Docker container.
 * This is a heuristic check based on the existence of /.dockerenv and/or cgroup info.
 */
async function checkIfRunningInDocker() {
  try {
    // Check for the existence of the /.dockerenv file
    await execPromise('test -f /.dockerenv');
    IS_RUNNING_IN_DOCKER = true;
    logger.info("Detected running inside Docker via /.dockerenv");
    return;
  } catch (e) {
    // /.dockerenv not found, proceed to cgroup check
  }

  try {
    // Check cgroup information for 'docker' or 'lxc'
    const cgroupContent = await util.promisify(require('fs').readFile)('/proc/self/cgroup', 'utf8');
    if (cgroupContent.includes('docker') || cgroupContent.includes('lxc')) {
      IS_RUNNING_IN_DOCKER = true;
      logger.info("Detected running inside Docker via cgroup info");
    }
  } catch (e) {
    logger.warn("Could not read /proc/self/cgroup to detect Docker environment:", e.message);
  }
}

/**
 * Executes a shell command.
 * @param {string} command - The shell command to execute.
 * @param {boolean} [targetHost=false] - If true, attempts to run the command on the host.
 * Behavior depends on IS_RUNNING_IN_DOCKER and USE_SSH_FOR_HOST_INFO.
 * @returns {Promise<string|null>} - The stdout of the command, or null if an error occurs.
 */
async function runCommand(command, targetHost = false) {
  let finalCommand = command;
  let executionContext = 'container';

  if (targetHost) {
    if (USE_SSH_FOR_HOST_INFO) {
      // Using sshpass for password-based SSH.
      // WARNING: This method of passing passwords is INSECURE.
      // Consider SSH key-based authentication with SSH agent forwarding or Docker secrets for production.
      const escapedCommand = command.replace(/'/g, "'\\''"); // Escape single quotes for shell
      finalCommand = `sshpass -p '${SSH_HOST_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SSH_HOST_USER}@${SSH_HOST_IP} '${escapedCommand}'`;
      executionContext = 'host via SSH';
    } else if (IS_RUNNING_IN_DOCKER) {
      // Default to chroot if in Docker and no SSH details provided
      finalCommand = `chroot ${HOST_CHROOT_PATH} ${command}`;
      executionContext = 'host via chroot';
    } else {
      // Not in Docker and not using SSH, implies the script is running directly on the desired host.
      executionContext = 'local host';
    }
  }

  logger.debug(`Executing (${executionContext}): ${finalCommand}`);

  try {
    // Use /bin/bash for proper command parsing and escaping, especially with sshpass
    const { stdout } = await execPromise(finalCommand, { shell: '/bin/bash' });
    return stdout.trim();
  } catch (error) {
    logger.error(`Error executing command "${finalCommand}" (${executionContext}): ${error.message}`);
    if (executionContext === 'host via SSH') {
      if (error.message.includes('Permission denied')) {
          logger.error("SSH Permission Denied. Check user, password, and host permissions.");
      } else if (error.message.includes('No route to host') || error.message.includes('Connection refused')) {
          logger.error("SSH Connection Failed. Check host IP, firewall, and SSH service status.");
      } else if (error.message.includes('sshpass: command not found')) {
          logger.error("sshpass is not installed in the container. Please install it.");
      }
    }
    return null;
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
    hostname: os.hostname(), // Container's hostname
    os: {
      platform: os.platform(), // Container's platform
      type: os.type(), // Container's OS type
      release: os.release(), // Container's kernel release (container's view)
      arch: os.arch(), // Container's architecture
      uptime: os.uptime(), // Container's uptime
      loadavg: os.loadavg(), // Container's load average
      os_release: await runCommand('cat /etc/os-release', true), // Host's OS release
      kernel_version: await runCommand('uname -a', true), // Host's kernel version
    },
    cpu: {
      model: os.cpus()[0] ? os.cpus()[0].model : 'N/A', // Container's view of CPU
      cores: os.cpus().length, // Container's view of CPU cores
      speed: os.cpus()[0] ? os.cpus()[0].speed : 'N/A', // Container's view of CPU speed
      lscpu_info: await runCommand('lscpu', true), // Host's lscpu info
    },
    memory: {
      total_bytes: os.totalmem(), // Container's memory limit if set, or host's if not
      free_bytes: os.freemem(), // Container's free memory
      total_gb: (os.totalmem() / (1024 ** 3)).toFixed(2), // Container's total GB
      free_gb: (os.freemem() / (1024 ** 3)).toFixed(2), // Container's free GB
      free_h_info: await runCommand('free -h', true), // Host's free -h info
    },
    network_interfaces: os.networkInterfaces(), // Container's network interfaces
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
    all_processes_ps_aux: await runCommand('ps aux', true), // Host's processes
    top_processes_snapshot: await runCommand('top -bn1 | head -n 20', true), // Host's top processes
  };
  return processInfo;
}

/**
 * Gathers disk and block device information.
 * @returns {Promise<object>} - An object containing disk info.
 */
async function getDiskInfo() {
  const diskInfo = {
    filesystem_usage_df_h: await runCommand('df -h', true), // Host's filesystem usage
    block_devices_lsblk_json: null, // Will try to parse JSON
  };

  const lsblkOutput = await runCommand('lsblk -J', true); // Host's block devices
  if (lsblkOutput) {
    try {
      diskInfo.block_devices_lsblk_json = JSON.parse(lsblkOutput);
    } catch (e) {
      logger.error('Failed to parse lsblk -J output for host:', e.message);
      diskInfo.block_devices_lsblk_json = lsblkOutput; // Store raw output if parsing fails
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
    kernel_config_sysctl_a: await runCommand('sysctl -a', true), // Host's kernel config
    loaded_modules_lsmod: await runCommand('lsmod', true), // Host's loaded modules
  };
  return kernelInfo;
}

/**
 * Gathers information about network services (listening ports).
 * Requires sudo for full details (PID/Program Name).
 * @returns {Promise<object>} - An object containing network service info.
 */
async function getNetworkServices() {
  const networkServices = {
    netstat_tulnp: await runCommand('netstat -tulnp', true), // Host's network services
    ss_tulnp: await runCommand('ss -tulnp', true), // Host's network services
    lsof_i_P_n: await runCommand('lsof -i -P -n', true), // Host's network connections
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
  };

  const psAuxOutput = await runCommand('ps aux', true); // Host's processes
  if (psAuxOutput) {
    // Check for common database processes
    if (psAuxOutput.includes('mysqld')) identifiedServices.databases.push('MySQL');
    if (psAuxOutput.includes('postgres')) identifiedServices.databases.push('PostgreSQL');
    if (psAuxOutput.includes('mongod')) identifiedServices.databases.push('MongoDB');
    if (psAuxOutput.includes('oracle')) identifiedServices.databases.push('Oracle');
    if (psAuxOutput.includes('redis-server')) identifiedServices.databases.push('Redis');
    if (psAuxOutput.includes('memcached')) identifiedServices.other_services.push('Memcached');

    // Check for common web servers
    if (psAuxOutput.includes('apache2') || psAuxOutput.includes('httpd')) identifiedServices.web_servers.push('Apache HTTP Server');
    if (psAuxOutput.includes('nginx')) identifiedServices.web_servers.push('Nginx');

    // Check for Docker daemon
    if (psAuxOutput.includes('dockerd')) identifiedServices.docker_daemon_status = 'Running';
    else identifiedServices.docker_daemon_status = 'Not Running (process not found)';
  }

  // Check systemd services (if systemd is used)
  const systemctlServices = await runCommand('systemctl list-units --type=service --all --no-pager', true); // Host's systemd services
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

  // Attempt to get installed packages (basic check for common package managers)
  const dpkgOutput = await runCommand('dpkg -l', true); // Host's dpkg packages
  if (dpkgOutput && dpkgOutput !== 'N/A') {
    if (dpkgOutput.includes('mysql-server')) identifiedServices.databases.push('MySQL (package)');
    if (dpkgOutput.includes('postgresql')) identifiedServices.databases.push('PostgreSQL (package)');
    if (dpkgOutput.includes('mongodb-org')) identifiedServices.databases.push('MongoDB (package)');
    if (dpkgOutput.includes('redis-server')) identifiedServices.databases.push('Redis (package)');
    if (dpkgOutput.includes('apache2')) identifiedServices.web_servers.push('Apache HTTP Server (package)');
    if (dpkgOutput.includes('nginx')) identifiedServices.web_servers.push('Nginx (package)');
    if (dpkgOutput.includes('docker-ce')) identifiedServices.other_services.push('Docker Engine (package)');
  } else {
    const rpmOutput = await runCommand('rpm -qa', true); // Host's rpm packages
    if (rpmOutput && rpmOutput !== 'N/A') {
      if (rpmOutput.includes('mysql-server')) identifiedServices.databases.push('MySQL (package)');
      if (rpmOutput.includes('postgresql-server')) identifiedServices.databases.push('PostgreSQL (package)');
      if (rpmOutput.includes('mongodb-org-server')) identifiedServices.databases.push('MongoDB (package)');
      if (rpmOutput.includes('redis')) identifiedServices.databases.push('Redis (package)');
      if (rpmOutput.includes('httpd')) identifiedServices.web_servers.push('Apache HTTP Server (package)');
      if (rpmOutput.includes('nginx')) identifiedServices.web_servers.push('Nginx (package)');
      if (rpmOutput.includes('docker-ce')) identifiedServices.other_services.push('Docker Engine (package)');
    }
  }

  // Deduplicate lists
  identifiedServices.databases = [...new Set(identifiedServices.databases)];
  identifiedServices.web_servers = [...new Set(identifiedServices.web_servers)];
  identifiedServices.other_services = [...new Set(identifiedServices.other_services)];

  return identifiedServices;
}

/**
 * Gathers detailed hardware information using lshw and dmidecode if available.
 * These commands often require root privileges.
 * @returns {Promise<object>} - An object containing hardware info.
 */
async function getHardwareInfo() {
  const hardwareInfo = {
    lshw_json: null, // Will try to parse JSON
    dmidecode_info: null,
  };

  // lshw -json provides structured hardware info
  const lshwOutput = await runCommand('lshw -json', true); // Host's lshw info
  if (lshwOutput) {
    try {
      hardwareInfo.lshw_json = JSON.parse(lshwOutput);
    } catch (e) {
      logger.error('Failed to parse lshw -json output for host:', e.message);
      hardwareInfo.lshw_json = lshwOutput; // Store raw output if parsing fails
    }
  }

  // dmidecode provides DMI table contents (BIOS, motherboard, memory, etc.)
  hardwareInfo.dmidecode_info = await runCommand('dmidecode', true); // Host's dmidecode info

  return hardwareInfo;
}

/**
 * Main function to collect all system information.
 * This serves as the single entry point for the chatbot.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} [sshHost=''] - The IP address or hostname of the SSH host.
 * @param {string} [sshUser=''] - The username for SSH authentication.
 * @param {string} [sshPassword=''] - The password for SSH authentication. WARNING: INSECURE.
 * @returns {Promise<object>} - A JSON object containing the comprehensive system information.
 */
async function collectSystemInfo(sessionId, sshHost = '', sshUser = '', sshPassword = '') {
  logger.info(`[Session: ${sessionId}] Starting system information collection.`);

  // Determine if running in Docker
  await checkIfRunningInDocker();

  // Set SSH configuration based on provided parameters
  if (sshHost && sshUser && sshPassword) {
    USE_SSH_FOR_HOST_INFO = true;
    SSH_HOST_IP = sshHost;
    SSH_HOST_USER = sshUser;
    SSH_HOST_PASSWORD = sshPassword; // WARNING: Insecure for production
    logger.info("SSH details provided. Attempting to collect host info via SSH.");
  } else {
    USE_SSH_FOR_HOST_INFO = false;
    if (IS_RUNNING_IN_DOCKER) {
      logger.info("No SSH details provided. Attempting to collect host info via chroot /host (Docker host).");
    } else {
      logger.info("Not running in Docker and no SSH details. Collecting local system info (assuming this is the target host).");
    }
  }

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