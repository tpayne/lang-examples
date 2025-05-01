const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const logger = require('./logger'); // Assuming you have a logger module

/**
 * Creates a directory at the specified path, deleting it first if it already exists.
 *
 * This function attempts to remove the directory at `localDestPath` recursively
 * if it exists, and then creates a new directory at that path. If the directory
 * does not exist, it simply creates it. If an error occurs during the deletion
 * process that is not related to the directory not existing, the error is re-thrown.
 *
 * @async
 * @function mkdir
 * @param {string} localDestPath - The path to the directory to create.
 * @throws {Error} Throws an error if there is an issue deleting the directory
 * that is not due to the directory not existing.
 */
async function mkdir(localDestPath) {
  try {
    // Recursively delete the directory if it exists
    await fs.rm(localDestPath, { recursive: true, force: true });
  } catch (error) {
    // Handle the error if the directory does not exist
    if (error.code !== 'ENOENT') {
      throw error; // Rethrow the error if it's not a "not found" error
    }
  }
  await fs.mkdir(localDestPath, { recursive: true });
}

/**
 * Recursively deletes a directory and all its contents (files and subdirectories).
 *
 * This function takes a directory path as input and deletes the directory along
 * with all its files and subdirectories. If the directory does not exist, it
 * will not throw an error. If an error occurs during the deletion process, it
 * will log the error and re-throw it.
 *
 * @async
 * @function deleteDirectoryRecursively
 * @param {string} dirPath - The path to the directory to delete.
 * @throws {Error} Throws an error if there is an issue deleting the directory.
 *
 */
async function deleteDirectoryRecursively(dirPath) {
  try {
    // Read the contents of the directory
    const files = await fs.readdir(dirPath);

    // Recursively delete each file and subdirectory
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        // If it's a directory, call the function recursively
        await deleteDirectoryRecursively(filePath);
      } else {
        // If it's a file, delete it
        await fs.unlink(filePath);
      }
    }));

    // Remove the now-empty directory
    await fs.rmdir(dirPath);
  } catch (error) {
    logger.error(`Error deleting directory: ${dirPath}`, error);
    throw error; // Re-throw the error for handling by the caller
  }
}

/**
 * Creates a unique temporary directory with write permissions.
 *
 * This function generates a unique directory name using a random string,
 * creates the directory in the system's temporary folder, and grants
 * write permissions to it. The path of the created directory is returned.
 *
 * @async
 * @function createUniqueTempDir
 * @returns {Promise<string>} The path to the created temporary directory.
 * @throws {Error} Throws an error if the directory cannot be created.
 * */
async function createUniqueTempDir() {
  // Generate a unique directory name
  const uniqueDirName = crypto.randomBytes(16).toString('hex');
  const tempDirPath = path.join(os.tmpdir(), uniqueDirName);

  try {
    // Create the directory with write permissions
    await fs.mkdir(tempDirPath, { recursive: true });

    // Set write permissions (this is usually the default, but can be enforced)
    await fs.chmod(tempDirPath, 0o700); // Owner can read, write, and execute

    return tempDirPath;
  } catch (error) {
    throw new Error(`Failed to create temporary directory: ${error.message}`);
  }
}

/**
 * Reads the content of a file.
 *
 * @param {string} filePath The path to the file to read.
 * @returns {Promise<string|null>} A promise that resolves with the file content as a string,
 * or null if an error occurred while reading the file.
 */
async function readFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    logger.error(`Error reading file: ${filePath}`, error);
    // Don't re-throw here. readFileContent might be called
    // in a loop, and we want to continue processing other files.
    // A return null will signal to the caller that *this* file
    // had a problem.
    return null; // Return null on error
  }
}

/* eslint-disable no-continue, no-restricted-syntax, no-await-in-loop,  */

/**
 * Recursively reads all files in a directory and its subdirectories.
 *
 * @param {string} dirPath The path to the directory to read.
 * @returns {Promise<string[]>} A promise that resolves with an array of absolute file paths.
 * @throws {Error} Throws an error if the initial directory cannot be read.
 */
async function readFilesRecursively(dirPath) {
  const files = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await readFilesRecursively(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Handle the error, and then re-throw. This is important,
    // because if the *initial* directory doesn't exist, we want
    // the caller to know. (E.g., the user provided a bad path.)
    logger.error(`Error reading directory: ${dirPath}`, error);
    throw error; // Re-throw the error.
  }
  return files;
}

/**
 * Reads all files in a specified directory and returns a Map of file paths and their contents.
 *
 * This function recursively retrieves all file paths in the given directory,
 * reads the content of each file, and stores the file path and content in a Map.
 * If a file cannot be read, it logs a warning and skips that file. If an error
 * occurs while reading the directory, it logs the error and re-throws it.
 *
 * @async
 * @function readFilesInDirectory
 * @param {string} directoryPath - The path to the directory from which to read files.
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where the
 * keys are absolute file paths
 * and the values are the contents of the files.
 * @throws {Error} Throws an error if there is an issue reading the directory.
 */
async function readFilesInDirectory(directoryPath) {
  const filesMap = new Map(); // Create a Map to store file paths and their contents

  try {
    const filePaths = await readFilesRecursively(directoryPath);
    for (const filePath of filePaths) {
      const fileContent = await readFileContent(filePath);
      if (fileContent === null) {
        logger.warn(`Skipping file: ${filePath} due to read error.`);
        continue; // Skip to the next file
      }
      filesMap.set(filePath, fileContent); // Store the file path and content in the Map
    }
  } catch (error) {
    logger.error(`Error reading directory: ${directoryPath}`, error);
    throw error; // Re-throw the error.
  }
  return filesMap; // Return the Map of file paths and contents
}

/* eslint-enable no-continue, no-restricted-syntax, no-await-in-loop,  */

module.exports = {
  createUniqueTempDir,
  deleteDirectoryRecursively,
  mkdir,
  readFilesInDirectory,
};
