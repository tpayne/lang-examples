const { Mutex } = require('async-mutex'); // Ensure Mutex is imported
const logger = require('./logger');
const { fetchRepoContentsRecursive, switchBranch } = require('./gitFunctions');
const { fetchAdoRepoContentsRecursive, switchAdoBranch } = require('./adoFunctions'); // Import ADO functions
const { readFilesInDirectory, getOrCreateSessionTempDir, cleanupSessionTempDir } = require('./utilities');

const sessionMutexes = new Map();

function getSessionMutex(sessionId) {
  if (!sessionMutexes.has(sessionId)) {
    sessionMutexes.set(sessionId, new Mutex());
  }
  return sessionMutexes.get(sessionId);
}

/**
 * Reviews files in a given GitHub repository.
 * Fetches repo data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * Uses a temporary directory and ensures thread safety per session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} username The GitHub username.
 * @param {string} repoName The GitHub repo name.
 * @param {string} repoDirName The GitHub path name.
 * @param {string} branchName The GitHub repo branch to use.
 * @returns {Promise<string[] | { success: boolean, message: string }>} Array of public repository names or an error object.
 * @throws {Error} If API request fails or user is not found.
 */
async function codeReviews(sessionId, username, repoName, repoDirName, branchName) {
  let tmpDir;
  const sessionMutex = getSessionMutex(sessionId);
  const release = await sessionMutex.acquire(); // Acquire mutex for this session

  try {
    // if the branchName is provided, switch to that branch
    // before fetching the repo contents.
    if (branchName) {
      const resp = await switchBranch(username, repoName, branchName);
      if (!resp.success) {
        return {
          success: false,
          message: resp.message,
        };
      }
    }

    tmpDir = await getOrCreateSessionTempDir(sessionId);
    logger.info(`Starting code review for GitHub repo: ${username}/${repoName}/${repoDirName} on branch ${branchName} [Session: ${sessionId}]`);

    // Ensure the specified branch exists and switch to it if necessary
    // If branchName is not provided, fetchRepoContentsRecursive
    // will use its default branch (likely 'main').
    const response = await fetchRepoContentsRecursive(
      sessionId,
      username,
      repoName,
      repoDirName, // Current path for the first fetch
      repoDirName, // **Initial path for relative path calculation**
      tmpDir,
      false, // includeDotGithub
      true, // skipBinaryFiles
      0, // retryCount
      3, // maxRetries
      branchName, // Pass the branchName here
    );

    if (!response.success) {
      return {
        success: false,
        message: response.message,
      };
    }

    // readFilesInDirectory will now return file paths relative to the temporary directory root,
    // which should mirror the structure relative to the original repoDirName.
    const files = await readFilesInDirectory(tmpDir);
    return Array.from(files);
  } catch (error) {
    logger.error(`Error getting files for review (exception) [Session: ${sessionId}]: ${error.message || error}`);
    throw error;
  } finally {
    release(); // Release the mutex
    // Cleanup logic remains the same, handled by cleanupSession or similar
  }
}

/**
 * Reviews files in a given Azure DevOps repository.
 * Fetches repo data and extracts file paths.
 * Handles API errors and "Not Found" exceptions.
 * Uses a temporary directory and ensures thread safety per session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The Azure DevOps repo name.
 * @param {string} repoDirName The Azure DevOps path within the repository.
 * @param {string} branchName The Azure DevOps repo branch to use.
 * @returns {Promise<string[] | { success: boolean, message: string }>} Array of file paths or an error object.
 * @throws {Error} If API request fails or resource is not found.
 */
async function adoCodeReviews(sessionId, organization, project, repoName, repoDirName, branchName) {
  let tmpDir;
  const sessionMutex = getSessionMutex(sessionId);
  const release = await sessionMutex.acquire(); // Acquire mutex for this session

  try {
    // if the branchName is provided, switch to that branch
    // before fetching the repo contents.
    if (branchName) {
      const resp = await switchAdoBranch(organization, project, repoName, branchName);
      if (!resp.success) {
        return {
          success: false,
          message: resp.message,
        };
      }
    }

    tmpDir = await getOrCreateSessionTempDir(sessionId);
    logger.info(`Starting code review for Azure DevOps repo: ${organization}/${project}/${repoName}/${repoDirName} on branch ${branchName} [Session: ${sessionId}]`);

    const response = await fetchAdoRepoContentsRecursive(
      sessionId,
      organization,
      project,
      repoName,
      repoDirName,
      branchName,
      tmpDir,
      true, // skipBinaryFiles
    );

    if (!response.success) {
      return {
        success: false,
        message: response.message,
      };
    }

    const files = await readFilesInDirectory(tmpDir);
    return Array.from(files);
  } catch (error) {
    logger.error(`Error getting files for ADO review (exception) [Session: ${sessionId}]: ${error.message || error}`);
    throw error;
  } finally {
    release(); // Release the mutex
  }
}

/**
 * Cleans up the temporary directory associated with a specific session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 */
async function cleanupSession(sessionId) {
  await cleanupSessionTempDir(sessionId);
}

module.exports = {
  codeReviews,
  adoCodeReviews, // Export the new ADO code review function
  cleanupSession,
};
