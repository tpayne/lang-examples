const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs').promises; // <-- ADDED: Import fs.promises
const logger = require('./logger'); // Assuming a logger utility exists

// Import necessary utilities from your utilities.js
const {
  saveCodeToFile,
  getOrCreateSessionTempDir,
  cleanupSessionTempDir,
} = require('./utilities');

// Global variable to store if Terraform CLI is available
let isTerraformCliAvailable = false;

// Map to store cloud context variables per session
// Key: sessionId, Value: { cloudProvider: 'aws'|'azure'|'gcp', credentials: { ... } }
const sessionCloudContext = new Map();

/**
 * Sets the cloud context for a given session.
 * This function stores the target cloud provider and its associated credentials/configuration.
 * @param {string} sessionId - The unique identifier for the session.
 * @param {'aws' | 'azure' | 'gcp'} cloudProvider - The target cloud provider.
 * @param {object} credentials - An object containing the necessary credentials/configuration for the cloud provider.
 * For AWS: { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION }
 * For Azure: { ARM_CLIENT_ID, ARM_CLIENT_SECRET, ARM_TENANT_ID, ARM_SUBSCRIPTION_ID }
 * For GCP: { GOOGLE_APPLICATION_CREDENTIALS_JSON } (JSON string of service account key)
 */
function setCloudContext(sessionId, cloudProvider, credentials) {
  if (!['aws', 'azure', 'gcp'].includes(cloudProvider)) {
    throw new Error(`Unsupported cloud provider: ${cloudProvider}. Must be 'aws', 'azure', or 'gcp'.`);
  }
  sessionCloudContext.set(sessionId, { cloudProvider, credentials });
  logger.info(`[Session: ${sessionId}] Cloud context set to: ${cloudProvider}`);
}

/**
 * Checks if the Terraform CLI is installed and accessible by running 'terraform version'.
 * This function updates an internal flag and should be called once during integration loading.
 * @returns {Promise<boolean>} True if Terraform CLI is found, false otherwise.
 */
async function checkTerraformCliExists() {
  try {
    // Use a short timeout for version check to fail fast if terraform isn't found
    const { stdout } = await execPromise('terraform version', { timeout: 5000 });
    logger.info(`Terraform CLI found: ${stdout.split('\n')[0]}`);
    isTerraformCliAvailable = true;
    return true;
  } catch (error) {
    logger.warn(`Terraform CLI not found or not accessible. Please ensure it is installed and in your system's PATH. Error: ${error.message}`);
    isTerraformCliAvailable = false;
    return false;
  }
}

/**
 * Executes a Terraform CLI command in a specified directory.
 * @param {string} sessionId - The session ID for logging.
 * @param {string} command - The Terraform command to execute (e.g., 'init', 'plan', 'apply -auto-approve').
 * @param {string} workingDirectory - The directory where the command should be executed.
 * @param {object} [options={}] - Additional options for child_process.exec.
 * @returns {Promise<object>} The stdout and stderr of the command.
 * @throws {Error} If the command fails or Terraform CLI is not available.
 */
async function executeTerraformCommand(sessionId, command, workingDirectory, options = {}) {
  if (!isTerraformCliAvailable) {
    throw new Error('Terraform CLI is not available. Please ensure it is installed and accessible in the environment.');
  }

  const fullCommand = `terraform ${command}`;
  logger.info(`[Session: ${sessionId}] Executing Terraform command: "${fullCommand}" in "${workingDirectory}"`);

  // Get cloud context for the session
  const currentContext = sessionCloudContext.get(sessionId);
  const env = { ...process.env }; // Start with existing environment variables

  if (currentContext) {
    logger.debug(`[Session: ${sessionId}] Applying cloud context for ${currentContext.cloudProvider}`);
    switch (currentContext.cloudProvider) {
      case 'aws':
        env.AWS_ACCESS_KEY_ID = currentContext.credentials.AWS_ACCESS_KEY_ID;
        env.AWS_SECRET_ACCESS_KEY = currentContext.credentials.AWS_SECRET_ACCESS_KEY;
        env.AWS_REGION = currentContext.credentials.AWS_REGION;
        break;
      case 'azure':
        env.ARM_CLIENT_ID = currentContext.credentials.ARM_CLIENT_ID;
        env.ARM_CLIENT_SECRET = currentContext.credentials.ARM_CLIENT_SECRET;
        env.ARM_TENANT_ID = currentContext.credentials.ARM_TENANT_ID;
        env.ARM_SUBSCRIPTION_ID = currentContext.credentials.ARM_SUBSCRIPTION_ID;
        break;
      case 'gcp':
        // For GCP, it's common to use GOOGLE_APPLICATION_CREDENTIALS
        // which points to a service account key file.
        // We'll save the JSON content to a temp file and set the env var.
        if (currentContext.credentials.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
          const credsDir = path.join(workingDirectory, '.tf_creds');
          await fs.mkdir(credsDir, { recursive: true });
          const credsFilePath = path.join(credsDir, 'gcp-sa-key.json');
          await fs.writeFile(credsFilePath, currentContext.credentials.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'utf8');
          env.GOOGLE_APPLICATION_CREDENTIALS = credsFilePath;
          logger.debug(`[Session: ${sessionId}] GCP credentials saved to ${credsFilePath}`);
        } else {
          logger.warn(`[Session: ${sessionId}] GCP cloud context set but GOOGLE_APPLICATION_CREDENTIALS_JSON is missing.`);
        }
        break;
      default: // <-- ADDED: Default case for switch statement
        logger.warn(`[Session: ${sessionId}] Unknown cloud provider in context: ${currentContext.cloudProvider}. No specific environment variables set.`);
        break;
    }
  } else {
    logger.warn(`[Session: ${sessionId}] No cloud context set for this session. Terraform may fail if provider credentials are required.`);
  }

  try {
    const { stdout, stderr } = await execPromise(fullCommand, {
      cwd: workingDirectory,
      timeout: 600000, // 10 minutes timeout for potentially long-running commands like apply/destroy
      maxBuffer: 1024 * 1024 * 5, // Increase buffer to 5MB for large outputs (e.g., plans)
      env, // Pass the augmented environment variables
      ...options,
    });

    if (stderr) {
      logger.warn(`[Session: ${sessionId}] Terraform command stderr: ${stderr}`);
    }
    logger.info(`[Session: ${sessionId}] Terraform command stdout: ${stdout}`);
    return { stdout, stderr };
  } catch (error) {
    const errorMessage = error.stderr || error.message;
    logger.error(`[Session: ${sessionId}] Terraform command failed: ${errorMessage}`);
    throw new Error(`Terraform command "${command}" failed: ${errorMessage}`);
  } finally {
    // Clean up GCP credentials file if it was created
    if (currentContext && currentContext.cloudProvider === 'gcp' && env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credsFilePath = env.GOOGLE_APPLICATION_CREDENTIALS;
      const credsDir = path.dirname(credsFilePath);
      await fs.rm(credsDir, { recursive: true, force: true }).catch((err) => {
        logger.error(`[Session: ${sessionId}] Failed to clean up GCP credentials directory. Error: ${err.message}`);
      });
      logger.debug(`[Session: ${sessionId}] Cleaned up GCP credentials at ${credsFilePath}`);
    }
  }
}

