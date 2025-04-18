const { Mutex } = require('async-mutex'); // Import Mutex for thread safety
const logger = require('./logger');

const {
  createGithubPullRequest,
  fetchRepoContentsRecursive,
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listGitHubActions,
  listPublicRepos,
} = require('./gitFunctions');

const {
  codeReviews,
  cleanupSession: cleanupCodeReviewSession, // Import cleanup for code reviews
} = require('./codeReviews');

const {
  getVehicleHistory,
} = require('./dosaFunctions');

/* eslint-disable max-len */

/**
 * @typedef {object} FunctionMetadata
 * @property {string} type - The type of the tool, typically 'function'.
 * @property {object} function - The function definition.
 * @property {string} function.name - The name of the function.
 * @property {string} function.description - A description of what the function does.
 * @property {object} function.parameters - The parameters the function accepts.
 * @property {string} function.parameters.type - The type of the parameters object ('object').
 * @property {object} function.parameters.properties - The individual parameters.
 * @property {object} function.parameters.properties.[parameterName] - Metadata for a specific parameter.
 * @property {string} function.parameters.properties.[parameterName].type - The type of the parameter (e.g., 'string', 'number', 'boolean').
 * @property {string} function.parameters.properties.[parameterName].description - A description of the parameter.
 * @property {string[]} function.parameters.required - An array of required parameter names.
 */

/**
 * @typedef {object} RegisteredFunction
 * @property {Function} func - The actual JavaScript function to execute.
 * @property {string[]} params - An array of parameter names the function expects.
 */

/**
 * Registry of available GitHub functions for AI, keyed by session ID.
 * @type {Map<string, Record<string, RegisteredFunction>>}
 */
const availableFunctionsRegistry = new Map();

/**
 * Metadata for GitHub functions as AI tools, stored per session.
 * @type {Map<string, FunctionMetadata[]>}
 */
const funcsMetadata = new Map();

/**
 * Mutex to control access to the function registries.
 * @type {Mutex}
 */
const registryMutex = new Mutex();

/**
 * Gets or creates the function registry for a given session ID.
 * @param {string} sessionId The unique identifier for the session.
 * @returns {Record<string, RegisteredFunction>} The function registry for the session.
 */
async function getSessionFunctionRegistry(sessionId) {
  const release = await registryMutex.acquire();
  try {
    if (!availableFunctionsRegistry.has(sessionId)) {
      availableFunctionsRegistry.set(sessionId, {});
    }
    return availableFunctionsRegistry.get(sessionId);
  } finally {
    release();
  }
}

/**
 * Gets or creates the function metadata array for a given session ID.
 * @param {string} sessionId The unique identifier for the session.
 * @returns {FunctionMetadata[]} The function metadata array for the session.
 */
async function getSessionFuncsMetadata(sessionId) {
  const release = await registryMutex.acquire();
  try {
    if (!funcsMetadata.has(sessionId)) {
      funcsMetadata.set(sessionId, []);
    }
    return funcsMetadata.get(sessionId);
  } finally {
    release();
  }
}

/**
 * Registers a new function for AI for a specific session.
 * @param {string} sessionId The unique identifier for the session.
 * @param {string} name - The unique name of the function (used as the key).
 * @param {Function} func - The JavaScript function to execute.
 * @param {string[]} params - An array of parameter names the function expects.
 * @param {string} description - A description of what the function does.
 * @param {object} parametersSchema - The JSON schema for the function's parameters.
 * @param {string[]} required - An array of required parameter names.
 */
async function registerFunction(sessionId, name, func, params, description, parametersSchema, required) {
  const sessionRegistry = await getSessionFunctionRegistry(sessionId);
  const sessionFuncs = await getSessionFuncsMetadata(sessionId);

  const release = await registryMutex.acquire();
  try {
    if (sessionRegistry[name]) {
      logger.warn(`Function with name '${name}' already registered for session '${sessionId}' and will be overwritten.`);
    }
    sessionRegistry[name] = { func, params };

    const functionMetadata = {
      type: 'function',
      function: {
        name,
        description,
        parameters: {
          type: 'object',
          properties: parametersSchema,
          required,
        },
      },
    };
    sessionFuncs.push(functionMetadata);
  } finally {
    release();
  }
}

async function loadCodeReviews(sessionId) {
  await registerFunction(
    sessionId,
    'file_review',
    (username, repoName, repoPath) => codeReviews(sessionId, username, repoName, repoPath),
    ['username', 'repoName', 'repoPath'],
    'Review files in a given GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    ['username', 'repoName', 'repoPath'],
  );
}

