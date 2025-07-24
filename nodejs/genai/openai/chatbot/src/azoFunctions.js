const path = require('path');
const fs = require('fs');
const os = require('os');
const { Mutex } = require('async-mutex');
const superagent = require('superagent');
const logger = require('./logger');

const {
  mkdir,
  getOrCreateSessionTempDir,
} = require('./utilities');

// Azure DevOps specific constants - these would ideally come from environment variables or configuration
const AZURE_DEVOPS_API_VERSION = '7.1-preview.1'; // Or newer
const { AZURE_DEVOPS_PAT } = process.env; // Personal Access Token
const USER_AGENT = 'AIBot-AzureDevOps'; // Custom user agent

/**
 * Encodes a Personal Access Token for Basic Authentication.
 * @param {string} pat The Azure DevOps Personal Access Token.
 * @returns {string} Base64 encoded string for the Authorization header.
 */
function encodePat(pat) {
  return Buffer.from(`:${pat}`).toString('base64');
}

/**
 * Manages mutexes for download URLs per session to prevent concurrent downloads
 * of the same file.
 * @type {Map<string, Map<string, Mutex>>}
 */
const downloadMutexes = new Map();

/**
 * Gets or creates a mutex for a specific download URL within a session.
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} downloadUrl The URL of the file being downloaded.
 * @returns {Mutex} The mutex for the download URL in the session.
 */
function getDownloadMutex(sessionId, downloadUrl) {
  if (!downloadMutexes.has(sessionId)) {
    downloadMutexes.set(sessionId, new Map());
  }
  const sessionMutexes = downloadMutexes.get(sessionId);
  if (!sessionMutexes.has(downloadUrl)) {
    sessionMutexes.set(downloadUrl, new Mutex());
  }
  return sessionMutexes.get(downloadUrl);
}

/**
 * Handles "Not Found" errors from the Azure DevOps Git API.
 * If the error message indicates "Not Found" or 404 status, it throws a more
 * user-friendly error suggesting the user reword their request.
 * Otherwise, it re-throws the original error.
 * @param {Error} error The error object caught from the API call (could be Superagent error with response).
 * @param {string} [context=''] Optional context for the error message.
 * @throws {Error} Modified error for "Not Found" or the original.
 */
function handleNotFoundError(error, context = '') {
  const isNotFound = (error.response && error.response.status === 404) || error.message.includes('Not Found');
  if (isNotFound) {
    throw new Error(
      `Resource Not Found ${context}: Please check the provided details (organization, project, repository, path, branch).`,
    );
  }
  throw error;
}

/**
 * Logs and throws a custom error for Azure DevOps API responses that
 * indicate an error status. Includes status, text, and body message.
 * @param {object} response The SuperAgent response object.
 * @param {string} [context=''] Optional context for the error message.
 * @throws {Error} Custom error detailing the Azure DevOps API error.
 */
async function handleAzureDevopsApiError(response, context = '') {
  logger.error(
    `Azure DevOps API Error ${context} (status):`,
    response.status,
    response.statusText,
    response.body,
  );
  let errorMessage = `Azure DevOps API Error ${context}: ${response.status} - ${response.statusText}`;
  if (response.body && response.body.message) {
    errorMessage += ` - ${response.body.message}`;
  } else if (response.body && response.body.value) { // Azure DevOps often puts error in 'value'
    errorMessage += ` - ${response.body.value}`;
  }
  throw new Error(errorMessage);
}

/**
 * Helper function to download a file from an Azure DevOps URL for raw content.
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} filePath The full path to the file within the repository.
 * @param {string} branchName The branch name to download from.
 * @param {string} localFilePath The local path to save the file.
 */
