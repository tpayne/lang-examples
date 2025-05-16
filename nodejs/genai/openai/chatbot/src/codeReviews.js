const logger = require('./logger');
const { fetchRepoContentsRecursive } = require('./gitFunctions');
const { readFilesInDirectory, getOrCreateSessionTempDir, cleanupSessionTempDir } = require('./utilities');
const { Mutex } = require('async-mutex'); // Ensure Mutex is imported

const sessionMutexes = new Map(); // **This map needs to be defined**

function getSessionMutex(sessionId) { // **This function needs to be defined**
  if (!sessionMutexes.has(sessionId)) {
    sessionMutexes.set(sessionId, new Mutex());
  }
  return sessionMutexes.get(sessionId);
}

/**
 * Lists the names of public repositories for a given GitHub username for a specific session.
 * Fetches repo data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * Uses a temporary directory and ensures thread safety per session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} username The GitHub username.
 * @param {string} repoName The GitHub repo name.
 * @param {string} repoDirName The GitHub path name.
 * @returns {Promise<string[]|{ success: boolean,\n * message: string }>}\n
 * Array of public file content or an error object.
 * @throws {Error} If API request fails or user is not found.
 */
async function codeReviews(sessionId, username, repoName, repoDirName) { // Reverted function signature
  let tmpDir;
  const sessionMutex = getSessionMutex(sessionId); // Acquire mutex
  const release = await sessionMutex.acquire();
  try {
    tmpDir = await getOrCreateSessionTempDir(sessionId);

    // Call fetchRepoContentsRecursive, passing repoDirName as both repoDirName and initialrepoDirName.
    // Since codeReviews doesn't have a branch parameter, fetchRepoContentsRecursive
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
      3 // maxRetries
      // Branch parameter is omitted here, fetchRepoContentsRecursive will use its default
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
 * Cleans up the temporary directory associated with a specific session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 */
async function cleanupSession(sessionId) {
  await cleanupSessionTempDir(sessionId);
}

module.exports = {
  codeReviews,
  cleanupSession,
};