async function loadDosa(sessionId) {
  await registerFunction(
    sessionId,
    'get_mot_history',
    (registrationNumber) => getVehicleHistory(sessionId, registrationNumber),
    ['registrationNumber'],
    'Get the MOT History for a vehicle.',
    {
      registrationNumber: { type: 'string', description: 'The Vehicle registration or VIN number.' },
    },
    ['registrationNumber'],
  );
}

async function loadGitHub(sessionId) {
  await registerFunction(
    sessionId,
    'create_pull_request',
    createGithubPullRequest,
    ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'],
    'Create a pull request on a given GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      title: { type: 'string', description: 'The Pull Request title.' },
      sourceBranch: { type: 'string', description: 'The source branch name.' },
      targetBranch: { type: 'string', description: 'The target branch name.' },
      body: { type: 'string', description: 'The description or body of the pull request.' },
    },
    ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch'],
  );

  await registerFunction(
    sessionId,
    'fetch_repo_contents',
    fetchRepoContentsRecursive,
    ['username', 'repoName', 'repoPath', 'localDestPath', 'includeDotGithub', 'retryCount', 'maxRetries'],
    'Fetch or download the contents of a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
      localDestPath: { type: 'string', description: 'The target local directory path to download to.' },
      includeDotGithub: { type: 'boolean', description: 'A boolean to include .github metadata or not.' },
      retryCount: { type: 'number', description: 'The retry count to use.' },
      maxRetries: { type: 'number', description: 'The maximum number of retries.' },
    },
    ['username', 'repoName', 'repoPath', 'localDestPath', 'includeDotGithub', 'retryCount', 'maxRetries'],
  );

  await registerFunction(
    sessionId,
    'list_actions',
    listGitHubActions,
    ['username', 'repoName', 'status'],
    'Lists the GitHub actions running in a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      status: { type: 'string', description: 'The status of the actions (optional). Defaults to in_progress if not provided' },
    },
    ['username', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'list_public_repos',
    listPublicRepos,
    ['username'],
    'Lists public repositories for a given GitHub username.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
    },
    ['username'],
  );

  await registerFunction(
    sessionId,
    'list_branches',
    listBranches,
    ['username', 'repoName'],
    'Lists branches for a given GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    ['username', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'list_commit_history',
    listCommitHistory,
    ['username', 'repoName', 'dirName'],
    'Lists commit history for a file in a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      dirName: { type: 'string', description: 'The file or directory path.' },
    },
    ['username', 'repoName', 'dirName'],
  );

  await registerFunction(
    sessionId,
    'list_directory_contents',
    listDirectoryContents,
    ['username', 'repoName', 'repoDirName', 'recursive'],
    'Lists the contents of a directory in a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The directory path (optional). Defaults to root if not provided' },
      recursive: { type: 'boolean', description: 'Perform a recursive scan or not (optional). Defaults to false if not provided' },
    },
    ['username', 'repoName'],
  );
}

/**
 * Returns the function definitions for the AI tool for a specific session.
 * @param {string} sessionId The unique identifier for the session.
 * @returns {Promise<FunctionMetadata[]>} An array of function metadata.
 */
async function getFunctionDefinitionsForTool(sessionId) {
  return getSessionFuncsMetadata(sessionId);
}

/**
 * Returns the registry of available functions for a specific session.
 * @param {string} sessionId The unique identifier for the session.
 * @returns {Promise<Record<string, RegisteredFunction>>} An object mapping function names to their implementations.
 */
async function getAvailableFunctions(sessionId) {
  return getSessionFunctionRegistry(sessionId);
}

async function loadIntegrations(sessionId) {
  if (process.env.GITHUB_TOKEN) {
    logger.info(`Loading GitHub integration for session: ${sessionId}`);
    await loadGitHub(sessionId);
    logger.info(`Loading GitHub code review integration for session: ${sessionId}`);
    await loadCodeReviews(sessionId);
  }

  if (process.env.DOSA_API_KEY && process.env.DOSA_API_SECRET
        && process.env.DOSA_AUTH_TENANT_ID
        && process.env.DOSA_CLIENT_ID) {
    logger.info(`Loading DOSA/DLVA integration for session: ${sessionId}`);
    await loadDosa(sessionId);
  }
}

async function cleanupSession(sessionId) {
  const release = await registryMutex.acquire();
  try {
    availableFunctionsRegistry.delete(sessionId);
    funcsMetadata.delete(sessionId);
  } finally {
    release();
  }
  await cleanupCodeReviewSession(sessionId); // Clean up resources from codeReviews
  logger.info(`Cleaned up function registry for session: ${sessionId}`);
}

module.exports = {
  getAvailableFunctions,
  getFunctionDefinitionsForTool,
  loadIntegrations,
  cleanupSession,
};