async function downloadAzoFile(sessionId, organization, project, repoName, filePath, branchName, localFilePath) {
  // We need to resolve repoName to repo ID first if not already done.
  // For simplicity here, assuming repoName can be used directly or ID is resolved elsewhere.
  // In a real scenario, you'd likely call checkAzoRepoExists or similar to get the ID.
  const repoId = repoName; // Placeholder: In practice, resolve to actual ID

  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoId}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${encodeURIComponent(branchName)}&api-version=${AZURE_DEVOPS_API_VERSION}&download=true`;

  const downloadMutex = getDownloadMutex(sessionId, url);
  const release = await downloadMutex.acquire();

  try {
    const request = superagent.get(url);
    request.set('User-Agent', USER_AGENT);
    if (AZURE_DEVOPS_PAT) {
      request.set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);
    }

    request.buffer(true);
    request.parse(superagent.parse['application/octet-stream']);

    const response = await request;

    if (response.status !== 200) {
      const errorMsg = `HTTP ${response.status} - ${response.text}`;
      logger.error(
        'Error downloading Azure DevOps file (HTTP Status):',
        url,
        localFilePath,
        errorMsg,
        `[Session: ${sessionId}]`,
      );
      throw new Error(`Error downloading ${url}: ${errorMsg}`);
    }

    if (Buffer.isBuffer(response.body)) {
      logger.debug(`Downloading file: ${url} to ${localFilePath} [Session: ${sessionId}]`);
      const stats = await fs.promises.stat(localFilePath).catch(() => null);
      if (stats && stats.isDirectory()) {
        logger.warn(`Skipping download: ${localFilePath} is a directory.`);
      } else {
        await fs.promises.writeFile(localFilePath, response.body);
      }
    } else {
      const errorMsg = `Expected Buffer, received ${typeof response.body}`;
      logger.error(
        'Error downloading Azure DevOps file (Invalid Body):',
        url,
        localFilePath,
        errorMsg,
        `[Session: ${sessionId}]`,
      );
      throw new Error(`Error downloading ${url}: ${errorMsg}`);
    }
  } catch (error) {
    const errorMessage = error.message || error;
    const errorDetails = error.response
      ? `Status: ${error.response.status}, Text: ${error.response.text}`
      : 'No response details';
    logger.error(
      'Error downloading Azure DevOps file (exception): '
      + `${url} `
      + `${localFilePath} `
      + `${errorMessage} `
      + `${errorDetails} `
      + `[Session: ${sessionId}]`,
    );
    throw error;
  } finally {
    release();
  }
}

const BINARY_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
  '.svg',
  '.mp3', '.wav', '.aac', '.flac', '.ogg',
  '.mp4', '.avi', '.mkv', '.mov', '.wmv',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.lib', '.a',
  '.sqlite', '.db',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.ico',
  '.swf', '.fla',
  '.class', '.jar',
  '.apk',
  '.dmg', '.iso',
  '.obj', '.stl', '.3ds',
]);

/**
 * Recursively fetches files and directories from an Azure DevOps Git repository for a specific session.
 * Optionally skips potential binary files based on extension.
 *
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} repoDirName The current path being fetched within the repository.
 * @param {string} branchName The branch name to fetch from.
 * @param {string} [localDestPath=null] Optional local destination path.
 * @param {boolean} [skipBinaryFiles=true] Whether to skip downloading files likely to be binary.
 */
async function fetchAzoRepoContentsRecursive(
  sessionId,
  organization,
  project,
  repoName,
  repoDirName,
  branchName,
  localDestPath = null,
  skipBinaryFiles = true,
) {
  let baseLocalDestPath;
  if (localDestPath) {
    baseLocalDestPath = localDestPath;
  } else {
    baseLocalDestPath = await getOrCreateSessionTempDir(sessionId);
  }

  // Azure DevOps Git Items API: /{organization}/{project}/_apis/git/repositories/{repositoryId}/items
  // RecursionLevel=Full gets all items recursively from the specified path.
  const apiUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(repoDirName)}&versionDescriptor.version=${encodeURIComponent(branchName)}&recursionLevel=Full&api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    logger.debug(`Fetching repo contents from Azure DevOps API URL: ${apiUrl} [Session: ${sessionId}]`);

    const request = superagent.get(apiUrl);
    request.set('User-Agent', USER_AGENT);
    if (AZURE_DEVOPS_PAT) {
      request.set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);
    }

    const response = await request;

    if (response.status !== 200) {
      logger.error(
        `Azure DevOps API error for path "${repoDirName}" [Session: ${sessionId}]: HTTP `
        + `${response.status} - ${response.text}`,
      );
      handleNotFoundError(
        response,
        ` for repository ${organization}/${project}/${repoName} at path "${repoDirName}"`,
      );
      // This line will not be reached as handleNotFoundError throws
      // return { success: false, message: `Azure DevOps API error: HTTP ${response.status} for ${apiUrl}` };
    }

    const items = response.body.value; // Azure DevOps responses often have a 'value' array

    if (!Array.isArray(items)) {
      // This case might happen if querying for a single file directly
      logger.warn(`Expected an array of items from Azure DevOps API for path "${repoDirName}", but received: ${typeof items} [Session: ${sessionId}]`);
      if (items && items.gitItemType === 'File' && items.url) { // Check for single file
        const filePath = path.join(baseLocalDestPath, items.path);

        if (skipBinaryFiles) {
          const extension = path.extname(items.path).toLowerCase();
          if (BINARY_EXTENSIONS.has(extension)) {
            logger.info(`Skipping potential binary single file: "${items.path}" (Extension: ${extension}) [Session: ${sessionId}]`);
            return { success: true, message: `Skipped potential binary single file at path "${repoDirName}"` };
          }
        }

        try {
          const parentDir = path.dirname(filePath);
          if (parentDir !== baseLocalDestPath && parentDir !== os.tmpdir()) {
            if (parentDir.startsWith(baseLocalDestPath)) {
              logger.debug(`Creating parent directory for single file: ${parentDir} [Session: ${sessionId}]`);
              await mkdir(parentDir);
            } else {
              logger.warn(`Attempted to create directory outside base temp dir: ${parentDir} [Session: ${sessionId}]`);
              throw new Error(`Attempted to create directory outside base temporary directory: ${parentDir}`);
            }
          } else {
            logger.debug(`Skipping mkdir call on baseLocalDestPath for single file ${items.name}`);
          }

          // Use the new Azure DevOps specific download function
          await downloadAzoFile(sessionId, organization, project, repoName, items.path, branchName, filePath);
          return { success: true, message: `Processed single item at path "${repoDirName}"` };
        } catch (error) {
          const errorMessage = error.message || error;
          const errorDetails = error.response ? `Status: ${error.response.status}, Text: ${error.response.text}` : 'No response details';
          logger.error(
            `Error downloading single file "${items.path}" "${filePath}" [Session: ${sessionId}]: `
            + `${errorMessage} - ${errorDetails}`,
            error,
          );
          throw new Error(
            `Error downloading single file "${items.path}": ${errorMessage} - ${errorDetails}`,
          );
        }
      }
      return { success: true, message: `Processed non-file single item at path "${repoDirName}"` };
    }

    // Refactor to use Promise.all for concurrent downloads
    const downloadPromises = items.map(async (item) => {
      const currentLocalPath = path.join(baseLocalDestPath, item.path);

      if (item.gitItemType === 'File') {
        if (skipBinaryFiles) {
          const extension = path.extname(item.path).toLowerCase();
          if (BINARY_EXTENSIONS.has(extension)) {
            logger.info(`Skipping potential binary file: "${item.path}" (Extension: ${extension}) [Session: ${sessionId}]`);
            return null; // Return null to indicate skipping
          }
        }
        try {
          const parentDir = path.dirname(currentLocalPath);
          if (parentDir.startsWith(baseLocalDestPath)) {
            await mkdir(parentDir);
          } else {
            logger.warn(`Attempted to create directory outside base temp dir: ${parentDir} [Session: ${sessionId}]`);
            throw new Error(`Attempted to create directory outside base temporary directory: ${parentDir}`);
          }
          await downloadAzoFile(sessionId, organization, project, repoName, item.path, branchName, currentLocalPath);
          return { success: true, message: `Downloaded file "${item.path}"` };
        } catch (error) {
          const errorMessage = error.message || error;
          const errorDetails = error.response
            ? `Status: ${error.response.status}, Text: ${error.response.text}`
            : 'No response details';
          logger.error(
            `Error downloading file "${item.path}" [Session: ${sessionId}]: `
            + `${errorMessage} - ${errorDetails}`,
            error,
          );
          throw new Error(
            `Error downloading file "${item.path}": ${errorMessage} - ${errorDetails}`,
          );
        }
      } else if (item.gitItemType === 'Folder') {
        logger.debug(`Found folder: ${item.path}. Content should be included by recursionLevel=Full.`);
        return { success: true, message: `Processed folder "${item.path}"` };
      }
      logger.warn(`Unknown item type "${item.gitItemType}" for item: ${item.path} [Session: ${sessionId}]`);
      return { success: false, message: `Unknown item type "${item.gitItemType}" for item: ${item.path}` };
    });

    const downloadResults = await Promise.all(downloadPromises);
    const successfulDownloads = downloadResults.filter((result) => result !== null);

    return {
      success: true,
      message: `Successfully processed directory "${repoDirName}"`,
      downloadResults: successfulDownloads,
    };
  } catch (error) {
    const errorMessage = error.message || error;
    logger.error(
      'Error in fetchAzoRepoContentsRecursive (exception - Azure DevOps): '
      + `${repoDirName} [Session: ${sessionId}]: ${errorMessage}`,
      error,
    );
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error('Not Found: Check organization, project, repo and directory names.');
      }
      throw new Error(
        error.response.body
          ? (error.response.body.message || JSON.stringify(error.response.body))
          : `Failed to download repo contents. Status: ${error.response.status}`,
      );
    }
    throw error;
  }
}

/**
 * Lists the names of repositories for a given Azure DevOps organization and project.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @returns {Promise<string[]>} Array of repository names.
 * @throws {Error} If API request fails or project is not found.
 */
async function listAzoRepos(organization, project) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories?api-version=${AZURE_DEVOPS_API_VERSION}`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      return response.body.value.map((repo) => repo.name);
    }
    // If status is not 200, an error is thrown by handleAzureDevopsApiError
    await handleAzureDevopsApiError(response, `listing repos for ${organization}/${project}`);
    // This line is unreachable, but added for consistent-return if the linter requires it
    return [];
  } catch (error) {
    logger.error('Error listing repos (exception - Azure DevOps):', organization, project, error);
    handleNotFoundError(error, ` for organization "${organization}" and project "${project}"`);
    // This line is unreachable, but added for consistent-return if the linter requires it
    throw error;
  }
}

