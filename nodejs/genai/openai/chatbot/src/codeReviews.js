const { Mutex } = require('async-mutex');
const logger = require('./logger');
const { fetchRepoContentsRecursive } = require('./gitFunctions');
const { createUniqueTempDir, deleteDirectoryRecursively, readFilesInDirectory } = require('./utilities');

// Import a thread-safe Map implementation (e.g., from 'async-mutex')

// Create a map to store temporary directories and their associated mutexes per session
const sessionTempDirs = new Map();
const sessionMutexes = new Map();

/**
 * Gets or creates a mutex for a given session ID.
 * @param {string} sessionId The unique identifier for the session.
 * @returns {Mutex} The mutex for the session.
 */
function getSessionMutex(sessionId) {
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
 * @param {string} repoPath The GitHub path name.
 * @returns {Promise<string[]|{ success: boolean,
 * message: string }>}
 * Array of public file content or an error object.
 * @throws {Error} If API request fails or user is not found.
 */
async function codeReviews(sessionId, username, repoName, repoPath) {
  const mutex = getSessionMutex(sessionId);
  const release = await mutex.acquire();
  let tmpDir = sessionTempDirs.get(sessionId);

  try {
    if (!tmpDir) {
      tmpDir = await createUniqueTempDir();
      sessionTempDirs.set(sessionId, tmpDir);
    }

    const response = await fetchRepoContentsRecursive(
      sessionId,
      username,
      repoName,
      repoPath,
      tmpDir,
      false
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
    logger.error(`Error getting files for review (exception) [Session: ${sessionId}]: ${error.message || error}`);
    throw error;
  } finally {
    release();
    // Consider when to clean up the temporary directory.
    // For long-running sessions, you might want a separate cleanup mechanism
    // or clean up when the session ends. For this example, we'll keep it
    // for the session's lifetime.
  }
}

/**
 * Cleans up the temporary directory associated with a specific session.
 * @async
 * @param {string} sessionId The unique identifier for the session.
 */
async function cleanupSession(sessionId) {
  const tmpDir = sessionTempDirs.get(sessionId);
  if (tmpDir) {
    try {
      await deleteDirectoryRecursively(tmpDir);
      sessionTempDirs.delete(sessionId);
      sessionMutexes.delete(sessionId);
      logger.info(`Cleaned up temporary directory for session: ${sessionId}`);
    } catch (error) {
      logger.error(`Error cleaning up temporary directory for session ${sessionId}: ${error.message || error}`);
    }
  }
}

module.exports = {
  codeReviews,
  cleanupSession,
};
