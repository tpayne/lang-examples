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
const ADO_BASEURI = 'https://dev.azure.com';

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
async function downloadAdoFile(sessionId, organization, project, repoName, filePath, branchName, localFilePath) {
  // We need to resolve repoName to repo ID first if not already done.
  // For simplicity here, assuming repoName can be used directly or ID is resolved elsewhere.
  // In a real scenario, you'd likely call checkAdoRepoExists or similar to get the ID.
  const repoId = repoName; // Placeholder: In practice, resolve to actual ID

  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoId}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${encodeURIComponent(branchName)}&api-version=${AZURE_DEVOPS_API_VERSION}&download=true`;

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
 * Exception thrown when a folder is detected at a specified path during a fetch operation.
 *
 * @class FolderFetchError
 * @extends Error
 * @param {string} path - The path where the folder was detected.
 * @property {string} name - The name of the error ('FolderFetchError').
 * @property {string} path - The path where the folder was detected.
 */
class FolderFetchError extends Error {
  constructor(folderPath) {
    super(`Detected folder at path "${folderPath}"`);
    this.name = 'FolderFetchError';
    this.folderPath = folderPath;
  }
}

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

async function fetchAdoRepoContentsRecursive(
  sessionId,
  organization,
  project,
  repoName,
  repoDirName,
  branchName,
  localDestPath = null,
  skipBinaryFiles = true,
) {
  const baseLocalDestPath = localDestPath || await getOrCreateSessionTempDir(sessionId);

  const handleSingleFile = async (filePath) => {
    const destFile = path.join(baseLocalDestPath, filePath);
    const parentDir = path.dirname(destFile);
    if (
      parentDir !== baseLocalDestPath
      && parentDir !== os.tmpdir()
      && parentDir.startsWith(baseLocalDestPath)
    ) {
      await mkdir(parentDir, { recursive: true });
    }
    await downloadAdoFile(
      sessionId,
      organization,
      project,
      repoName,
      filePath,
      branchName,
      destFile,
    );
    return { success: true, message: `Downloaded file at "${filePath}"` };
  };

  // Probe single item (no recursion)
  const probeUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/items`
    + `?path=${encodeURIComponent(repoDirName)}`
    + `&versionDescriptor.version=${encodeURIComponent(branchName)}`
    + '&recursionLevel=None'
    + `&api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    logger.debug(`Single-item probe: ${probeUrl} [Session: ${sessionId}]`);
    const probeReq = superagent.get(probeUrl).set('User-Agent', USER_AGENT);
    if (AZURE_DEVOPS_PAT) probeReq.set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);
    const probeRes = await probeReq;

    const single = probeRes.body.value;
    if (!Array.isArray(single)) {
      if (single.isFolder) {
        throw new FolderFetchError(repoDirName);
      }
      const ext = path.extname(single.path).toLowerCase();
      if (skipBinaryFiles && BINARY_EXTENSIONS.has(ext)) {
        logger.info(`Skipping binary file: "${single.path}" [Session: ${sessionId}]`);
        return { success: true, message: `Skipped binary file at "${single.path}"` };
      }
      return handleSingleFile(single.path);
    }
  } catch (err) {
    const isFolderProbe = err instanceof FolderFetchError
      || (err.response && err.response.status === 400 && err.response.text.includes('recursionLevel'));

    if (!isFolderProbe && (!err.response || err.response.status !== 404)) {
      logger.error(`Error in single-item probe: ${err.message}`, err);
      throw err;
    }
    if (err.response && err.response.status === 404) {
      throw new Error('Not Found: verify organization, project, repo and path names.');
    }
    // Fall through to directory fetch
  }

  // Directory fetch with scopePath & recursionLevel=Full
  const dirUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/items`
    + `?scopePath=${encodeURIComponent(repoDirName)}`
    + `&versionDescriptor.version=${encodeURIComponent(branchName)}`
    + '&recursionLevel=Full'
    + `&api-version=${AZURE_DEVOPS_API_VERSION}`;

  logger.debug(`Directory fetch: ${dirUrl} [Session: ${sessionId}]`);
  const dirReq = superagent.get(dirUrl).set('User-Agent', USER_AGENT);
  if (AZURE_DEVOPS_PAT) dirReq.set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);
  const dirRes = await dirReq;

  if (dirRes.status !== 200) {
    throw new Error(`Failed directory fetch. Status ${dirRes.status}: ${dirRes.text}`);
  }

  const items = dirRes.body.value;
  const downloadResults = await Promise.all(items.map(async (item) => {
    if (item.isFolder) {
      logger.debug(`Skipped folder placeholder: "${item.path}"`);
      return { success: true, message: `Folder: "${item.path}"` };
    }
    const ext = path.extname(item.path).toLowerCase();
    if (skipBinaryFiles && BINARY_EXTENSIONS.has(ext)) {
      logger.info(`Skipping binary file: "${item.path}" [Session: ${sessionId}]`);
      return null;
    }
    return handleSingleFile(item.path);
  }));

  return {
    success: true,
    message: `Processed directory "${repoDirName}"`,
    downloadResults: downloadResults.filter((r) => r),
  };
}