/**
 * Retrieves the default branch name for a given Azure DevOps Git repository.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @returns {Promise<string>} The name of the default branch (e.g., 'main').
 * @throws {Error} If the API request fails or the repository is not found.
 */
async function getAzoDefaultBranch(organization, project, repoName) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}?api-version=${AZURE_DEVOPS_API_VERSION}`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (response.status === 200 && response.body.defaultBranch) {
      // Azure DevOps defaultBranch is like "refs/heads/main"
      const branchFullName = response.body.defaultBranch;
      const branchName = branchFullName.startsWith('refs/heads/') ? branchFullName.substring('refs/heads/'.length) : branchFullName;
      logger.debug(`Default branch for ${organization}/${project}/${repoName} is: ${branchName}`);
      return branchName;
    }
    await handleAzureDevopsApiError(response, `getting default branch for ${organization}/${project}/${repoName}`);
    return ''; // Unreachable, but for consistent-return
  } catch (error) {
    logger.error('Error getting default branch (exception - Azure DevOps):', organization, project, repoName, error);
    handleNotFoundError(error, ` for repository ${organization}/${project}/${repoName}`);
    throw error; // Unreachable, but for consistent-return
  }
}

/**
 * Lists the names of branches for a given Azure DevOps Git repository.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @returns {Promise<string[]>} Array of branch names.
 * @throws {Error} If API request fails or repository is not found.
 */
async function listAzoBranches(organization, project, repoName) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/&api-version=${AZURE_DEVOPS_API_VERSION}`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      // Azure DevOps returns refs like { "name": "refs/heads/main", ... }
      return response.body.value.map((ref) => (ref.name.startsWith('refs/heads/') ? ref.name.substring('refs/heads/'.length) : ref.name));
    }
    await handleAzureDevopsApiError(response, `listing branches for ${organization}/${project}/${repoName}`);
    return []; // Unreachable, but for consistent-return
  } catch (error) {
    logger.error('Error listing branches (exception - Azure DevOps):', organization, project, repoName, error);
    handleNotFoundError(error, ` for repository ${organization}/${project}/${repoName}`);
    throw error; // Unreachable, but for consistent-return
  }
}

/**
 * Lists commit history for a specific file or directory in a
 * given Azure DevOps Git repository.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} repoDirName The path to the file or directory within the repository.
 * @returns {Promise<Array<{ sha: string, message: string, author: string, date: string }>>}
 * Array of commit history objects.
 * @throws {Error} If API requests fail or file/directory not found.
 */
async function listAzoCommitHistory(organization, project, repoName, repoDirName) {
  // First, verify that the file or directory exists by querying the items API.
  const contentsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(repoDirName)}&api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    const contentsResponse = await superagent
      .get(contentsUrl)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (contentsResponse.status === 200 && (!contentsResponse.body || contentsResponse.body.count === 0)) {
      throw new Error(`The path "${repoDirName}" in "${organization}/${project}/${repoName}" does not exist.`);
    }
  } catch (contentsError) {
    logger.error('Error fetching path contents (exception - Azure DevOps):', organization, project, repoName, repoDirName, contentsError);
    // Re-throw if it's a 404 or other network issue
    if (contentsError.response && contentsError.response.status === 404) {
      throw new Error(`The path "${repoDirName}" in "${organization}/${project}/${repoName}" does not exist.`);
    }
    throw contentsError; // Re-throw other errors
  }

  const commitsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/commits?searchCriteria.itemPath=${encodeURIComponent(repoDirName)}&api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    const commitResponse = await superagent
      .get(commitsUrl)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (commitResponse.status === 200) {
      return commitResponse.body.value.map((commit) => ({
        sha: commit.commitId,
        message: commit.comment,
        author: commit.author.name,
        date: commit.author.date,
      }));
    }
    await handleAzureDevopsApiError(commitResponse, `listing commit history for "${repoDirName}" in "${organization}/${project}/${repoName}"`);
    return []; // Unreachable, but for consistent-return
  } catch (error) {
    logger.error('Error listing commit history (exception - Azure DevOps):', organization, project, repoName, repoDirName, error);
    handleNotFoundError(error, ` for path "${repoDirName}" in "${organization}/${project}/${repoName}"`);
    throw error; // Unreachable, but for consistent-return
  }
}

