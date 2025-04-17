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
 * Registry of available GitHub functions for AI.
 * @type {Record<string, RegisteredFunction>}
 */
const availableFunctionsRegistry = {};

/**
 * Metadata for GitHub functions as AI tools.
 * @type {FunctionMetadata[]}
 */
const funcs = [];

/**
 * Registers a new GitHub function for AI.
 * @param {string} name - The unique name of the function (used as the key).
 * @param {Function} func - The JavaScript function to execute.
 * @param {string[]} params - An array of parameter names the function expects.
 * @param {string} description - A description of what the function does.
 * @param {object} parametersSchema - The JSON schema for the function's parameters.
 * @param {string[]} required - An array of required parameter names.
 */
function registerFunction(name, func, params, description, parametersSchema, required) {
  if (availableFunctionsRegistry[name]) {
    logger.warn(`Function with name '${name}' already registered and will be overwritten.`);
  }
  availableFunctionsRegistry[name] = { func, params };

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
  funcs.push(functionMetadata);
}

function loadCodeReviews() {
  registerFunction(
    'perform_code_review',
    codeReviews,
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

function loadDosa() {
  registerFunction(
    'get_mot_history',
    getVehicleHistory,
    ['registrationNumber'],
    'Get the MOT History for a vehicle.',
    {
      registrationNumber: { type: 'string', description: 'The Vehicle registration or VIN number.' },
    },
    ['registrationNumber'],
  );
}

function loadGitHub() {
  // Register the existing functions
  registerFunction(
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

  registerFunction(
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

  registerFunction(
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

  registerFunction(
    'list_public_repos',
    listPublicRepos,
    ['username'],
    'Lists public repositories for a given GitHub username.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
    },
    ['username'],
  );

  registerFunction(
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

  registerFunction(
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

  registerFunction(
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

/* eslint-enable max-len */

// Define the getFunctionDefinitionsForTool function
function getFunctionDefinitionsForTool() {
  return funcs;
}

function getAvailableFunctions() {
  return availableFunctionsRegistry;
}

if (process.env.GITHUB_TOKEN) {
  logger.info('Loading GitHub integration...');
  loadGitHub();
  logger.info('Loading GitHub code review integration...');
  loadCodeReviews();
}

if (process.env.DOSA_API_KEY && process.env.DOSA_API_SECRET
  && process.env.DOSA_AUTH_TENANT_ID
  && process.env.DOSA_CLIENT_ID) {
  logger.info('Loading DOSA/DLVA integration...');
  loadDosa();
}

module.exports = {
  getAvailableFunctions,
  getFunctionDefinitionsForTool, // Renamed function
};