/**
 * Lists the names of repositories for a given Azure DevOps organization and project.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @returns {Promise<string[]>} Array of repository names.
 * @throws {Error} If API request fails or project is not found.
 */
async function listAdoRepos(organization, project) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories?api-version=${AZURE_DEVOPS_API_VERSION}`;
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
async function getAdoDefaultBranch(organization, project, repoName) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}?api-version=${AZURE_DEVOPS_API_VERSION}`;
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
async function listAdoBranches(organization, project, repoName) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/&api-version=${AZURE_DEVOPS_API_VERSION}`;
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
async function listAdoCommitHistory(organization, project, repoName, repoDirName) {
  // First, verify that the file or directory exists by querying the items API.
  const contentsUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(repoDirName)}&api-version=${AZURE_DEVOPS_API_VERSION}`;

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

  const commitsUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/commits?searchCriteria.itemPath=${encodeURIComponent(repoDirName)}&api-version=${AZURE_DEVOPS_API_VERSION}`;

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
async function listAdoDirectoryContents(
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
      effectiveBranchName = await getAdoDefaultBranch(organization, project, repoName);
      logger.info(`No branch specified, using default branch: "${effectiveBranchName}" for ${organization}/${project}/${repoName}`);
    } catch (error) {
      logger.error(`Failed to get default branch for ${organization}/${project}/${repoName}: ${error.message}`);
      throw new Error(`Failed to get default branch for repository "${organization}/${project}/${repoName}". Please specify a branch or ensure the repository exists.`);
    }
  }

  const cleanRepoDirName = repoDirName.replace(/^\/+|\/+$/g, '');
  const recursionLevel = recursive ? 'Full' : 'OneLevel';
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(cleanRepoDirName)}&versionDescriptor.version=${encodeURIComponent(effectiveBranchName)}&recursionLevel=${recursionLevel}&api-version=${AZURE_DEVOPS_API_VERSION}`;

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
async function createAdoPullRequest(
  organization,
  project,
  repoName,
  title,
  sourceBranch,
  targetBranch,
  body = '',
) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/pullrequests?api-version=${AZURE_DEVOPS_API_VERSION}`;
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
async function listAdoPipelines(organization, project, repoName, statusFilter = 'inProgress') {
  // First, get the repository ID from its name
  const repoId = repoName; // Placeholder, assuming repoName works, but ID is preferred

  const urlRuns = `${ADO_BASEURI}/${organization}/${project}/_apis/build/builds?repositoryId=${repoId}&repositoryType=TfsGit&statusFilter=${statusFilter}&api-version=${AZURE_DEVOPS_API_VERSION}`;
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
      const urlTimeline = `${ADO_BASEURI}/${organization}/${project}/_apis/build/builds/${build.id}/timeline?api-version=${AZURE_DEVOPS_API_VERSION}`;
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

/**
 * Fetches the Git repository object so we can grab its GUID.
 */
async function getRepoByName(org, project, repoName) {
  const url = `${ADO_BASEURI}/${org}/${project}/_apis/git/repositories/${encodeURIComponent(repoName)}?api-version=${AZURE_DEVOPS_API_VERSION}`;

  const res = await superagent
    .get(url)
    .set('User-Agent', USER_AGENT)
    .set('Accept', `application/json;api-version=${AZURE_DEVOPS_API_VERSION}`)
    .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);

  if (res.status !== 200) {
    throw new Error(`Unable to fetch repo '${repoName}' (${res.status}): ${res.text}`);
  }
  return res.body;
}

/**
 * Creates an initial commit record for the repo.
 *
 * @async
 * @param {string} organization - The Azure DevOps organization name.
 * @param {string} project - The Azure DevOps project name.
 * @param {string} repoName - The name of the repository to be created.
 * @returns {Promise<Object>} - A promise that resolves to an object indicating
 * the success or failure of the operation.
 * @throws {Error} - Throws an error if the API request fails.
 */
async function bootstrapMainBranch(organization, project, repoName) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/pushes?api-version=7.0`;
  const repo = await getRepoByName(organization, project, repoName);

  const body = {
    repository: { id: repo.id, name: repo.name },
    refUpdates: [{
      name: 'refs/heads/main',
      oldObjectId: '0000000000000000000000000000000000000000',
    }],
    commits: [{
      comment: 'Initial commit',
      changes: [{
        changeType: 'add',
        item: { path: '/README.md' },
        newContent: {
          content: '# Welcome',
          contentType: 'rawtext',
        },
      }],
    }],
  };

  try {
    const resp = await superagent
      .post(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send(body);

    return resp.body;
  } catch (error) {
    logger.error(`Error bootstrapping main branch: ${error.message}`);
    throw new Error(`Failed to bootstrap main branch: ${error.message}`);
  }
}

