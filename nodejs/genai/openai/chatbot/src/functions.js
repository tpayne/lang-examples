const { Mutex } = require('async-mutex'); // Import Mutex for thread safety
const logger = require('./logger');

const {
  checkBranchExists,
  checkRepoExists,
  commitFiles,
  createBranch,
  createGithubPullRequest,
  createRepo,
  fetchRepoContentsRecursive,
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listGitHubActions,
  listPublicRepos,
  switchBranch,
} = require('./gitFunctions');

const {
  codeReviews,
  cleanupSession: cleanupCodeReviewSession, // Import cleanup for code reviews
} = require('./codeReviews');

const {
  getVehicleHistory,
} = require('./dosaFunctions');

const {
  generateGoogleMapsLink,
  planRoute,
} = require('./mappingFunctions');

const {
  saveCodeToFile,
} = require('./utilities');

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
 * @param {boolean} needSession - Session needed
 */
async function registerFunction(
  sessionId,
  name,
  func,
  params,
  description,
  parametersSchema,
  required,
  needSession = false,
) {
  const sessionRegistry = await getSessionFunctionRegistry(sessionId);
  const sessionFuncs = await getSessionFuncsMetadata(sessionId);

  const release = await registryMutex.acquire();
  try {
    if (sessionRegistry[name]) {
      logger.warn(
        `Function with name '${name}' already registered for session '${sessionId}'`
        + ' and will be reused.',
      );
    } else {
      sessionRegistry[name] = { func, params, needSession };

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
    }
  } finally {
    release();
  }
}

/* eslint-disable no-shadow */

async function loadCodeReviews(sessionId) {
  await registerFunction(
    sessionId,
    'file_review',
    codeReviews,
    ['username', 'repoName', 'repoPath'],
    'Review files in a given GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    ['username', 'repoName', 'repoPath'],
    true,
  );
}

async function loadDosa(sessionId) {
  await registerFunction(
    sessionId,
    'get_mot_history',
    // Removed sessionId from the anonymous function parameters
    (registrationNumber) => getVehicleHistory(sessionId, registrationNumber),
    ['registrationNumber'],
    'Get the MOT History for a vehicle.',
    {
      registrationNumber: { type: 'string', description: 'The Vehicle registration or VIN number.' },
    },
    ['registrationNumber'],
    true,
  );
}

/* eslint-enable no-shadow */

