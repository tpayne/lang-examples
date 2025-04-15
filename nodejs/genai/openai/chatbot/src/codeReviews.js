const logger = require('./logger');

const {
  fetchRepoContentsRecursive,
} = require('./gitFunctions');

const {
  createUniqueTempDir,
  deleteDirectoryRecursively,
  readFilesInDirectory,
} = require('./utilities');


/* eslint-disable no-restricted-syntax, no-await-in-loop, consistent-return */

/**
 * Lists the names of public repositories for a given GitHub username.
 * Fetches repo data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The GitHub repo name.
 * @param {string} repoPath The GitHub path name.
 * @returns {Promise<string[]>} Array of public file content.
 * @throws {Error} If API request fails or user is not found.
 */
async function codeReviews(username, repoName, repoPath) {
  const responseMap = new Map();
  try {
    const tmpDir = await createUniqueTempDir();
    const response = await fetchRepoContentsRecursive(
      username,
      repoName,
      repoPath,
      tmpDir,
      false,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message,
      };
    }
    const files = await readFilesInDirectory(tmpDir);

    await deleteDirectoryRecursively(tmpDir);
    let count = 0;
    const counter = files.size; // Assuming files is an array
    for (const [fileN, fileContent] of files) {
      if (!fileContent) {
        continue;
      }
      responseMap.set(fileN,fileContent);
      count++;
    }

    return Array.from(responseMap.entries()).map(([fileN, analysis]) => ({
      fileName: fileN,
      result: analysis,
    }));
  } catch (error) {
    logger.error(`Error getting files for review (exception): ${error.message || error}`);
    throw error;
  }
}

module.exports = {
  codeReviews,
};