/**
 * Creates an Azure DevOps Git repository.
 *
 * @async
 * @param {string} organization - The Azure DevOps organization name.
 * @param {string} project - The Azure DevOps project name.
 * @param {string} repoName - The name of the repository to be created.
 * @returns {Promise<Object>} - A promise that resolves to an object indicating
 * the success or failure of the operation.
 * @throws {Error} - Throws an error if the API request fails.
 */
async function createAdoRepo(org, project, repoName) {
  if (!repoName || typeof repoName !== 'string') {
    throw new Error('Invalid repository name');
  }

  try {
    // 1) Create repo
    const res = await superagent
      .post(`${ADO_BASEURI}/${org}/${project}/_apis/git/repositories?api-version=${AZURE_DEVOPS_API_VERSION}`)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .send({ name: repoName });

    if (![200, 201].includes(res.status)) {
      throw new Error(`Failed to create: ${res.body.message || res.body.value}`);
    }
  } catch (error) {
    const msg = (error.response && error.response.body && error.response.body.message)
          || (error.response && error.response.body && error.response.body.value)
          || error.message;
    logger.error(`Error creating repo: ${org}/${project}, ${repoName} – ${msg}`);
    throw new Error(`Failed to create repository: ${msg}`);
  }
  // 2) Bootstrap main branch
  try {
    await bootstrapMainBranch(org, project, repoName);
  } catch (error) {
    logger.error(`Error bootstrapping main branch for repo: ${org}/${project}/${repoName} – ${error.message}`);
    throw new Error(`Failed to bootstrap main branch: ${error.message}`);
  }
  return {
    success: true,
    message: `Created '${repoName}' in '${project}'}.`,
  };
}

/**
 * Checks if a branch exists in an Azure DevOps repository.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The Azure DevOps repository name.
 * @param {string} branchName The name of the branch to check.
 * @returns {Promise<AdoSuccessResponse>}
 */
