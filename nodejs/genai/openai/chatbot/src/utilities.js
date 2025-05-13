const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid'); // Import uuid for unique directory names
const logger = require('./logger'); // Assuming you have a logger utility

/**
 * Creates a unique temporary directory.
 * @returns {Promise<string>} A promise that resolves with the path to the
 * created temporary directory.
 */
const createUniqueTempDir = async () => {
  const tempDir = os.tmpdir();
  const uniqueDirName = `genai-temp-${uuidv4()}`;
  const newDirPath = path.join(tempDir, uniqueDirName);

  try {
    await fs.mkdir(newDirPath, { recursive: true });
    logger.debug(`Created unique temporary directory: ${newDirPath}`);
    return newDirPath;
  } catch (error) {
    logger.error(
      `Error creating unique temporary directory: ${error.message}`,
    );
    throw new Error(
      `Failed to create unique temporary directory: ${error.message}`,
    );
  }
};

/**
 * Recursively deletes a directory.
 * @param {string} dirPath The path to the directory to delete.
 * @returns {Promise<void>} A promise that resolves when the directory is deleted.
 */
const deleteDirectoryRecursively = async (dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug(`Deleted directory recursively: ${dirPath}`);
  } catch (error) {
    logger.error(
      `Error deleting directory recursively ${dirPath}: ${error.message}`,
    );
    // Depending on requirements, you might want to throw here or just log
    // For temporary directories, logging might be sufficient as cleanup is best effort.
  }
};

/**
 * Creates a directory at the specified path, optionally deleting it first if it already exists.
 *
 * This function first checks if the directory exists. If `deleteExisting` is true and
 * the directory exists, it attempts to remove it recursively. Then, it creates a new
 * directory at the specified path. If the directory does not exist initially and
 * `deleteExisting` is false, it simply creates the directory.
 *
 * @async
 * @function mkdir
 * @param {string} localDestPath - The path to the directory to create.
 * @param {boolean} [deleteExisting=false] - If true, deletes the directory
 * if it exists before creating it.
 * @throws {Error} Throws an error if there is an issue checking for directory existence,
 * deleting the directory (that is not due to the directory not existing when deleteExisting is true),
 * or creating the directory.
 */
async function mkdir(localDestPath, deleteExisting = false) {
  if (!localDestPath) {
    logger.error('mkdir called with undefined localDestPath');
    throw new Error('localDestPath is undefined');
  }

  try {
    // Check if the directory exists

    try {
      const stats = await fs.stat(localDestPath);

      if (stats.isDirectory()) {
        await fs.chmod(localDestPath, 0o700); // Owner can read, write, and execute
        return { success: true, message: `Directory already exists, no action needed` };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error; // Re-throw if it's not a "directory does not exist" error
      }
      // Ignore ENOENT as the directory is expected not to exist
    }

    if (deleteExisting) {
      logger.debug(`Directory ${localDestPath} exists, deleting it recursively.`);
      await deleteDirectoryRecursively(localDestPath);
    }

    // Create the directory (recursive: true will not throw if the directory already exists)
    await fs.mkdir(localDestPath, { recursive: true });
  
    // Set permissions (this will apply even if the directory existed and wasn't deleted)
    await fs.chmod(localDestPath, 0o700); // Owner can read, write, and execute
  
    return { success: true, message: `Ensured directory ${localDestPath} exists with correct permissions` };

  } catch (error) {
    logger.error(`Failed to process directory ${localDestPath} - ${error.message}`);
    throw error;
  }
}

/**
 * Reads all files in a directory and its subdirectories.
 * @async
 * @param {string} dir The directory to start reading from.
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where keys are
 * relative file paths and values are file contents.
 */
/* eslint-disable no-restricted-syntax, no-await-in-loop */
const readFilesInDirectory = async (dir) => {
  const files = new Map();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Recursively read subdirectories
        const subDirFiles = await readFilesInDirectory(fullPath);
        // Merge maps
        for (const [relativePath, content] of subDirFiles.entries()) {
          files.set(path.join(entry.name, relativePath), content);
        }
      } else if (entry.isFile()) {
        // Read file content
        const content = await fs.readFile(fullPath, 'utf8');
        files.set(entry.name, content); // Store with just the filename for now
      }
    }
  } catch (error) {
    logger.error(`Error reading directory ${dir}: ${error.message}`);
    throw new Error(`Failed to read directory contents: ${error.message}`);
  }
  return files;
};
/* eslint-enable no-restricted-syntax, no-await-in-loop */

/**
 * Saves code content to a local file, creating directories if needed.
 * Handles cases where filename includes a path.
 * @async
 * @param {string} code The code content to save.
 * @param {string} filename The desired filename, can include a relative path.
 * @param {string} [directory='/tmp/nodeapp/'] The base directory to save the file
 *  in if filename is relative.
 * @returns {Promise<string>} A promise that resolves with the full path to the
 * saved file.
 * @throws {Error} If saving the file fails.
 */
const saveCodeToFile = async (code, filename, directory = '/tmp/nodeapp/') => {
  // Determine the full file path
  let fullPath;
  if (path.isAbsolute(filename) || filename.includes(path.sep)) {
    // If filename is already an absolute path or contains path separators, use it directly
    fullPath = filename;
  } else {
    // Otherwise, join the directory and filename
    fullPath = path.join(directory, filename);
  }

  // Ensure the directory exists
  const dirPath = path.dirname(fullPath);
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`Ensured directory exists: ${dirPath}`);
  } catch (error) {
    logger.error(`Error creating directory ${dirPath}: ${error.message}`);
    throw new Error(`Failed to create directory for file: ${error.message}`);
  }

  // Save the file
  try {
    await fs.writeFile(fullPath, code, 'utf8');
    logger.info(`Code saved successfully to: ${fullPath}`);
    return fullPath;
  } catch (error) {
    logger.error(`Error saving file ${fullPath}: ${error.message}`);
    throw new Error(`Failed to save file: ${error.message}`);
  }
};

module.exports = {
  createUniqueTempDir,
  deleteDirectoryRecursively,
  mkdir,
  readFilesInDirectory,
  saveCodeToFile,
};