async function loadGitHub(sessionId) {
  await registerFunction(
    sessionId,
    'create_repo',
    createRepo,
    ['repoName', 'username', 'orgName', 'description', 'isPrivate'],
    'Create a GitHub repository under an organisation or user',
    {
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      username: { type: 'string', description: 'The username of the repository owner.' },
      description: { type: 'string', description: 'The description of the repository name (optional). Defaults if not provided' },
      isPrivate: { type: 'boolean', description: 'Is the repository private (true) or public (false) (optional). Defaults to public if not provided' },
    },
    ['repoName'],
  );

  await registerFunction(
    sessionId,
    'switch_branch',
    switchBranch,
    ['username', 'repoName', 'branchName'],
    'Switch a branch in a GitHub repository',
    {
      username: { type: 'string', description: 'The username of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The branch name to switch to.' },
    },
    ['username', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'save_code_to_file',
    saveCodeToFile,
    ['code', 'filename', 'directory'],
    'Save generated code to a local file',
    {
      code: { type: 'string', description: 'The generated code to save.' },
      filename: { type: 'string', description: 'The local filename to save the generated code to.' },
      directory: { type: 'string', description: 'The directory name that is used (optional). Defaults to /tmp/nodeapp/ if not provided' },
    },
    ['code', 'filename'],
  );

  await registerFunction(
    sessionId,
    'create_branch',
    createBranch,
    ['username', 'repoName', 'branchName', 'baseBranch'],
    'Create a new branch in a GitHub repository based on an existing branch',
    {
      username: { type: 'string', description: 'The username of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The name of the new branch to be created.' },
      baseBranch: { type: 'string', description: 'The name of the existing branch to base the new branch on (optional). Defaults to "main".' },
    },
    ['username', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'check_branch_exists',
    checkBranchExists,
    ['username', 'repoName', 'branchName'],
    'Check if a GitHub branch exists in a specified repository',
    {
      username: { type: 'string', description: 'The username or organization name of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
      branchName: { type: 'string', description: 'The name of the branch to check.' },
    },
    ['username', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'check_repo_exists',
    checkRepoExists,
    ['username', 'repoName'],
    'Check if a GitHub repository exists under a given user or organization',
    {
      username: { type: 'string', description: 'The username or organization name of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
    },
    ['username', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'commit_files',
    commitFiles,
    ['username', 'repoName', 'repoPath'],
    'Upload, push, load or commit files from the session temporary directory to a specified GitHub repository, maintaining directory structure.', // Updated description
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    ['username', 'repoName', 'repoPath'],
    true,
  );

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
    ['username', 'repoName', 'repoPath'],
    'Fetch or download the contents of a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    ['username', 'repoName', 'repoPath'],
    true,
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
 * Registers the Google Maps Directions API function with the function registry.
 * @param {string} sessionId The unique identifier for the session.
 */
async function loadMappingFunctions(sessionId) {
  await registerFunction(
    sessionId,
    'plan_route', // Function name for the AI tool
    planRoute, // The actual function to execute
    ['params'], // Parameters the function expects (wrapped in a single 'params' object)
    'Plans a route between multiple points using the Google Maps Directions API and returns the details in JSON format.', // Description for the AI
    { // JSON schema for the 'params' object
      params: {
        type: 'object',
        description: 'Parameters for the Google Maps Directions API request.',
        properties: {
          origin: { type: 'string', description: 'The starting point for the directions request.' },
          destination: { type: 'string', description: 'The ending point for the directions request.' },
          waypoints: {
            type: 'array',
            description: 'An array of intermediate locations to include in the route.',
            items: { type: 'string' },
            nullable: true, // Make waypoints optional
          },
          mode: {
            type: 'string',
            description: 'Specifies the mode of transport (e.g., "driving", "walking", "bicycling", "transit"). Defaults to "driving".',
            nullable: true, // Make optional
            enum: ['driving', 'walking', 'bicycling', 'transit'], // Add supported modes
          },
          language: { type: 'string', description: 'The language to use for the results.', nullable: true }, // Make optional
          units: {
            type: 'string',
            description: 'Specifies the unit system to use (e.g., "metric", "imperial"). Defaults to "metric".',
            nullable: true, // Make optional
            enum: ['metric', 'imperial'], // Add supported units
          },
          alternatives: { type: 'boolean', description: 'If true, more than one route may be returned.', nullable: true }, // Make optional
          avoid: {
            type: 'string',
            description: 'Indicates features to avoid (e.g., "tolls", "highways", "ferries", "indoor"). Can be a single value or multiple values separated by "|".',
            nullable: true, // Make optional
          },
          transit_mode: {
            type: 'string',
            description: 'Specifies the desired modes of transit (e.g., "bus", "subway", "train", "tram", "rail"). Can be multiple values separated by "|".',
            nullable: true, // Make optional
          },
          transit_routing_preference: {
            type: 'string',
            description: 'Specifies preferences for transit routes (e.g., "less_walking", "fewer_transfers").',
            nullable: true, // Make optional
            enum: ['less_walking', 'fewer_transfers'], // Add supported preferences
          },
          departure_time: { type: 'string', description: 'The desired time of departure. Can be a timestamp or "now".', nullable: true }, // Make optional
          arrival_time: { type: 'string', description: 'The desired time of arrival (for transit). Can be a timestamp.', nullable: true }, // Make optional
          traffic_model: {
            type: 'string',
            description: 'Specifies the assumptions to use when calculating time in traffic (e.g., "best_guess", "optimistic", "pessimistic").',
            nullable: true, // Make optional
            enum: ['best_guess', 'optimistic', 'pessimistic'], // Add supported models
          },
          optimizeWaypoints: { type: 'boolean', description: 'If true and waypoints are provided, the API will attempt to reorder the waypoints to minimize the total travel time.', nullable: true }, // Make optional
        },
        required: ['origin', 'destination'], // Only origin and destination are required
      },
    },
    ['params'], // Required parameters for the function call (the 'params' object itself)
    true, // needSession is true as the function signature includes sessionId
  );

  await registerFunction(
    sessionId,
    'generate_google_maps_link', // Function name for the AI tool
    generateGoogleMapsLink, // The actual function to execute
    ['params'], // Parameters the function expects (wrapped in a single 'params' object)
    'Generates an HTTP link to view a planned route on the Google Maps website using the original route parameters.', // Description for the AI
    { // JSON schema for the 'params' object for generating the link
      params: {
        type: 'object',
        description: 'Parameters used for the original route planning request.',
        properties: {
          origin: { type: 'string', description: 'The starting point for the directions request.' },
          destination: { type: 'string', description: 'The ending point for the directions request.' },
          waypoints: {
            type: 'array',
            description: 'An array of intermediate locations included in the route.',
            items: { type: 'string' },
            nullable: true, // Waypoints are optional for link generation
          },
          mode: {
            type: 'string',
            description: 'The mode of transport used for the route.',
            nullable: true, // Mode is optional for link generation
            enum: ['driving', 'walking', 'bicycling', 'transit'],
          },
          // Include other relevant parameters if you want the link to reflect them,
          // but keep it simple for basic link generation.
          // For this function, origin and destination are the most crucial.
        },
        required: ['origin', 'destination'], // Origin and destination are required to generate a meaningful link
      },
    },
    ['params'], // Required parameters for the function call (the 'params' object itself)
    false, // needSession is false as the generateGoogleMapsLink function does not use sessionId
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

  if (process.env.GOOGLE_MAPS_API_KEY) {
    logger.info(`Loading Google Maps integration for session: ${sessionId}`);
    await loadMappingFunctions(sessionId);
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