/**
 * Orchestrates a full Terraform CLI workflow: saving files, running init, and then the specified action.
 * @param {string} sessionId - The current session ID.
 * @param {object} terraformFiles - An object where keys are filenames (e.g., 'main.tf') and values are their HCL/JSON content.
 * @param {'plan' | 'apply' | 'destroy' | 'refresh' | 'validate' | 'fmt' | 'output' | 'state list' | 'state show' | 'state rm' | 'state mv'} action - The desired Terraform action.
 * @param {string} [projectDirectoryName='terraform-project'] - A subdirectory name within the session's temp dir to store the TF files.
 * @param {string} [additionalArgs=''] - Any additional arguments to pass to the Terraform command (e.g., '-var="foo=bar"', '-auto-approve').
 * @returns {Promise<object>} The result (stdout and stderr) of the Terraform operation.
 * @throws {Error} If Terraform CLI is not available or any step in the workflow fails.
 */
async function runTerraformCliWorkflow(
  sessionId,
  terraformFiles,
  action,
  projectDirectoryName = 'terraform-project',
  additionalArgs = '',
) {
  const sessionTempDir = await getOrCreateSessionTempDir(sessionId);
  const projectPath = path.join(sessionTempDir, projectDirectoryName);

  try {
    logger.info(`[Session: ${sessionId}] Starting Terraform CLI workflow with action '${action}'.`);

    // 1. Save Terraform code to session directory
    logger.info(`[Session: ${sessionId}] Saving Terraform files to: ${projectPath}`);
    await Promise.all(Object.keys(terraformFiles).map(async (filename) => {
      // saveCodeToFile will create projectPath if it doesn't exist
      await saveCodeToFile(sessionId, terraformFiles[filename], filename, projectDirectoryName);
    }));

    // 2. Run terraform init
    logger.info(`[Session: ${sessionId}] Running 'terraform init' in ${projectPath}`);
    await executeTerraformCommand(sessionId, 'init', projectPath);

    // 3. Execute the specified Terraform action
    let command;
    switch (action) {
      case 'plan':
        command = `plan ${additionalArgs}`;
        break;
      case 'apply':
        // For apply, we almost always want auto-approve in automated workflows
        command = `apply -auto-approve ${additionalArgs}`;
        break;
      case 'destroy':
        // For destroy, we almost always want auto-approve in automated workflows
        command = `destroy -auto-approve ${additionalArgs}`;
        break;
      case 'refresh':
        command = `refresh ${additionalArgs}`;
        break;
      case 'validate':
        command = `validate ${additionalArgs}`;
        break;
      case 'fmt':
        command = `fmt ${additionalArgs}`;
        break;
      case 'output':
        command = `output ${additionalArgs}`;
        break;
      case 'state list':
        command = `state list ${additionalArgs}`;
        break;
      case 'state show':
        command = `state show ${additionalArgs}`;
        break;
      case 'state rm':
        command = `state rm ${additionalArgs}`;
        break;
      case 'state mv':
        command = `state mv ${additionalArgs}`;
        break;
      default:
        throw new Error(`Unsupported Terraform CLI action: ${action}`);
    }

    logger.info(`[Session: ${sessionId}] Running 'terraform ${command}' in ${projectPath}`);
    const result = await executeTerraformCommand(sessionId, command, projectPath);
    return result;
  } catch (error) {
    logger.error(`[Session: ${sessionId}] Terraform CLI workflow failed: ${error.message}`, error);
    throw error; // Re-throw to propagate the error
  } finally {
    // Clean up the entire session's temporary directory
    logger.info(`[Session: ${sessionId}] Cleaning up session temporary directory: ${sessionTempDir}`);
    await cleanupSessionTempDir(sessionId).catch((err) => logger.error(`Failed to clean up session temp directory: ${err.message}`));
  }
}

module.exports = {
  checkTerraformCliExists,
  runTerraformCliWorkflow,
  setCloudContext, // Export the new function
};
