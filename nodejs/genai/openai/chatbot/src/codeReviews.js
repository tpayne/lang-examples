const logger = require('./logger');
const { fetchRepoContentsRecursive } = require('./gitFunctions');
const { readFilesInDirectory, getOrCreateSessionTempDir, cleanupSessionTempDir } = require('./utilities');

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
  let tmpDir;
  try {
    tmpDir = await getOrCreateSessionTempDir(sessionId);

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