/**
 * Lists the contents of a directory (or root if no path) in an Azure DevOps Git repo.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} [branchName=''] Optional branch name. If not specified, the default branch will be used.
 * @param {string} [repoDirName=''] Optional path to the directory within the repo.
 * @param {boolean} [recursive=true] Optional recursive scan. Defaults to true.
 *
 * @returns {Promise<Array<{ name: string, type: string, path: string }>>}
 * A promise that resolves to an array of directory content objects. Returns an
 * empty array if the directory is empty.
 * @throws {Error} If API request fails (e.g., repo/path not found, authentication, rate limit).
 */
async function listAzoDirectoryContents(
  organization,
  project,
  repoName,
  branchName = '',
  repoDirName = '',
  recursive = true,
) {
  let effectiveBranchName = branchName;

  if (!effectiveBranchName) {
    try {
      effectiveBranchName = await getAzoDefaultBranch(organization, project, repoName);
      logger.info(`No branch specified, using default branch: "${effectiveBranchName}" for ${organization}/${project}/${repoName}`);
    } catch (error) {
      logger.error(`Failed to get default branch for ${organization}/${project}/${repoName}: ${error.message}`);
      throw new Error(`Failed to get default branch for repository "${organization}/${project}/${repoName}". Please specify a branch or ensure the repository exists.`);
    }
  }

  const cleanRepoDirName = repoDirName.replace(/^\/+|\/+$/g, '');
  const recursionLevel = recursive ? 'Full' : 'OneLevel';
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(cleanRepoDirName)}&versionDescriptor.version=${encodeURIComponent(effectiveBranchName)}&recursionLevel=${recursionLevel}&api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    logger.debug(`Listing contents from Azure DevOps API URL: ${url}`);

    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (!response.body || !Array.isArray(response.body.value)) {
      if (response.body && response.body.gitItemType === 'File') {
        logger.warn(`Expected directory contents for "${repoDirName}" on branch "${effectiveBranchName}", but received a single file: "${response.body.path}"`);
        return [];
      }
      logger.warn(`Expected array of contents for "${repoDirName}" on branch `
        + `"${effectiveBranchName}", but received unexpected type: ${response.body ? response.body.gitItemType : typeof response.body}`);
      throw new Error(`Unexpected response type for "${repoDirName}" on branch "${effectiveBranchName}".`);
    }

    const contents = response.body.value;
    const results = [];

    if (contents.length === 0) {
      logger.debug(`Directory "${repoDirName}" on branch "${effectiveBranchName}" is empty.`);
      return [];
    }

    // Refactor to use Array.prototype.map for processing items
    contents.forEach((item) => {
      // Azure DevOps item.path is the full path from repo root
      if (item.gitItemType === 'File') {
        results.push({
          name: path.basename(item.path),
          type: 'file',
          path: item.path,
        });
      } else if (item.gitItemType === 'Folder') {
        results.push({
          name: path.basename(item.path),
          type: 'dir',
          path: item.path,
        });
      } else {
        results.push({
          name: path.basename(item.path),
          type: item.gitItemType,
          path: item.path,
        });
      }
    });
    return results;
  } catch (error) {
    const status = (error.response && error.response.status) || 'N/A';
    const errorMessage = (error.response && error.response.body && (error.response.body.message || error.response.body.value)) || error.message || error;
    logger.error(
      `Error listing directory contents for "${organization}/${project}/${repoName}/${repoDirName}" on branch "${effectiveBranchName}" [Status: ${status}]: ${errorMessage}`,
      error,
    );

    if (error.response) {
      if (error.response.status === 404) {
        handleNotFoundError(
          error.response,
          ` for path "${repoDirName}" on branch "${effectiveBranchName}" in "${organization}/${project}/${repoName}"`,
        );
      } else {
        handleAzureDevopsApiError(
          error.response,
          ` listing contents for "${organization}/${project}/${repoName}/${repoDirName}" on branch "${effectiveBranchName}"`,
        );
      }
    }
    throw error; // Ensure an error is always thrown on failure paths
  }
}

/**
 * Creates a pull request on a given Azure DevOps Git repository.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} title The title of the pull request.
 * @param {string} sourceBranch The branch to merge from (e.g., 'feature-branch').
 * @param {string} targetBranch The branch to merge into (e.g., 'main').
 * @param {string} [body=''] Optional description of the pull request.
 * @returns {Promise<object>} Azure DevOps API response for the created PR.
 * @throws {Error} If API request fails, repo/branches not found, or validation errors.
 */
async function createAzoPullRequest(
  organization,
  project,
  repoName,
  title,
  sourceBranch,
  targetBranch,
  body = '',
) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/pullrequests?api-version=${AZURE_DEVOPS_API_VERSION}`;
  const postData = {
    title,
    description: body,
    sourceRefName: `refs/heads/${sourceBranch}`, // Azure DevOps requires full ref name
    targetRefName: `refs/heads/${targetBranch}`, // Azure DevOps requires full ref name
  };

  try {
    const response = await superagent
      .post(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send(postData);

    if ([200, 201].includes(response.status)) {
      return response.body;
    }
    await handleAzureDevopsApiError(response, `creating pull request for ${organization}/${project}/${repoName}`);
    return {}; // Unreachable, but for consistent-return
  } catch (error) {
    logger.error(`Error creating pull request (exception - Azure DevOps):, ${error.message}`);
    if (error.response) {
      logger.error(`Error creating pull request (exception - Azure DevOps): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Check organization, project, repo and branch names.');
      }
      throw new Error(error.response.body.message || 'Failed to create PR');
    }
    throw error;
  }
}