async function checkAdoBranchExists(org, proj, repo, branch) {
  const url = `${ADO_BASEURI}/${org}/${proj}/_apis/git/repositories/${repo}/refs`
              + `?api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    const res = await superagent
      .get(url)
      .set('User-Agent', USER_AGENT)
      .set('Accept', `application/json;api-version=${AZURE_DEVOPS_API_VERSION}`)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);

    if (res.status !== 200) {
      throw new Error(`Unexpected status ${res.status}`);
    }

    const fullRefName = `refs/heads/${branch}`;
    const match = res.body.value.find((r) => r.name === fullRefName);

    const exists = Boolean(match);

    return exists
      ? { success: true, branch: match }
      : { success: false, message: `Branch '${branch}' not found.` };
  } catch (err) {
    logger.error(`[checkAdoBranchExists] Error: ${err.message}`, err);
    throw new Error(`Failed to check branch existence: ${err.message}`);
  }
}

/**
 * Checks if an Azure DevOps repository exists.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The Azure DevOps repository name.
 * @returns {Promise<AdoSuccessResponse>}
 */
async function checkAdoRepoExists(organization, project, repoName) {
  const apiUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}?api-version=${AZURE_DEVOPS_API_VERSION}`;

  try {
    const request = superagent.get(apiUrl);
    request.set('User-Agent', USER_AGENT);
    if (AZURE_DEVOPS_PAT) {
      request.set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`);
    }

    const response = await request;

    if (response.status === 200) {
      return { success: true };
    }
    handleNotFoundError(response, `repository ${organization}/${project}/${repoName}`);
    return { success: false, message: `Repository '${repoName}' does not exist or is inaccessible.` };
  } catch (error) {
    const errorMessage = error.message || error;
    logger.error(`Error checking ADO repo existence: ${errorMessage}`, error);
    throw new Error(`Failed to check repository existence: ${errorMessage}`);
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
const switchAdoBranch = async (organization, project, repoName, branchName) => {
  const { success, branch } = await checkAdoBranchExists(organization, project, repoName, branchName);
  if (!success || !branch) {
    logger.warn(`[switchAdoBranch] Branch '${branchName}' does not exist in '${repoName}'.`);
    return {
      success: false,
      message: `Branch '${branchName}' not found in '${repoName}'.`,
    };
  }

  const repo = await getRepoByName(organization, project, repoName);

  const patchUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repo.id}?api-version=${AZURE_DEVOPS_API_VERSION}`;
  const payload = { defaultBranch: `refs/heads/${branchName}` };

  const res = await superagent
    .patch(patchUrl)
    .set('User-Agent', USER_AGENT)
    .set('Accept', `application/json;api-version=${AZURE_DEVOPS_API_VERSION}`)
    .set('Content-Type', 'application/json')
    .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
    .send(payload);

  if (res.status === 200) {
    return {
      success: true,
      message: `Default branch set to '${branchName}' in '${repoName}'.`,
    };
  }

  // Any other status is a failure
  return {
    success: false,
    status: res.status,
    message: (res.body && res.body.message) || res.text,
  };
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
async function createAdoBranch(organization, project, repoName, branchName, baseBranch = 'main') {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/refs?api-version=${AZURE_DEVOPS_API_VERSION}`;

  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');
  if (!branchName || typeof branchName !== 'string') throw new Error('Invalid branch name');
  const base = baseBranch.trim() || 'main';

  try {
    const resp = await checkAdoBranchExists(organization, project, repoName, branchName);
    if (resp.exists) {
      return { success: true, message: 'Branch already exists' };
    }
  } catch (error) {
    logger.error(`Branch check error (Azure DevOps): ${error.message}`);
  }

  try {
    // Get the SHA of the base branch
    const baseBranchRefUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${base}&api-version=${AZURE_DEVOPS_API_VERSION}`;
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
      const switchRes = await switchAdoBranch(organization, project, repoName, branchName);
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
 * @function commitAdoFiles
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
async function commitAdoFiles(
  sessionId,
  organization,
  project,
  repoName,
  repoDirNameParam = null,
  branchName = '',
  maxRetries = 3,
) {
  logger.debug(
    `commitAdoFiles called with: sessionId=${sessionId}, org=${organization}, project=${project}, repoName=${repoName}, repoDirName=${repoDirNameParam}, branchName=${branchName}`,
  );

  // --- Validate inputs ---
  if (!sessionId || typeof sessionId !== 'string') throw new Error('Invalid session ID');
  if (!organization || typeof organization !== 'string') throw new Error('Invalid organization name');
  if (!project || typeof project !== 'string') throw new Error('Invalid project name');
  if (!repoName || typeof repoName !== 'string') throw new Error('Invalid repository name');
  if (
    repoDirNameParam !== undefined
    && repoDirNameParam !== null
    && typeof repoDirNameParam !== 'string'
  ) throw new Error('Invalid repoDirName type');

  const repo = await getRepoByName(organization, project, repoName);
  if (!repo || !repo.id) {
    throw new Error(`Repository "${repoName}" not found in project "${project}" of organization "${organization}".`);
  }

  // Clean up the repo‐dir parameter
  let cleanRepoDirName = repoDirNameParam;
  if (cleanRepoDirName === undefined || cleanRepoDirName === null || cleanRepoDirName === '' || cleanRepoDirName === '/') {
    cleanRepoDirName = null;
  } else {
    cleanRepoDirName = repoDirNameParam.replace(/^\/+|\/+$/g, '');
  }

  // --- Determine branch ---
  let effectiveBranchName = branchName;
  if (!effectiveBranchName) {
    try {
      effectiveBranchName = await getAdoDefaultBranch(
        organization,
        project,
        repoName,
      );
      logger.info(
        `No branch specified, using default branch: "${effectiveBranchName}"`,
      );
    } catch (err) {
      logger.error(
        `Failed to get default branch for ${organization}/${project}/${repoName}: ${err.message}`,
      );
      throw new Error(
        `Failed to get default branch for repository "${organization}/${project}/${repoName}". Please specify a branch or ensure the repository exists.`,
      );
    }
  }

  // --- Prepare temp directory & file list ---
  const currentDirectoryPath = await getOrCreateSessionTempDir(sessionId);
  if (!currentDirectoryPath) {
    throw new Error(
      `Temporary directory not found for session: ${sessionId}.`,
    );
  }
  const filesToProcess = await walkDir(currentDirectoryPath);
  if (filesToProcess.length === 0) {
    logger.info(
      'No files found in the session temporary directory to upload.',
    );
    return {
      success: true,
      message:
        'No files found in the session temporary directory to upload',
      status: 200,
    };
  }

  // --- Get latest commit of target branch ---
  const refUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${effectiveBranchName}&api-version=${AZURE_DEVOPS_API_VERSION}`;
  const refResponse = await superagent
    .get(refUrl)
    .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
    .set('User-Agent', USER_AGENT);

  if (!refResponse.body.value || refResponse.body.value.length === 0) {
    throw new Error(
      `Branch '${effectiveBranchName}' not found in repository '${repoName}'.`,
    );
  }
  const latestCommitId = refResponse.body.value[0].objectId;

  const changes = [];
  const results = [];

  // --- Process each file ---
  const fileProcessingPromises = filesToProcess.map(
    async (relativeFilePath) => {
      const fullLocalFilePath = path.join(
        currentDirectoryPath,
        relativeFilePath,
      );
      let adoDestPath;
      const fileResult = {
        file: relativeFilePath,
        success: false,
        message: 'Processing...',
        adoPath: null,
      };

      // Determine if file sits under repoDirName
      let shouldProcessFile = true;
      const cleanRepoDirNormalized = cleanRepoDirName
        ? cleanRepoDirName.replace(/\\/g, '/')
        : null;

      // normalize forward‐slashes
      let relativeNormalized = relativeFilePath.replace(/\\/g, '/');

      // AUTO‐STRIP: drop leading "repoName/" if no explicit repoDirNameParam
      if (!cleanRepoDirName) {
        const parts = relativeNormalized.split('/');
        if (parts[0] === repoName) {
          parts.shift();
          relativeNormalized = parts.join('/');
          logger.debug(
            `Auto‐stripped leading '${repoName}/'; now '${relativeNormalized}'`,
          );
        }
      }
      if (cleanRepoDirNormalized) {
        if (
          relativeNormalized.startsWith(
            `${cleanRepoDirNormalized}/`,
          )
          || relativeNormalized === cleanRepoDirNormalized
        ) {
          const repoRootInTemp = path.join(
            currentDirectoryPath,
            cleanRepoDirName,
          );
          const relativeToRoot = path.relative(
            repoRootInTemp,
            fullLocalFilePath,
          );
          adoDestPath = path.join(
            cleanRepoDirName,
            relativeToRoot,
          );
        } else {
          shouldProcessFile = false;
          logger.debug(
            `Skipping "${relativeFilePath}" outside "${cleanRepoDirName}" scope.`,
          );
        }
      } else {
        adoDestPath = relativeNormalized;
      }
      let absoluteAdoPath = null;

      if (!shouldProcessFile) {
        fileResult.success = true;
        fileResult.message = `Skipped: outside repoDirName "${cleanRepoDirName}"`;
        // Normalize to forward‐slashes and strip any leading slashes,
        // then build absolute ADO path
        let normalized = adoDestPath.replace(/\\/g, '/').replace(/^\/+/, '');
        // If normalized is empty (e.g. repoDirName was "/" or ""), use the filename
        if (!normalized || normalized === '.' || normalized === '/') {
          normalized = path.basename(relativeFilePath);
        }
        absoluteAdoPath = `/${normalized}`;

        if (normalized === '' || normalized === '.' || absoluteAdoPath === '/') {
          logger.debug(
            `Skipping commit for "${relativeFilePath}" (resolves to repo root or empty path).`,
          );
          fileResult.success = true;
          fileResult.message = 'Skipped commit for root or empty path.';
          fileResult.adoPath = absoluteAdoPath;
          return fileResult;
        }
        fileResult.adoPath = absoluteAdoPath;
        return fileResult;
      }

      // Always set absoluteAdoPath for files to be processed
      if (cleanRepoDirName) {
        // If we have a cleanRepoDirName, adoDestPath is already set above
        let normalized = adoDestPath.replace(/\\/g, '/').replace(/^\/+/, '');
        if (!normalized || normalized === '.' || normalized === '/') {
          normalized = path.basename(relativeFilePath);
        }
        absoluteAdoPath = `/${normalized}`;
      } else {
        let normalized = adoDestPath.replace(/\\/g, '/').replace(/^\/+/, '');
        if (!normalized || normalized === '.' || normalized === '/') {
          normalized = path.basename(relativeFilePath);
        }
        absoluteAdoPath = `/${normalized}`;
      }

      logger.debug(`Processing file: ${relativeFilePath}`);
      logger.debug(` → Local path: ${fullLocalFilePath}`);
      logger.debug(` → ADO path: ${absoluteAdoPath}`);

      try {
        const buffer = await fs.promises.readFile(fullLocalFilePath);
        const localBase64 = buffer.toString('base64');
        let currentItem = null;

        // Check if file already exists on the branch
        const getItemUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(
          absoluteAdoPath,
        )}&versionDescriptor.version=${encodeURIComponent(
          effectiveBranchName,
        )}&includeContent=true&api-version=${AZURE_DEVOPS_API_VERSION}`;

        try {
          const getItemResp = await superagent
            .get(getItemUrl)
            .set(
              'Authorization',
              `Basic ${encodePat(AZURE_DEVOPS_PAT)}`,
            )
            .set('User-Agent', USER_AGENT);

          if (getItemResp.status === 200) {
            currentItem = getItemResp.body;
            if (currentItem.content === localBase64) {
              logger.info(
                `Identical content for "${absoluteAdoPath}". Skipping.`,
              );
              fileResult.success = true;
              fileResult.message = 'Content identical, skipped commit.';
              fileResult.adoPath = absoluteAdoPath;
              return fileResult;
            }
          }
        } catch (getErr) {
          if (getErr.status !== 404) {
            logger.warn(
              `Error checking existing file "${absoluteAdoPath}": ${getErr.message}`,
            );
          }
        }

        // Schedule add or edit
        changes.push({
          changeType: currentItem ? 'edit' : 'add',
          item: { path: absoluteAdoPath },
          newContent: {
            content: buffer.toString('utf8'),
            contentType: 'rawText',
          },
        });

        fileResult.success = true;
        fileResult.message = currentItem
          ? 'Scheduled for update'
          : 'Scheduled for addition';
        fileResult.adoPath = absoluteAdoPath;
        return fileResult;
      } catch (readErr) {
        logger.error(
          `Error reading file ${fullLocalFilePath}: ${readErr.message}`,
        );
        fileResult.success = false;
        fileResult.message = `Failed to read file: ${readErr.message}`;
        fileResult.adoPath = absoluteAdoPath;
        return fileResult;
      }
    },
  );

  // --- Wait for file scans & gather results ---
  const individualFileResults = await Promise.all(
    fileProcessingPromises,
  );
  results.push(...individualFileResults);

  if (changes.length === 0) {
    return {
      success: true,
      message: 'No new or changed files to commit.',
      status: 200,
      results,
    };
  }

  // --- Build and send the push ---
  // Preview endpoint is broken, so we use the standard push endpoint
  const pushUrl = `${ADO_BASEURI}/${organization}/${project}/_apis/git/repositories/${repo.name}/pushes?api-version=7.0`;

  const pushBody = {
    repository: { id: repo.id, name: repo.name },
    refUpdates: [
      {
        name: `refs/heads/${effectiveBranchName}`,
        oldObjectId: latestCommitId,
      },
    ],
    commits: [
      {
        comment: `Automated commit from AIBot – ${changes.length} file(s)`,
        changes,
      },
    ],
  };

  // Refactor retry logic to avoid await in loop
  async function tryPushWithRetries() {
    let attempt = 0;
    let pushSuccess = false;
    let lastPushError = null;
    let updatedPushBody = { ...pushBody };

    while (attempt <= maxRetries && !pushSuccess) {
      try {
        if (attempt > 0) {
          logger.info(
            `Retrying push (attempt ${attempt}/${maxRetries})…`,
          );
          // eslint-disable-next-line no-await-in-loop
          await delay(1000 * attempt);
        }

        // eslint-disable-next-line no-await-in-loop
        const pushResp = await superagent
          .post(pushUrl)
          .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
          .set('User-Agent', USER_AGENT)
          .send(updatedPushBody);

        if ([200, 201].includes(pushResp.status)) {
          logger.info(
            `Successfully pushed changes to ${effectiveBranchName}.`,
          );
          pushSuccess = true;
        } else if (
          pushResp.status === 409
          || (pushResp.status === 400
            && pushResp.body.message.includes(
              'A push to the default branch is not allowed',
            ))
        ) {
          // branch policy / conflict: re-fetch and retry
          logger.warn(
            'Conflict or policy error; re-fetching ref and retrying…',
          );
          lastPushError = new Error(pushResp.body.message || 'Conflict');
          // eslint-disable-next-line no-await-in-loop
          const refRefresh = await superagent
            .get(refUrl)
            .set(
              'Authorization',
              `Basic ${encodePat(AZURE_DEVOPS_PAT)}`,
            )
            .set('User-Agent', USER_AGENT);
          if (
            refRefresh.status === 200
            && (refRefresh.body && refRefresh.body.value && refRefresh.body.value.length > 0)
          ) {
            updatedPushBody = {
              ...updatedPushBody,
              refUpdates: [
                {
                  ...updatedPushBody.refUpdates[0],
                  oldObjectId: refRefresh.body.value[0].objectId,
                },
              ],
            };
          } else {
            lastPushError = new Error(
              `Failed to re-fetch ref: ${refRefresh.body.message || 'unknown'}`,
            );
            break;
          }
        } else {
          lastPushError = new Error(
            pushResp.body.message || 'Unknown push error',
          );
          break;
        }
      } catch (pushErr) {
        const status = (pushErr.response && pushErr.response.status) || 'N/A';
        const msg = (pushErr.response && pushErr.response.body && (pushErr.response.body.message || pushErr.response.body.value))
          || pushErr.message;
        logger.error(`Push exception [${status}]: ${msg}`);

        lastPushError = new Error(`Push failed: ${msg}`);
        if (
          status === 429
          || (status >= 500 && status < 600)
        ) {
          // allow retry
        } else {
          break;
        }
      }
      attempt += 1;
    }

    if (!pushSuccess) {
      throw new Error(
        `Failed to commit files after ${maxRetries} retries: ${lastPushError && lastPushError.message ? lastPushError.message : ''}`,
      );
    }
  }

  await tryPushWithRetries();

  // Mark scheduled changes as successful (avoid assignment to parameter)
  const updatedResults = results.map((r) => {
    if (typeof r.message === 'string' && r.message.startsWith('Scheduled for')) {
      return {
        ...r,
        success: true,
        message: r.message.replace('Scheduled for', 'Successfully'),
      };
    }
    return r;
  });

  return {
    success: true,
    results: updatedResults,
    message:
      'All selected files processed and committed successfully.',
  };
}

module.exports = {
  checkAdoBranchExists,
  checkAdoRepoExists,
  commitAdoFiles,
  createAdoBranch,
  createAdoPullRequest,
  createAdoRepo,
  fetchAdoRepoContentsRecursive,
  getAdoDefaultBranch,
  listAdoBranches,
  listAdoCommitHistory,
  listAdoDirectoryContents,
  listAdoPipelines,
  listAdoRepos,
  switchAdoBranch,
};
