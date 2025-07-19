/**
 * @fileoverview A Node.js script to gather system information similar to Ohai.
 * This script is designed for Linux systems and uses child_process to execute
 * shell commands and fs to read system files.
 */

const { exec, execSync } = require('child_process');
const { promises: fs } = require('fs');
const os = require('os');

/**
 * Executes a shell command and returns its stdout.
 * @param {string} command The shell command to execute.
 * @returns {Promise<string>} A promise that resolves with the command's stdout.
 * @throws {Error} If the command fails.
 */
async function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // console.error(`Error executing command: ${command}`);
        // console.error(`stderr: ${stderr}`);
        return reject(error); // Reject to allow specific error handling in calling functions
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Reads the content of a file.
 * @param {string} filePath The path to the file.
 * @returns {Promise<string>} A promise that resolves with the file's content.
 * @throws {Error} If the file cannot be read.
 */
async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.warn(`Could not read file: ${filePath}. Error: ${error.message}`);
    return null; // Return null if file doesn't exist or can't be read
  }
}

/**
 * Gathers uptime information.
 * @returns {Promise<object>} Uptime in seconds and human-readable format.
 */
async function getUptime() {
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  const uptimeHuman = `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;
  return {
    uptime_seconds: uptimeSeconds,
    uptime: uptimeHuman,
  };
}

/**
 * Gathers CPU information.
 * @returns {Promise<object>} CPU details including model, cores, and flags.
 */
async function getCpuInfo() {
  const cpus = os.cpus();
  const cpuInfo = {
    cores: 0,
    total: cpus.length, // Logical cores/threads
    mhz: null, // This is harder to get consistently on Linux without parsing /proc/cpuinfo
    real: 0, // Physical processors
    vendor_id: null,
    model_name: null,
    family: null,
    model: null,
    stepping: null,
    flags: [],
  };

  if (cpus.length > 0) {
    cpuInfo.model_name = cpus[0].model;
    // Attempt to get more detailed CPU info from /proc/cpuinfo
    const cpuinfoContent = await readFileContent('/proc/cpuinfo');
    if (cpuinfoContent) {
      const lines = cpuinfoContent.split('\n');
      let physicalIds = new Set();
      let coreIds = new Set();

      lines.forEach(line => {
        if (line.startsWith('vendor_id')) {
          cpuInfo.vendor_id = line.split(':')[1].trim();
        } else if (line.startsWith('cpu family')) {
          cpuInfo.family = parseInt(line.split(':')[1].trim(), 10);
        } else if (line.startsWith('model')) {
          cpuInfo.model = parseInt(line.split(':')[1].trim(), 10);
        } else if (line.startsWith('stepping')) {
          cpuInfo.stepping = parseInt(line.split(':')[1].trim(), 10);
        } else if (line.startsWith('flags')) {
          cpuInfo.flags = line.split(':')[1].trim().split(' ');
        } else if (line.startsWith('cpu cores')) {
          // This gives cores per physical CPU
          cpuInfo.cores = parseInt(line.split(':')[1].trim(), 10);
        } else if (line.startsWith('physical id')) {
          physicalIds.add(line.split(':')[1].trim());
        } else if (line.startsWith('core id')) {
          coreIds.add(line.split(':')[1].trim());
        } else if (line.startsWith('cpu MHz')) {
          if (!cpuInfo.mhz) { // Take the first one found
            cpuInfo.mhz = parseFloat(line.split(':')[1].trim());
          }
        }
      });
      cpuInfo.real = physicalIds.size > 0 ? physicalIds.size : 1; // Default to 1 if not found
      cpuInfo.cores = coreIds.size > 0 ? coreIds.size * cpuInfo.real : cpuInfo.cores; // Adjust if core_id is available
    }
  }
  return cpuInfo;
}

/**
 * Gathers memory information.
 * @returns {Promise<object>} Memory details including total, free, active, inactive.
 */
async function getMemoryInfo() {
  const memInfo = {
    total: `${Math.round(os.totalmem() / (1024 * 1024))}MB`,
    free: `${Math.round(os.freemem() / (1024 * 1024))}MB`,
    active: null,
    inactive: null,
  };

  // On Linux, we can get more detailed memory info from /proc/meminfo
  const meminfoContent = await readFileContent('/proc/meminfo');
  if (meminfoContent) {
    const lines = meminfoContent.split('\n');
    lines.forEach(line => {
      if (line.startsWith('Active:')) {
        memInfo.active = `${Math.round(parseInt(line.split(':')[1].trim().split(' ')[0], 10) / 1024)}MB`;
      } else if (line.startsWith('Inactive:')) {
        memInfo.inactive = `${Math.round(parseInt(line.split(':')[1].trim().split(' ')[0], 10) / 1024)}MB`;
      }
    });
  }
  return memInfo;
}

/**
 * Gathers network interface information.
 * @returns {Promise<object>} Network interfaces with addresses, flags, etc.
 */
async function getNetworkInfo() {
  const networkInterfaces = os.networkInterfaces();
  const interfaces = {};

  for (const name in networkInterfaces) {
    const iface = networkInterfaces[name];
    interfaces[name] = {
      addresses: {},
      mtu: null, // Requires parsing ip link show
      flags: [], // Requires parsing ip link show
      type: null, // Derived from interface name or ip link show
      number: null, // Derived from interface name
      encapsulation: null, // Derived from interface name or ip link show
      arp: {}, // Requires parsing `arp -n`
    };

    iface.forEach(details => {
      const family = details.family === 'IPv4' ? 'inet' : 'inet6';
      if (details.mac) {
        interfaces[name].addresses[details.mac] = { family: 'lladdr' };
      }
      if (details.address) {
        interfaces[name].addresses[details.address] = {
          family: family,
          netmask: details.netmask,
          // For IPv6, os.networkInterfaces provides 'scopeid' which can be mapped to 'scope'
          ...(family === 'inet6' && details.scopeid !== undefined ? { scope: details.scopeid === 0 ? 'Global' : 'Link' } : {}),
          // For IPv6, prefixlen is not directly available from os.networkInterfaces,
          // but can be calculated from netmask or obtained from `ip -6 addr show`
          ...(family === 'inet6' ? { prefixlen: calculatePrefixLen(details.netmask) } : {}),
          ...(details.broadcast ? { broadcast: details.broadcast } : {}),
        };
      }
    });

    // Attempt to get more detailed info from `ip link show <interface>`
    try {
      const ipLinkShow = await executeCommand(`ip link show ${name}`);
      const linkMatch = ipLinkShow.match(/<([^>]+)>/);
      if (linkMatch && linkMatch[1]) {
        interfaces[name].flags = linkMatch[1].split(',');
      }
      const mtuMatch = ipLinkShow.match(/mtu (\d+)/);
      if (mtuMatch && mtuMatch[1]) {
        interfaces[name].mtu = parseInt(mtuMatch[1], 10);
      }
      const typeMatch = ipLinkShow.match(/link\/(\w+)/);
      if (typeMatch && typeMatch[1]) {
        interfaces[name].encapsulation = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1);
        interfaces[name].type = typeMatch[1];
      }
      const numberMatch = name.match(/\D+(\d+)/);
      if (numberMatch && numberMatch[1]) {
        interfaces[name].number = parseInt(numberMatch[1], 10);
      }
    } catch (e) {
      console.warn(`Could not get ip link info for ${name}: ${e.message}`);
    }

    // Attempt to get ARP entries for the interface
    try {
      const arpOutput = await executeCommand(`arp -n -i ${name}`);
      arpOutput.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && parts[0].match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          interfaces[name].arp[parts[0]] = parts[2];
        }
      });
    } catch (e) {
      // This is common for interfaces without ARP, so suppress verbose warning
    }
  }

  // Get default interface (requires parsing `ip route`)
  let defaultInterface = null;
  try {
    const ipRouteOutput = await executeCommand('ip route | grep default');
    const defaultMatch = ipRouteOutput.match(/dev (\w+)/);
    if (defaultMatch && defaultMatch[1]) {
      defaultInterface = defaultMatch[1];
    }
  } catch (e) {
    console.warn(`Could not get default interface: ${e.message}`);
  }

  return {
    interfaces: interfaces,
    default_interface: defaultInterface,
    // Network settings are complex and require parsing /proc/sys/net/* or sysctl -a
    // This is a placeholder for demonstration
    settings: {},
  };
}

/**
 * Calculates IPv6 prefix length from netmask (not directly available from os.networkInterfaces)
 * This is a simplified implementation.
 * @param {string} netmask The IPv6 netmask.
 * @returns {number|null} The prefix length or null if calculation fails.
 */
function calculatePrefixLen(netmask) {
  // For IPv6, netmask is usually given as a full IPv6 address,
  // we need to count the leading 1s.
  // This is a simplification and might not be accurate for all cases.
  if (netmask && netmask.includes(':')) {
    try {
      let prefixLen = 0;
      const parts = netmask.split(':');
      for (const part of parts) {
        const hex = parseInt(part, 16);
        prefixLen += (hex >>> 0).toString(2).split('1').length - 1;
      }
      return prefixLen;
    } catch (e) {
      return null;
    }
  }
  return null;
}


/**
 * Gathers OS information.
 * @returns {Promise<object>} OS details including name, version, platform.
 */
async function getOsInfo() {
  const osInfo = {
    name: os.type(),
    release: os.release(),
    version: os.version(),
    platform: os.platform(),
    os_version: null, // Will try to get from /etc/os-release
    platform_version: null, // Will try to get from /etc/os-release
    platform_build: null, // Not easily available on Linux universally
    platform_family: null, // e.g., "debian", "rhel"
    hostname: os.hostname(),
    machinename: os.hostname(), // Often same as hostname on Linux
    fqdn: null, // Requires `hostname -f`
    domain: null, // Requires parsing /etc/resolv.conf or similar
  };

  // Get FQDN
  try {
    osInfo.fqdn = await executeCommand('hostname -f');
  } catch (e) {
    console.warn(`Could not get FQDN: ${e.message}`);
  }

  // Get OS release information from /etc/os-release
  const osReleaseContent = await readFileContent('/etc/os-release');
  if (osReleaseContent) {
    const lines = osReleaseContent.split('\n');
    lines.forEach(line => {
      if (line.startsWith('VERSION_ID=')) {
        osInfo.os_version = line.split('=')[1].replace(/"/g, '');
        osInfo.platform_version = osInfo.os_version;
      } else if (line.startsWith('ID=')) {
        osInfo.platform_family = line.split('=')[1].replace(/"/g, '');
      }
    });
  }

  return osInfo;
}

/**
 * Gathers filesystem information.
 * @returns {Promise<object>} Filesystem details by device, mountpoint, and pair.
 */
async function getFilesystemInfo() {
  const filesystem = {
    by_device: {},
    by_mountpoint: {},
    by_pair: {},
  };

  try {
    const dfOutput = await executeCommand('df -PkT'); // -P for POSIX, -k for KB, -T for type
    const lines = dfOutput.split('\n').slice(1); // Skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 7) continue; // Skip incomplete lines

      const [filesystemDevice, type, blocks, used, available, capacity, mountpoint] = parts;

      const fsEntry = {
        block_size: 1024, // df -PkT reports in 1KB blocks
        kb_size: blocks,
        kb_used: used,
        kb_available: available,
        percent_used: capacity,
        inodes_used: null, // df -i for inodes
        inodes_available: null,
        total_inodes: null,
        inodes_percent_used: null,
        fs_type: type,
        mount_options: [], // Requires parsing /proc/mounts or mount command
        mounts: [mountpoint],
      };

      // Get inode info
      try {
        const dfiOutput = await executeCommand(`df -Pi ${mountpoint}`);
        const dfiLines = dfiOutput.split('\n').slice(1);
        if (dfiLines.length > 0) {
          const dfiParts = dfiLines[0].trim().split(/\s+/);
          if (dfiParts.length >= 6) {
            fsEntry.inodes_used = dfiParts[2];
            fsEntry.inodes_available = dfiParts[3];
            fsEntry.total_inodes = dfiParts[1];
            fsEntry.inodes_percent_used = dfiParts[4];
          }
        }
      } catch (e) {
        // console.warn(`Could not get inode info for ${mountpoint}: ${e.message}`);
      }

      // Get mount options from /proc/mounts
      const mountsContent = await readFileContent('/proc/mounts');
      if (mountsContent) {
        const mountLines = mountsContent.split('\n');
        for (const mLine of mountLines) {
          const mParts = mLine.split(' ');
          if (mParts.length >= 4 && mParts[1] === mountpoint) {
            fsEntry.mount_options = mParts[3].split(',');
            break;
          }
        }
      }

      filesystem.by_device[filesystemDevice] = fsEntry;
      filesystem.by_mountpoint[mountpoint] = { ...fsEntry, devices: [filesystemDevice] };
      filesystem.by_pair[`${filesystemDevice},${mountpoint}`] = { ...fsEntry, device: filesystemDevice, mount: mountpoint };
    }
  } catch (e) {
    console.error(`Error gathering filesystem info: ${e.message}`);
  }

  return filesystem;
}

/**
 * Gathers information about installed languages (e.g., Python, Node.js, Ruby, Go, PHP, Java).
 * This is a simplified approach, checking for common executables and their versions.
 * @returns {Promise<object>} Detected languages and their versions.
 */
async function getLanguagesInfo() {
  const languages = {};

  const checks = [
    { name: 'node', command: 'node -v', parser: (output) => output.replace('v', '') },
    { name: 'python', command: 'python -V 2>&1', parser: (output) => output.split(' ')[1] },
    { name: 'python3', command: 'python3 -V 2>&1', parser: (output) => output.split(' ')[1] },
    { name: 'ruby', command: 'ruby -v', parser: (output) => output.split(' ')[1] },
    { name: 'go', command: 'go version', parser: (output) => output.split(' ')[2].replace('go', '') },
    { name: 'php', command: 'php -v', parser: (output) => output.split('\n')[0].split(' ')[1] },
    { name: 'java', command: 'java -version 2>&1', parser: (output) => output.split('\n')[0].match(/"(.*?)"/)?.[1] },
    { name: 'perl', command: 'perl -v', parser: (output) => output.match(/v(\d+\.\d+\.\d+)/)?.[1] },
    { name: 'gcc', command: 'gcc -v 2>&1', parser: (output) => output.match(/gcc version (\d+\.\d+\.\d+)/)?.[1] },
    { name: 'mono', command: 'mono --version', parser: (output) => output.match(/version (\d+\.\d+\.\d+\.\d+)/)?.[1] },
  ];

  for (const check of checks) {
    try {
      const output = await executeCommand(check.command);
      const version = check.parser(output);
      if (version) {
        languages[check.name] = { version: version };
        // Add more details if parsing is more complex (like for PHP or Java)
        if (check.name === 'php') {
          const buildDateMatch = output.match(/built: (.+?)\s+--/);
          if (buildDateMatch) languages.php.builddate = buildDateMatch[1].trim();
          const zendEngineMatch = output.match(/Zend Engine v(\d+\.\d+\.\d+)/);
          if (zendEngineMatch) languages.php.zend_engine_version = zendEngineMatch[1];
        }
        if (check.name === 'java') {
          const runtimeMatch = output.match(/Runtime Environment: (.+?)\s+\((.+?)\)/);
          if (runtimeMatch) {
            languages.java.runtime = {
              name: runtimeMatch[1].trim(),
              build: runtimeMatch[2].trim()
            };
          }
        }
        if (check.name === 'gcc') {
          const configuredWithMatch = output.match(/Configured with: (.+)/);
          if (configuredWithMatch) languages.c = { gcc: { configured_with: configuredWithMatch[1].trim() } };
          const descriptionMatch = output.match(/(\w+ clang version .+)/);
          if (descriptionMatch) languages.c.gcc.description = descriptionMatch[1].trim();
          const targetMatch = output.match(/Target: (.+)/);
          if (targetMatch) languages.c.gcc.target = targetMatch[1].trim();
          const threadModelMatch = output.match(/Thread model: (.+)/);
          if (threadModelMatch) languages.c.gcc.thread_model = threadModelMatch[1].trim();
        }
      }
    } catch (e) {
      // Language not found or command failed, skip it
    }
  }
  return languages;
}

/**
 * Gathers user and group information from /etc/passwd and /etc/group.
 * This is a simplified implementation.
 * @returns {Promise<object>} Users and groups with their details.
 */
async function getEtcInfo() {
  const etc = {
    passwd: {},
    group: {},
  };

  // Parse /etc/passwd
  const passwdContent = await readFileContent('/etc/passwd');
  if (passwdContent) {
    passwdContent.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length === 7) {
        const [username, , uid, gid, gecos, dir, shell] = parts;
        etc.passwd[username] = {
          uid: parseInt(uid, 10),
          gid: parseInt(gid, 10),
          gecos: gecos,
          dir: dir,
          shell: shell,
        };
      }
    });
  }

  // Parse /etc/group
  const groupContent = await readFileContent('/etc/group');
  if (groupContent) {
    groupContent.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length === 4) {
        const [groupname, , gid, membersStr] = parts;
        etc.group[groupname] = {
          gid: parseInt(gid, 10),
          members: membersStr ? membersStr.split(',') : [],
        };
      }
    });
  }

  return etc;
}

/**
 * Gathers current user information.
 * @returns {Promise<string>} The current username.
 */
async function getCurrentUser() {
  try {
    return await executeCommand('whoami');
  } catch (e) {
    console.warn(`Could not get current user: ${e.message}`);
    return null;
  }
}

/**
 * Gathers SSH host key information.
 * @returns {Promise<object>} Public SSH host keys.
 */
async function getSshKeys() {
  const sshKeys = {
    host_dsa_public: null,
    host_rsa_public: null,
    host_ecdsa_public: null,
    host_ecdsa_type: null,
    host_ed25519_public: null,
  };

  const sshDir = '/etc/ssh/';
  const keyFiles = {
    'ssh_host_dsa_key.pub': 'host_dsa_public',
    'ssh_host_rsa_key.pub': 'host_rsa_public',
    'ssh_host_ecdsa_key.pub': 'host_ecdsa_public',
    'ssh_host_ed25519_key.pub': 'host_ed25519_public',
  };

  for (const file in keyFiles) {
    const content = await readFileContent(`${sshDir}${file}`);
    if (content) {
      const parts = content.trim().split(' ');
      if (parts.length >= 2) {
        sshKeys[keyFiles[file]] = parts[1];
        if (file === 'ssh_host_ecdsa_key.pub') {
          sshKeys.host_ecdsa_type = parts[0];
        }
      }
    }
  }
  return sshKeys;
}

/**
 * Gathers information about available shells.
 * @returns {Promise<string[]>} A list of available shells.
 */
async function getShells() {
  const shellsContent = await readFileContent('/etc/shells');
  if (shellsContent) {
    return shellsContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }
  return [];
}

/**
 * Gathers information about installed applications and their versions using common package managers.
 * @returns {Promise<object>} An object where keys are package names and values are their versions.
 */
async function getInstalledApplications() {
  const applications = {};

  // Try dpkg (Debian/Ubuntu)
  try {
    const dpkgOutput = await executeCommand('dpkg -l');
    dpkgOutput.split('\n').forEach(line => {
      // Example line: "ii  apache2       2.4.41-4ubuntu3.1  amd64        Apache HTTP Server"
      // We are looking for lines starting with 'ii' (installed, desired state)
      const match = line.match(/^ii\s+(\S+)\s+(\S+)/);
      if (match) {
        const packageName = match[1];
        const version = match[2];
        applications[packageName] = version;
      }
    });
  } catch (e) {
    console.warn(`dpkg not found or failed: ${e.message}`);
  }

  // Try rpm (Red Hat/CentOS/Fedora)
  try {
    // Using --queryformat to get a consistent output of NAME:VERSION
    const rpmOutput = await executeCommand('rpm -qa --queryformat \'%{NAME}:%{VERSION}\\n\'');
    rpmOutput.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const packageName = parts[0];
        const version = parts[1];
        applications[packageName] = version;
      }
    });
  } catch (e) {
    console.warn(`rpm not found or failed: ${e.message}`);
  }

  // Try pacman (Arch Linux)
  try {
    const pacmanOutput = await executeCommand('pacman -Q');
    pacmanOutput.split('\n').forEach(line => {
      // Example line: "bash 5.1.008-1"
      const match = line.match(/^(\S+)\s+(\S+)/);
      if (match) {
        const packageName = match[1];
        const version = match[2];
        applications[packageName] = version;
      }
    });
  } catch (e) {
    console.warn(`pacman not found or failed: ${e.message}`);
  }

  return applications;
}


/**
 * Main function to gather all system information.
 * @returns {Promise<object>} A comprehensive object containing system information.
 */
async function gatherSystemInfo() {
  const result = {};

  const [
    uptimeInfo,
    cpuInfo,
    memoryInfo,
    networkInfo,
    osInfo,
    filesystemInfo,
    languagesInfo,
    etcInfo,
    currentUser,
    sshKeys,
    shells,
    installedApplications, // New: Installed applications
  ] = await Promise.all([
    getUptime(),
    getCpuInfo(),
    getMemoryInfo(),
    getNetworkInfo(),
    getOsInfo(),
    getFilesystemInfo(),
    getLanguagesInfo(),
    getEtcInfo(),
    getCurrentUser(),
    getSshKeys(),
    getShells(),
    getInstalledApplications(), // New: Call the function
  ]);

  Object.assign(result, uptimeInfo);
  result.cpu = cpuInfo;
  result.memory = memoryInfo;
  result.network = networkInfo;
  Object.assign(result, osInfo);
  result.filesystem = filesystemInfo;
  result.languages = languagesInfo;
  result.etc = etcInfo;
  result.current_user = currentUser;
  result.keys = { ssh: sshKeys };
  result.shells = shells;
  result.applications = installedApplications; // New: Add to result
  result.ohai_time = Date.now() / 1000; // Current timestamp in seconds

  // Add placeholders for information that is more complex or platform-specific
  result.chef_packages = { ohai: { version: 'Node.js-Ohai-like-script' } };
  result.kernel = {
    name: os.type(),
    release: os.release(),
    version: os.version(),
    machine: os.arch(),
    processor: os.arch(), // On Linux, os.arch() is usually sufficient
    os: os.type(),
    modules: {}, // Gathering kernel modules is complex and varies by distro
  };
  result.platform = os.platform(); // 'linux'
  result.platform_family = osInfo.platform_family || os.platform(); // e.g., 'debian' or 'linux'
  result.platform_version = osInfo.platform_version || os.release();
  result.platform_build = null; // Not typically available on Linux
  result.dmi = {}; // DMI info requires parsing `dmidecode` output
  result.hardware = {
    // Hardware info like serial number, machine model, etc. requires parsing `dmidecode`
    // or specific /sys/class/dmi/id files.
    // For now, use basic info from os module.
    operating_system: os.type(),
    operating_system_version: os.release(),
    architecture: os.arch(),
    storage: [], // Requires parsing `lsblk` or `/proc/partitions`
    battery: {}, // Requires parsing /sys/class/power_supply/
  };
  result.virtualization = {
    systems: {},
    system: null,
    role: null,
  };
  result.cloud = null; // Cloud detection is complex
  result.root_group = 'root'; // Common default on Linux
  result.time = {
    timezone: execSync('date +%Z').toString().trim(), // Get timezone
  };
  result.command = {
    ps: 'ps -ef', // Common ps command on Linux
  };

  return result;
}

// Execute the main function and print the result as JSON
gatherSystemInfo()
  .then(info => {
    console.log(JSON.stringify(info, null, 2));
  })
  .catch(error => {
    console.error('Failed to gather system information:', error);
    process.exit(1);
  });