/**
 * Lists running or queued Azure DevOps Pipelines builds and their jobs.
 * This is a significant re-write from GitHub Actions.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} [statusFilter='inProgress'] Status to filter builds (e.g., 'inProgress', 'queued', 'completed').
 * @returns {Promise<Array<{ buildId: number, buildNumber: string, definitionName: string,
 * jobName: string, status: string, url: string, startTime: string }>>}
 * Array of running/queued Azure DevOps Pipeline job details.
 * @throws {Error} If API request fails or repository/project/organization not found.
 */
async function listAzoPipelines(organization, project, repoName, statusFilter = 'inProgress') {
  // First, get the repository ID from its name
  const repoId = repoName; // Placeholder, assuming repoName works, but ID is preferred

  const urlRuns = `https://dev.azure.com/${organization}/${project}/_apis/build/builds?repositoryId=${repoId}&repositoryType=TfsGit&statusFilter=${statusFilter}&api-version=${AZURE_DEVOPS_API_VERSION}`;
  try {
    const runsResponse = await superagent
      .get(urlRuns)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    const builds = runsResponse.body.value;

    if (!builds || builds.length === 0) {
      return [];
    }

    // Refactor to use Promise.all for concurrent timeline fetching
    const pipelineJobsPromises = builds.map(async (build) => {
      const urlTimeline = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${build.id}/timeline?api-version=${AZURE_DEVOPS_API_VERSION}`;
      const timelineResponse = await superagent
        .get(urlTimeline)
        .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
        .set('User-Agent', USER_AGENT);

      const timeline = timelineResponse.body.records;
      const jobsForBuild = [];

      if (timeline) {
        timeline.forEach((record) => {
          if (record.type === 'Job' && (record.state === 'inProgress' || record.state === 'queued' || record.state === 'pending')) {
            jobsForBuild.push({
              buildId: build.id,
              buildNumber: build.buildNumber,
              definitionName: build.definition ? build.definition.name : 'N/A',
              jobName: record.name,
              status: record.state,
              url: record.url, // URL specific to this timeline record
              startTime: record.startTime,
            });
          }
        });
      }
      return jobsForBuild;
    });

    const allPipelineJobsArrays = await Promise.all(pipelineJobsPromises);
    // Flatten the array of arrays into a single array
    const allPipelineJobs = [].concat(...allPipelineJobsArrays);

    return allPipelineJobs;
  } catch (error) {
    logger.error(`Error listing Azure DevOps Pipelines (exception): ${organization} ${project} ${repoName} ${statusFilter} ${error}`);
    if (error.response) {
      logger.error(`Error listing pipelines (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Check organization, project, and repo names.');
      }
      throw new Error(error.response.body.message || 'Failed to list pipelines');
    }
    throw error;
  }
}

const DEFAULT_DESCRIPTION = 'Repository created by AIBot';

/**
 * Creates an Azure DevOps Git repository.
 *
 * @async
 * @param {string} organization - The Azure DevOps organization name.
 * @param {string} project - The Azure DevOps project name.
 * @param {string} repoName - The name of the repository to be created.
 * @param {string} [description=DEFAULT_DESCRIPTION] - A brief description
 * of the repository. Defaults to 'Repository created by AIBot'.
 * @returns {Promise<Object>} - A promise that resolves to an object indicating
 * the success or failure of the operation.
 * @throws {Error} - Throws an error if the API request fails.
 */
async function createAzoRepo(organization, project, repoName, description = DEFAULT_DESCRIPTION) {
  // To create a repo, we need the project ID. We can get it by querying projects.
  // Or, if the project parameter is the project name, we can use that in the URL.
  // Assuming 'project' is the project name for simplicity in URL.
  const url = `https://dev.azure.com/${organization}/_apis/git/repositories?api-version=${AZURE_DEVOPS_API_VERSION}`;

  if (!repoName || typeof repoName !== 'string' || repoName.length < 1) {
    throw new Error('Invalid repository name: must be a non-empty string.');
  }

  if (description && typeof description !== 'string') {
    throw new Error('Invalid description: must be a string');
  }

  try {
    const response = await superagent
      .post(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send({
        name: repoName,
        project: {
          name: project, // Use the project name
        },
        defaultBranch: 'refs/heads/main', // Initial default branch, will be created implicitly or explicitly later
        // isPublic property is often not directly supported at creation for Azure DevOps Git,
        // it's usually managed at the project level or security settings. Omitting for now.
        // description: description, // Description can be set, but often not directly in this creation body for git repos.
        // Can be updated via PATCH later.
      });

    if (response.status === 200 || response.status === 201) {
      return { success: true, message: `Repository '${repoName}' created in project '${project}'.` };
    }
    return { success: false, status: response.status, message: response.body.message || response.body.value };
  } catch (error) {
    const message = error.response && error.response.body && ((error.response.body.message || error.response.body.value))
      ? (error.response.body.message || error.response.body.value)
      : error.message || 'Repository creation failed';

    logger.error(`Error creating repo (exception - Azure DevOps): ${organization}/${project}, ${repoName} - ${message}`);
    throw new Error(`Failed to create repository: ${message}`);
  }
}

/**
 * Checks if an Azure DevOps Git repository exists.
 *
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository to check.
 * @returns {Promise<{ exists: boolean, status: number, id: string }>}
 * A promise that resolves to an object indicating the existence of the repository and its ID.
 * @throws {Error} Throws an error if the API request fails for reasons other than 404.
 */
async function checkAzoRepoExists(organization, project, repoName) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}?api-version=${AZURE_DEVOPS_API_VERSION}`;

  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');

  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    return { exists: true, status: response.status, id: response.body.id };
  } catch (error) {
    if (error.status === 404) {
      return { exists: false, status: 404 };
    }
    logger.error('Error checking repository existence (exception - Azure DevOps):', organization, project, repoName, error);
    throw new Error(`Failed to check repository existence: ${error.message}`);
  }
}

/**
 * Checks if an Azure DevOps Git branch exists in a specified repository.
 *
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository to check.
 * @param {string} branchName The name of the branch to check.
 * @returns {Promise<{ exists: boolean, status: number, ref: string }>}
 * A promise that resolves to an object indicating the existence of the branch and its full ref name.
 * @throws {Error} Throws an error if the API request fails for reasons other than 404.
 */
async function checkAzoBranchExists(organization, project, repoName, branchName) {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${branchName}&api-version=${AZURE_DEVOPS_API_VERSION}`;

  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');
  if (!branchName || typeof branchName !== 'string') throw new Error('Invalid branch name');

  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (response.status === 200 && response.body.value && response.body.value.length > 0) {
      return { exists: true, status: response.status, ref: response.body.value[0].name };
    }
    return { exists: false, status: 404 };
  } catch (error) {
    if (error.status === 404) {
      return { exists: false, status: 404 };
    }
    logger.error('Error checking branch existence (exception - Azure DevOps):', organization, project, repoName, branchName, error);
    throw new Error(`Failed to check branch existence: ${error.message}`);
  }
}

