const fs = require('fs/promises');
const path = require('path');
const archiver = require('archiver');
const logger = require('./logger'); // Assuming a logger utility exists

// Import necessary utilities from your utilities.js
const {
  saveCodeToFile,
  getOrCreateSessionTempDir, // Use this to get the session's base temp directory
  cleanupSessionTempDir,    // Use this for comprehensive cleanup
} = require('./utilities');

// Import Terraform functions from your terraform.js
const {
  terraformApply,
  terraformPlan,
} = require('./terraform');

/**
 * Creates a .tar.gz archive of a given directory.
 * @param {string} sourceDirectory - The path to the directory to archive.
 * @param {string} outputFilePath - The full path for the output .tar.gz file.
 * @returns {Promise<void>} A promise that resolves when the archive is created.
 */
async function createTarGzFromDirectory(sourceDirectory, outputFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('tar', {
      gzip: true,
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', () => {
      logger.info(`[Archiver] Archive created: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn(`[Archiver] Warning: ${err.message}`);
      } else {
        logger.error(`[Archiver] Error: ${err.message}`);
        reject(err);
      }
    });

    archive.on('error', (err) => {
      logger.error(`[Archiver] Archiving failed: ${err.message}`);
      reject(err);
    });

    archive.pipe(output);

    // Append the source directory. The 'dest' option ensures files are at the root of the archive.
    archive.directory(sourceDirectory, false);

    archive.finalize();
  });
}

/**
 * Orchestrates the full Terraform workflow: saving files, creating a .tar.gz,
 * uploading to Terraform Cloud, and initiating a plan or apply.
 * @param {string} sessionId - The current session ID.
 * @param {string} organizationName - The name of the Terraform Cloud/Enterprise organization.
 * @param {string} workspaceName - The name of the Terraform Cloud workspace.
 * @param {object} terraformFiles - An object where keys are filenames (e.g., 'main.tf') and values are their HCL/JSON content.
 * @param {'plan' | 'apply'} action - The desired Terraform action ('plan' or 'apply').
 * @param {string} [projectDirectoryName='terraform-project'] - A subdirectory name within the session's temp dir to store the TF files.
 * @param {string} [message] - An optional message for the Terraform run.
 * @returns {Promise<object>} The result of the Terraform plan or apply operation.
 */
async function runTerraformWorkflow(
  sessionId,
  organizationName,
  workspaceName,
  terraformFiles,
  action,
  projectDirectoryName = 'terraform-project',
  message = `Triggered by API ${action}`
) {
  // Get the session's base temporary directory using the utility function
  const sessionTempDir = await getOrCreateSessionTempDir(sessionId);
  const projectPath = path.join(sessionTempDir, projectDirectoryName);
  const tarGzOutputPath = path.join(sessionTempDir, `${projectDirectoryName}.tar.gz`);

  try {
    logger.info(`[Session: ${sessionId}] Starting Terraform workflow for workspace '${workspaceName}' with action '${action}'.`);

    // 1. Save Terraform code to session directory
    logger.info(`[Session: ${sessionId}] Saving Terraform files to: ${projectPath}`);
    // saveCodeToFile handles creating the directory structure if projectDirectoryName is provided
    for (const filename in terraformFiles) {
      if (Object.prototype.hasOwnProperty.call(terraformFiles, filename)) {
        await saveCodeToFile(sessionId, terraformFiles[filename], filename, projectDirectoryName);
      }
    }

    // 2. Create a .tar.gz archive from the saved files
    logger.info(`[Session: ${sessionId}] Creating .tar.gz archive from ${projectPath}`);
    await createTarGzFromDirectory(projectPath, tarGzOutputPath);

    // 3. Read the .tar.gz into a Buffer
    const tarGzBuffer = await fs.readFile(tarGzOutputPath);
    logger.info(`[Session: ${sessionId}] .tar.gz archive read into buffer. Size: ${tarGzBuffer.length} bytes.`);

    // 4. Upload and run Terraform operation
    let result;
    if (action === 'apply') {
      logger.info(`[Session: ${sessionId}] Initiating terraformApply...`);
      result = await terraformApply(sessionId, organizationName, workspaceName, tarGzBuffer, message);
    } else if (action === 'plan') {
      logger.info(`[Session: ${sessionId}] Initiating terraformPlan...`);
      result = await terraformPlan(sessionId, organizationName, workspaceName, tarGzBuffer, message);
    } else {
      throw new Error(`Unsupported action: ${action}. Must be 'plan' or 'apply'.`);
    }

    logger.info(`[Session: ${sessionId}] Terraform operation '${action}' completed successfully.`);
    return result;

  } catch (error) {
    logger.error(`[Session: ${sessionId}] Terraform workflow failed: ${error.message}`, error);
    throw error; // Re-throw to propagate the error
  } finally {
    // Clean up the entire session's temporary directory using the utility function
    logger.info(`[Session: ${sessionId}] Cleaning up session temporary directory: ${sessionTempDir}`);
    await cleanupSessionTempDir(sessionId).catch(err => logger.error(`Failed to clean up session temp directory: ${err.message}`));
  }
}

module.exports = {
  runTerraformWorkflow,
};