/**
 * Switches the default branch of an Azure DevOps Git repository.
 *
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} branchName The name of the branch to set as the new default branch.
 * @returns {Promise<Object>} A promise that resolves to an object indicating success.
 * @throws {Error} Throws an error if the API request fails.
 */
const switchAzoBranch = async (organization, project, repoName, branchName) => {
  try {
    const response = await superagent
      .patch(`https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}?api-version=${AZURE_DEVOPS_API_VERSION}`)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send({
        defaultBranch: `refs/heads/${branchName}`, // Azure DevOps expects full ref name
      });

    if ([200].includes(response.status)) {
      return {
        success: true,
        message: `Default branch changed to "${branchName}" in repository "${organization}/${project}/${repoName}".`,
      };
    }
    return { success: false, status: response.status, message: response.body.message || response.body.value };
  } catch (error) {
    logger.error(`Error processing switch branch (exception - Azure DevOps): ${organization}/${project}/${repoName} - ${error.message}`);
    throw new Error(`Error processing switch branch: ${error.message}`);
  }
};

/**
 * Creates an Azure DevOps Git branch.
 *
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository where the branch will be created.
 * @param {string} branchName The name of the new branch to be created.
 * @param {string} baseBranch The name of the existing branch to base the new branch on (e.g., 'main').
 * @returns {Promise<Object>} A promise that resolves to an object indicating success or failure.
 * @throws {Error} Throws an error if the API request fails.
 */
async function createAzoBranch(organization, project, repoName, branchName, baseBranch = 'main') {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/refs?api-version=${AZURE_DEVOPS_API_VERSION}`;

  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');
  if (!branchName || typeof branchName !== 'string') throw new Error('Invalid branch name');
  if (!baseBranch || typeof baseBranch !== 'string') throw new Error('Invalid base branch name');

  try {
    const resp = await checkAzoBranchExists(organization, project, repoName, branchName);
    if (resp.exists) {
      return { success: true, message: 'Branch already exists' };
    }
  } catch (error) {
    logger.error(`Branch check error (Azure DevOps): ${error.message}`);
  }

  try {
    // Get the SHA of the base branch
    const baseBranchRefUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${baseBranch}&api-version=${AZURE_DEVOPS_API_VERSION}`;
    const baseBranchResponse = await superagent
      .get(baseBranchRefUrl)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (!baseBranchResponse.body.value || baseBranchResponse.body.value.length === 0) {
      throw new Error(`Base branch '${baseBranch}' not found in repository '${repoName}'.`);
    }

    const baseBranchSha = baseBranchResponse.body.value[0].objectId; // objectId is the commit SHA

    // Create the new branch reference
    const postData = [{
      name: `refs/heads/${branchName}`, // Full ref name
      oldObjectId: '0000000000000000000000000000000000000000', // Azure DevOps for creating new ref
      newObjectId: baseBranchSha,
    }];

    const response = await superagent
      .post(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send(postData);

    if (response.status === 200) { // Azure DevOps typically returns 200 for ref updates
      // Optionally try to switch default branch if desired (similar to GitHub version)
      const switchRes = await switchAzoBranch(organization, project, repoName, branchName);
      if (switchRes.success) {
        return { success: true, message: 'Branch created and context switched' };
      }
      return { success: true, message: 'Branch created, but could not switch context' };
    }
    return { success: false, status: response.status, message: response.body.message || response.body.value };
  } catch (error) {
    const message = (error.response && error.response.body && ((error.response.body.message || error.response.body.value))) || error.message || 'Creation failed';
    const status = (error.response && error.response.status) || 'Unknown status';
    logger.error(`Error creating branch (exception - Azure DevOps): ${message} [Status: ${status}]`, error);
    throw new Error(`Failed to create branch: ${message} [Status: ${status}]`);
  }
}

/**
 * Recursively walks a directory and returns a list of file paths relative to the start directory.
 * @async
 * @param {string} dir The directory to start walking from.
 * @param {string} [rootDir=dir] The original root directory for calculating relative paths.
 * @returns {Promise<string[]>} A promise that resolves to an array of relative file paths.
 */
const walkDir = async (dir, rootDir = dir) => {
  let files = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  const filePromises = entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        return await walkDir(fullPath, rootDir);
      } if (entry.isFile()) {
        const relativePath = path.relative(rootDir, fullPath);
        return [relativePath];
      }
      return [];
    } catch (err) {
      logger.error(`Error processing entry "${entry.name}" in directory "${dir}": ${err.message}`);
      return [];
    }
  });

  const nestedFiles = await Promise.all(filePromises);
  files = files.concat(...nestedFiles);
  return files;
};

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms); // Correctly resolves the promise after the delay
});

/**
 * Commits files to an Azure DevOps Git repository, including files in subdirectories.
 * This function handles file creation, updates, and deletion in a single commit operation
 * by creating a Git push.
 *
 * Files are read from a specified session's temporary directory.
 * If `repoDirName` is provided, only files located within the corresponding
 * subdirectory in the temporary workspace will be considered and committed
 * into that directory within the repository. Otherwise, all files in the
 * temporary directory are considered and committed to the root and its subdirectories.
 *
 * @async
 * @function commitAzoFiles
 * @param {string} sessionId - The unique identifier for the session.
 * @param {string} organization - The Azure DevOps organization name.
 * @param {string} project - The Azure DevOps project name.
 * @param {string} repoName - The name of the repository.
 * @param {string} [repoDirName=null] - The name of the directory in the repository
 * where files will be committed.
 * @param {string} [branchName=''] - The branch to commit to.
 * @param {number} [maxRetries=3] - Maximum number of retries for API requests.
 * @returns {Promise<Object>} - A promise that resolves to an object indicating
 * the success or failure of the operation, with results for each file processed.
 * @throws {Error} - Throws an error if initial validation or directory reading fails.
 */
async function commitAzoFiles(sessionId, organization, project, repoName, repoDirNameParam = null, branchName = '', maxRetries = 3) {
  logger.debug(`commitAzoFiles called with: sessionId=${sessionId}, org=${organization}, project=${project}, repoName=${repoName}, repoDirName=${repoDirNameParam}, branchName=${branchName}`);

  if (!sessionId || typeof sessionId !== 'string') throw new Error('Invalid session ID');
  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');
  if (repoDirNameParam !== undefined && repoDirNameParam !== null && typeof repoDirNameParam !== 'string') throw new Error('Invalid repoDirName type');

  // Use a local variable instead of reassigning the parameter
  const cleanRepoDirName = (repoDirNameParam === '' || repoDirNameParam === null)
    ? null
    : repoDirNameParam.replace(/^\/|\/$/g, '');

  let effectiveBranchName = branchName;
  if (!effectiveBranchName) {
    try {
      effectiveBranchName = await getAzoDefaultBranch(organization, project, repoName);
      logger.info(`No branch specified, using default branch: "${effectiveBranchName}" for ${organization}/${project}/${repoName}`);
    } catch (error) {
      logger.error(`Failed to get default branch for ${organization}/${project}/${repoName}: ${error.message}`);
      throw new Error(`Failed to get default branch for repository "${organization}/${project}/${repoName}". Please specify a branch or ensure the repository exists.`);
    }
  }

  const currentDirectoryPath = await getOrCreateSessionTempDir(sessionId);

  if (!currentDirectoryPath) {
    throw new Error(`Temporary directory not found for session: ${sessionId}. Please ensure files were downloaded or a session directory was created first.`);
  }

  try {
    const filesToProcess = await walkDir(currentDirectoryPath);
    const changes = []; // Array to hold Azure DevOps Git Change objects
    const results = []; // This will now hold results from individual file processing

    if (filesToProcess.length === 0) {
      logger.info('No files found in the session temporary directory to upload.');
      return { success: true, message: 'No files found in the session temporary directory to upload', status: 200 };
    }

    // Get the latest commit and tree for the target branch
    const refUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${effectiveBranchName}&api-version=${AZURE_DEVOPS_API_VERSION}`;
    const refResponse = await superagent
      .get(refUrl)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    if (!refResponse.body.value || refResponse.body.value.length === 0) {
      throw new Error(`Branch '${effectiveBranchName}' not found in repository '${repoName}'. Cannot commit files.`);
    }
    const latestCommitId = refResponse.body.value[0].objectId;

    const fileProcessingPromises = filesToProcess.map(async (relativeFilePath) => {
      const fullLocalFilePath = path.join(currentDirectoryPath, relativeFilePath);
      let azoDestPath;
      const fileResult = {
        file: relativeFilePath, success: false, message: 'Processing...', azoPath: null,
      };

      let shouldProcessFile = true;
      const cleanRepoDirNameNormalized = cleanRepoDirName ? cleanRepoDirName.replace(/\\/g, '/') : null;
      const relativeFilePathNormalized = relativeFilePath.replace(/\\/g, '/');

      if (cleanRepoDirNameNormalized) {
        if (relativeFilePathNormalized.startsWith(`${cleanRepoDirNameNormalized}/`) || (relativeFilePathNormalized === cleanRepoDirNameNormalized)) {
          const repoDirInTemp = path.join(currentDirectoryPath, cleanRepoDirName);
          const pathRelativeToRepoDirInTemp = path.relative(repoDirInTemp, fullLocalFilePath);
          azoDestPath = path.join(cleanRepoDirName, pathRelativeToRepoDirInTemp);
        } else {
          shouldProcessFile = false;
          logger.debug(`Skipping file "${relativeFilePath}" as it is outside the specified repoDirName "${cleanRepoDirName}" scope.`);
        }
      } else {
        azoDestPath = relativeFilePath;
      }

      if (!shouldProcessFile) {
        fileResult.success = true;
        fileResult.message = `Skipped: Outside repoDirName "${cleanRepoDirName}" scope.`;
        return fileResult;
      }

      azoDestPath = azoDestPath.replace(/\\/g, '/');
      if (azoDestPath.startsWith('/')) azoDestPath = azoDestPath.substring(1);

      if (azoDestPath === '.' || azoDestPath === '' || azoDestPath === '/') {
        logger.debug(`Skipping commit for path "${relativeFilePath}" which resolves to repo root or empty path.`);
        fileResult.success = true;
        fileResult.message = 'Skipped commit for root or empty path.';
        fileResult.azoPath = azoDestPath;
        return fileResult;
      }

      logger.debug(`Processing file: ${relativeFilePath}`);
      logger.debug(`  Full local path: ${fullLocalFilePath}`);
      logger.debug(`  Azure DevOps destination path: ${azoDestPath}`);

      try {
        const localContent = await fs.promises.readFile(fullLocalFilePath);
        const localBase64Content = localContent.toString('base64');
        let currentItem = null;

        const getItemUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(azoDestPath)}&versionDescriptor.version=${encodeURIComponent(effectiveBranchName)}&includeContent=true&api-version=${AZURE_DEVOPS_API_VERSION}`;
        try {
          const getItemResponse = await superagent
            .get(getItemUrl)
            .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
            .set('User-Agent', USER_AGENT);

          if (getItemResponse.status === 200) {
            currentItem = getItemResponse.body;
            if (currentItem.content === localBase64Content) {
              logger.info(`Content of file "${azoDestPath}" is identical to repo version on branch "${effectiveBranchName}". Skipping commit.`);
              fileResult.success = true;
              fileResult.message = 'Content identical, skipped commit.';
              fileResult.azoPath = azoDestPath;
              return fileResult;
            }
          }
        } catch (getItemError) {
          if (getItemError.status !== 404) {
            logger.warn(`Error checking existing file "${azoDestPath}": ${getItemError.message}`);
          }
        }
        // Push the change to the changes array (declared outside the map function)
        changes.push({
          changeType: currentItem ? 2 : 1,
          item: {
            path: azoDestPath,
          },
          newContent: {
            content: localContent.toString('utf8'),
            contentType: 0,
          },
        });

        fileResult.success = true;
        fileResult.message = currentItem ? 'Scheduled for update' : 'Scheduled for addition';
        fileResult.azoPath = azoDestPath;
        return fileResult;
      } catch (fileReadError) {
        logger.error(`Error reading local file ${fullLocalFilePath}: ${fileReadError.message}`);
        fileResult.success = false;
        fileResult.message = `Failed to read local file: ${fileReadError.message}`;
        fileResult.azoPath = azoDestPath;
        return fileResult;
      }
    });

    // Wait for all file processing promises to resolve
    const individualFileResults = await Promise.all(fileProcessingPromises);
    results.push(...individualFileResults); // Accumulate all results

    if (changes.length === 0) {
      return {
        success: true, message: 'No new or changed files to commit.', status: 200, results,
      };
    }

    // Now, create the Git Push
    const pushUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoName}/pushes?api-version=${AZURE_DEVOPS_API_VERSION}`;
    const commitMessage = `Automated commit from AIBot - ${changes.length} file(s) changed`;

    const pushBody = {
      refUpdates: [
        {
          name: `refs/heads/${effectiveBranchName}`,
          oldObjectId: latestCommitId,
        },
      ],
      commits: [
        {
          comment: commitMessage,
          changes,
        },
      ],
    };

    let pushSuccess = false;
    let currentPushRetry = 0;
    let lastPushError = null;

    // eslint-disable-next-line no-await-in-loop
    while (currentPushRetry <= maxRetries && !pushSuccess) {
      try {
        if (currentPushRetry > 0) {
          logger.info(`Retrying push for ${organization}/${project}/${repoName} on branch ${effectiveBranchName} (Attempt ${currentPushRetry}/${maxRetries})`);
          // eslint-disable-next-line no-await-in-loop
          await delay(1000 * currentPushRetry);
        }

        // eslint-disable-next-line no-await-in-loop
        const pushResponse = await superagent
          .post(pushUrl)
          .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
          .set('User-Agent', USER_AGENT)
          .send(pushBody);

        if (pushResponse.status === 200 || pushResponse.status === 201) {
          logger.info(`Successfully pushed changes to ${organization}/${project}/${repoName} on branch ${effectiveBranchName}.`);
          pushSuccess = true;
        } else if (pushResponse.status === 409 || (pushResponse.status === 400 && pushResponse.body.message.includes('A push to the default branch is not allowed'))) {
          // Conflict or branch policy issue, need to re-fetch latest commit and retry
          logger.warn(`Conflict or policy error (409/400) when pushing: ${organization}/${project}/${repoName}. Re-fetching latest ref...`);
          lastPushError = new Error(`Push conflict or policy: ${pushResponse.body.message || 'Unknown conflict'}`);

          // eslint-disable-next-line no-await-in-loop
          const reFetchRefResponse = await superagent
            .get(refUrl)
            .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
            .set('User-Agent', USER_AGENT);

          if (reFetchRefResponse.status === 200 && reFetchRefResponse.body.value && reFetchRefResponse.body.value.length > 0) {
            pushBody.refUpdates[0].oldObjectId = reFetchRefResponse.body.value[0].objectId; // Update oldObjectId for retry
            logger.debug(`Re-fetched new oldObjectId: ${pushBody.refUpdates[0].oldObjectId}. Retrying push.`);
          } else {
            logger.error(`Failed to re-fetch ref after push conflict for ${organization}/${project}/${repoName}.`);
            lastPushError = new Error(`Failed to re-fetch ref after push conflict: ${reFetchRefResponse.body.message || 'Unknown re-fetch error'}`);
            break; // Exit retry loop
          }
        } else {
          lastPushError = new Error(pushResponse.body.message || pushResponse.body.value || 'Unknown error during push');
          break; // Exit retry loop for other errors
        }
      } catch (pushError) {
        const errorMessage = (pushError.response && pushError.response.body && ((pushError.response.body.message || pushError.response.body.value))) || pushError.message;
        const status = (pushError.response && pushError.response.status) || 'N/A';
        logger.error(`Exception during push for ${organization}/${project}/${repoName} [Status: ${status}]: ${errorMessage}`, pushError);
        lastPushError = new Error(`Push failed: ${errorMessage}`);
        // If it's a transient error that could be retried, don't break, let the loop continue
        if ((status === 429) || (status >= 500 && status < 600)) { // Rate limit or server error
          // continue loop
        } else {
          break; // For other client-side or persistent errors, break
        }
      }
      currentPushRetry += 1;
    }

    if (!pushSuccess) {
      throw new Error(`Failed to commit files after ${maxRetries} retries: ${lastPushError ? lastPushError.message : 'Unknown error'}`);
    }

    // eslint-disable-next-line no-param-reassign
    results.forEach((r) => {
      if (r.message.startsWith('Scheduled for')) {
        // eslint-disable-next-line no-param-reassign
        r.success = true;
        // eslint-disable-next-line no-param-reassign
        r.message = r.message.replace('Scheduled for', 'Successfully');
      }
    });

    return {
      success: true,
      results,
      message: 'All selected files processed and committed successfully.',
    };
  } catch (error) {
    logger.error(
      `Error processing directory or committing files (exception - Azure DevOps): ${organization}/${project}/${repoName} - `
      + `${error.message}`,
      error,
    );
    throw new Error(`Failed to process files for commit: ${error.message}`);
  }
}

module.exports = {
  checkAzoBranchExists,
  checkAzoRepoExists,
  commitAzoFiles,
  createAzoBranch,
  createAzoPullRequest,
  createAzoRepo,
  fetchAzoRepoContentsRecursive,
  listAzoBranches,
  listAzoCommitHistory,
  listAzoDirectoryContents,
  listAzoPipelines,
  listAzoRepos,
  switchAzoBranch,
};
