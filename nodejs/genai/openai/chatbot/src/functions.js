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
  checkAdoBranchExists,
  checkAdoRepoExists,
  commitAdoFiles,
  createAdoBranch,
  createAdoPullRequest,
  createAdoRepo,
  fetchAdoRepoContentsRecursive,
  listAdoBranches,
  listAdoCommitHistory,
  listAdoDirectoryContents,
  listAdoRepos,
  switchAdoBranch,
} = require('./adoFunctions'); // Assuming gitFunctions.js now contains the Ado functions

const {
  codeReviews,
  adoCodeReviews,
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

const {
  createKubernetesResource,
  deleteKubernetesResource,
  getKubernetesDeploymentDetails,
  getKubernetesNodeDetails,
  getKubernetesPodDetails,
  getKubernetesPodLogs,
  getKubernetesSecretDetails,
  getKubernetesServiceDetails,
  getKubernetesVersion,
  listKubernetesConfigMaps,
  listKubernetesCronJobs,
  listKubernetesDaemonSets,
  listKubernetesDeployments,
  listKubernetesEvents,
  listKubernetesIngresses,
  listKubernetesJobs,
  listKubernetesNamespaces,
  listKubernetesNodes,
  listKubernetesPersistentVolumeClaims,
  listKubernetesPersistentVolumes,
  listKubernetesPods,
  listKubernetesReplicaSets,
  listKubernetesSecrets,
  listKubernetesServices,
  listKubernetesStatefulSets,
  scaleKubernetesDeployment,
  updateKubernetesResource,
} = require('./k8s');

const {
  getDockerImageTags,
  searchDockerImages,
} = require('./dockerHub'); // Import the new dockerhub.js module

const {
  connectToDatabase,
  dumpDatabaseStructure,
  selectDatabaseData,
  listDatabaseSchemas,
  listSchemaObjects,
  runAdhocSql, // Import the new runAdhocSql function
} = require('./dbfuncs'); // Import the new databaseUtils.js module

const {
  collectBasicSystemInfo,
  collectDetailedSystemInfo,
  collectProcessInfo,
  collectAllServicesInfo,
  testSshConnect,
} = require('./getInfo'); // Import the new system-info-collector.js module

const {
  scanNetworkForSSH,
} = require('./sshscan'); // Import the SSH scanning function

const {
  createAdoPipeline,
  deleteAdoPipeline,
  getAdoPipelineRunLogs,
  listAdoPipelineRuns,
  listAdoPipelines,
  listAdoProjects,
  runAdoPipeline,
} = require('./adoPipelines'); // Import the ADO pipeline functions

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
 * @param {string} sessionId The unique name of the session.
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
      sessionRegistry[name] = {
        func, params, needSession, required,
      };

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
    ['username', 'repoName', 'repoDirName', 'branchName'],
    'Review files in a given GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The GitHub repository path to start download at.' },
      branchName: { type: 'string', description: 'The name of the branch to review.' },
    },
    ['username', 'repoName', 'repoDirName'],
    true,
  );
}

async function loadAdoCodeReviews(sessionId) {
  await registerFunction(
    sessionId,
    'ado_file_review',
    adoCodeReviews,
    ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    'Review files in a given Azure DevOps repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The Azure DevOps repository name.' },
      repoDirName: { type: 'string', description: 'The Azure DevOps repository path to start download at.' },
      branchName: { type: 'string', description: 'The name of the branch to review.' },
    },
    ['organization', 'project', 'repoName', 'repoDirName'],
    true,
  );
}

async function loadDosa(sessionId) {
  await registerFunction(
    sessionId,
    'get_mot_history',
    // Removed sessionId from the anonymous function parameters
    getVehicleHistory,
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
    ['code', 'filename', 'repoDirName'],
    'Save generated code or changes made by the bot to a local file',
    {
      code: { type: 'string', description: 'The generated code or changes to save.' },
      filename: { type: 'string', description: 'The local filename to save the changes to.' },
      repoDirName: { type: 'string', description: 'The directory name that is used (optional).' },
    },
    ['code', 'filename', 'repoDirName'],
    true,
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
    ['username', 'repoName', 'repoDirName', 'branchName'],
    'Upload, push, load or commit files from the session temporary directory to a specified GitHub repository, maintaining directory structure.', // Updated description if needed
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The base directory in the GitHub repository to commit files into.' }, // Changed name and description
      branchName: { type: 'string', description: 'The name of the branch to commit to.' }, // Clarified description
    },
    ['username', 'repoName', 'repoDirName'], // Changed 'repoDirName' to 'repoDirName' in required params
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
    ['username', 'repoName', 'repoDirName'],
    'Fetch or download the contents of a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    ['username', 'repoName', 'repoDirName'],
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
    ['username', 'repoName', 'repoDirName'],
    'Lists commit history for a file in a GitHub repository.',
    {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The file or directory path.' },
    },
    ['username', 'repoName', 'repoDirName'],
  );

  await registerFunction(
    sessionId,
    'list_directory_contents', // Tool name
    listDirectoryContents, // Function implementation
    ['username', 'repoName', 'branchName', 'repoDirName', 'recursive'],
    'Lists the contents of a directory in a GitHub repository on a specific branch. Defaults to the root and recursive scan.', // Updated description
    { // Parameter types and descriptions for the tool
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      branchName: { type: 'string', description: 'The name of the branch to list contents from (optional). Defaults to "main" if not provided.' }, // Added branch parameter definition
      repoDirName: { type: 'string', description: 'The directory path within the repository (optional). Defaults to the repository root if not provided.' }, // Clarified description
      recursive: { type: 'boolean', description: 'Perform a recursive scan or not (optional). Defaults to true if not provided.' }, // Clarified description
    },
    ['username', 'repoName'], // Required parameters for the tool (repoDirName, recursive, branch are optional via defaults)
  );
}

/**
 * Registers the Azure DevOps (ADO) Git functions with the function registry.
 * @param {string} sessionId The unique identifier for the session.
 */
async function loadAdoIntegration(sessionId) {
  await registerFunction(
    sessionId,
    'create_ado_repo',
    createAdoRepo,
    ['organization', 'project', 'repoName', 'isPublic'],
    'Create an Azure DevOps (ADO) Git repository under a specified organization and project.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to be created.' },
      isPublic: { type: 'boolean', description: 'Is the repository public (true) or private (false) (optional). Defaults to private if not provided.' },
    },
    ['organization', 'project', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'switch_ado_branch',
    switchAdoBranch,
    ['organization', 'project', 'repoName', 'branchName'],
    'Switch the default branch in an Azure DevOps (ADO) Git repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository.' },
      branchName: { type: 'string', description: 'The branch name to switch to as the new default.' },
    },
    ['organization', 'project', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'commit_ado_files',
    commitAdoFiles,
    ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    'Upload, push, load or commit files from the session temporary directory to a specified Azure DevOps (ADO) Git repository, maintaining directory structure.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The base directory in the Azure DevOps repository to commit files into (optional). Defaults to the repository root if not provided.' },
      branchName: { type: 'string', description: 'The name of the branch to commit to (optional). Defaults to the repository\'s default branch if not provided.' },
    },
    ['organization', 'project', 'repoName'],
    true,
  );

  await registerFunction(
    sessionId,
    'create_ado_pull_request',
    createAdoPullRequest,
    ['organization', 'project', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'],
    'Create a pull request on a given Azure DevOps (ADO) Git repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      title: { type: 'string', description: 'The Pull Request title.' },
      sourceBranch: { type: 'string', description: 'The source branch name.' },
      targetBranch: { type: 'string', description: 'The target branch name.' },
      body: { type: 'string', description: 'The description or body of the pull request (optional).' },
    },
    ['organization', 'project', 'repoName', 'title', 'sourceBranch', 'targetBranch'],
  );

  await registerFunction(
    sessionId,
    'fetch_ado_repo_contents',
    fetchAdoRepoContentsRecursive,
    ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    'Fetch or download the contents of an Azure DevOps (ADO) Git repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The Azure DevOps repository path to start download at (optional). Defaults to the repository root if not provided.' },
      branchName: { type: 'string', description: 'The name of the branch to fetch contents from (optional). Defaults to the repository\'s default branch if not provided.' },
    },
    ['organization', 'project', 'repoName'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_ado_pipelines',
    listAdoPipelines,
    ['organization', 'project', 'repoName', 'statusFilter'],
    'Lists Azure DevOps (ADO) Pipelines (builds) running or queued in a specified repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      statusFilter: { type: 'string', description: 'The status to filter pipelines by (e.g., "inProgress", "queued", "completed", "failed") (optional). Defaults to "inProgress" if not provided.' },
    },
    ['organization', 'project', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'list_ado_repos',
    listAdoRepos,
    ['organization', 'project'],
    'Lists repositories for a given Azure DevOps (ADO) organization and project.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
    },
    ['organization', 'project'],
  );

  await registerFunction(
    sessionId,
    'list_ado_branches',
    listAdoBranches,
    ['organization', 'project', 'repoName'],
    'Lists branches for a given Azure DevOps (ADO) Git repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    ['organization', 'project', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'list_ado_commit_history',
    listAdoCommitHistory,
    ['organization', 'project', 'repoName', 'repoDirName'],
    'Lists commit history for a file or directory in an Azure DevOps (ADO) Git repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The file or directory path within the repository.' },
    },
    ['organization', 'project', 'repoName', 'repoDirName'],
  );

  await registerFunction(
    sessionId,
    'list_ado_directory_contents',
    listAdoDirectoryContents,
    ['organization', 'project', 'repoName', 'branchName', 'repoDirName', 'recursive'],
    'Lists the contents of a directory in an Azure DevOps (ADO) Git repository on a specific branch. Defaults to the root and recursive scan.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      branchName: { type: 'string', description: 'The name of the branch to list contents from (optional). Defaults to the repository\'s default branch if not provided.' },
      repoDirName: { type: 'string', description: 'The directory path within the repository (optional). Defaults to the repository root if not provided.' },
      recursive: { type: 'boolean', description: 'Perform a recursive scan or not (optional). Defaults to true if not provided.' },
    },
    ['organization', 'project', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'check_ado_branch_exists',
    checkAdoBranchExists,
    ['organization', 'project', 'repoName', 'branchName'],
    'Check if an Azure DevOps (ADO) Git branch exists in a specified repository.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
      branchName: { type: 'string', description: 'The name of the branch to check.' },
    },
    ['organization', 'project', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'check_ado_repo_exists',
    checkAdoRepoExists,
    ['organization', 'project', 'repoName'],
    'Check if an Azure DevOps (ADO) Git repository exists under a given organization and project.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
    },
    ['organization', 'project', 'repoName'],
  );

  await registerFunction(
    sessionId,
    'create_ado_branch',
    createAdoBranch,
    ['organization', 'project', 'repoName', 'branchName', 'baseBranch'],
    'Create a new branch in an Azure DevOps (ADO) Git repository based on an existing branch.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The name of the new branch to be created.' },
      baseBranch: { type: 'string', description: 'The name of the existing branch to base the new branch on (optional). Defaults to the repository\'s default branch.' },
    },
    ['organization', 'project', 'repoName', 'branchName'],
  );

  await registerFunction(
    sessionId,
    'list_ado_projects',
    listAdoProjects,
    ['organization'],
    'Fetches a list of Azure DevOps projects.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
    },
    ['organization'],
  );

  // New function: create_ado_pipeline
  await registerFunction(
    sessionId,
    'create_ado_pipeline',
    createAdoPipeline,
    ['organization', 'project', 'repoName', 'yamlPath'],
    'Creates a new Azure DevOps pipeline (build definition).',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      yamlPath: { type: 'string', description: 'The path to the YAML file defining the pipeline (default is "azure-pipelines.yml".' },
    },
    ['organization', 'project', 'repoName', 'yamlPath'],
  );

  // New function: run_ado_pipeline
  await registerFunction(
    sessionId,
    'run_ado_pipeline',
    runAdoPipeline,
    ['organization', 'project', 'pipelineId', 'runParameters'],
    'Triggers a new run for an Azure DevOps pipeline.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline to run.' },
      runParameters: { type: 'object', description: 'Optional parameters for the pipeline run (e.g., variables, branch).' },
    },
    ['organization', 'project', 'pipelineId'],
  );

  // New function: get_ado_pipeline_run_logs
  await registerFunction(
    sessionId,
    'get_ado_pipeline_run_logs',
    getAdoPipelineRunLogs,
    ['organization', 'project', 'pipelineId', 'runId'],
    'Retrieves logs for a specific pipeline run in Azure DevOps. This function retrieves a list of log entries; to get the full content of a specific log file, a subsequent call to the specific log URL might be needed.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline.' },
      runId: { type: 'number', description: 'The ID of the pipeline run.' },
    },
    ['organization', 'project', 'pipelineId', 'runId'],
  );

  // New function: list_ado_pipeline_runs
  await registerFunction(
    sessionId,
    'list_ado_pipeline_runs',
    listAdoPipelineRuns,
    ['organization', 'project', 'pipelineId'],
    'Fetches a list of runs for a specific Azure DevOps pipeline.',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline.' },
    },
    ['organization', 'project', 'pipelineId'],
  );

  // New function: delete_ado_pipeline
  await registerFunction(
    sessionId,
    'delete_ado_pipeline',
    deleteAdoPipeline,
    ['organization', 'project', 'pipelineId'],
    'Deletes an Azure DevOps pipeline (build definition).',
    {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline to delete.' },
    },
    ['organization', 'project', 'pipelineId'],
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
    'generate_Maps_link', // Function name for the AI tool
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
 * Loads Kubernetes functions into the registry if KUBERNETES_API_ENDPOINT and KUBERNETES_BEARER_TOKEN are set.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadKubernetes(sessionId) {
  // Directly register K8s functions without the helper
  await registerFunction(
    sessionId,
    'get_kubernetes_version',
    getKubernetesVersion,
    [], // No direct parameters
    'List or get all the Kubernetes version information for the connected Kubernetes cluster.',
    {}, // Empty parameter schema
    [], // No required parameters
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_namespaces',
    listKubernetesNamespaces,
    [], // No direct parameters
    'List or get all the Kubernetes namespaces in the cluster, returning their detailed status and metadata.',
    {}, // Empty parameter schema
    [], // No required parameters
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'create_kubernetes_resource',
    createKubernetesResource, // This function needs to be imported from k8s.js
    ['resourceType', 'resourceBody', 'namespace'],
    'Create a Kubernetes resource from a provided YAML or JSON body.',
    {
      resourceType: { type: 'string', description: 'The type of the resource to create (e.g., "pods", "deployments", "services", "namespaces").' },
      resourceBody: { type: 'string', description: 'The YAML or JSON string representation of the Kubernetes resource to create. This should be auto-generated by the chatbot based on the description given' },
      namespace: { type: 'string', description: 'Optional: The namespace in which to create the resource. Not required for cluster-scoped resources like Namespaces or PersistentVolumes. The default will be "default" if not provided.' },
    },
    ['resourceType', 'resourceBody'],
    true,
  );

  await registerFunction(
    sessionId,
    'delete_kubernetes_resource', // New function
    deleteKubernetesResource,
    ['resourceType', 'name', 'namespace'],
    'Delete a specified Kubernetes resource (e.g., Pod, Deployment, Service) by its name from a given namespace.',
    {
      resourceType: { type: 'string', description: 'The type of the resource to delete (e.g., "pods", "deployments", "services", "namespaces").' },
      name: { type: 'string', description: 'The name of the resource to delete.' },
      namespace: { type: 'string', description: 'The namespace the resource resides in. Required for namespaced resources. Not used for cluster-scoped resources like PersistentVolumes or Namespaces (when deleting the namespace itself).' },
    },
    ['resourceType', 'name'],
    true,
  );

  await registerFunction(
    sessionId,
    'update_kubernetes_resource',
    updateKubernetesResource, // This function needs to be imported from k8s.js
    ['resourceType', 'name', 'resourceBody', 'namespace'],
    'Update an existing Kubernetes resource with a provided YAML or JSON body.',
    {
      resourceType: { type: 'string', description: 'The type of the resource to update (e.g., "pods", "deployments", "services", "namespaces").' },
      name: { type: 'string', description: 'The name of the resource to update.' },
      resourceBody: { type: 'string', description: 'The YAML or JSON string representation of the Kubernetes resource with the updated configuration. This should be auto-generated by the chatbot based on the description given' },
      namespace: { type: 'string', description: 'Optional: The namespace in which to create the resource. Not required for cluster-scoped resources like Namespaces or PersistentVolumes. The default will be "default" if not provided.' },
    },
    ['resourceType', 'name', 'resourceBody'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_deployments',
    listKubernetesDeployments,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes deployments across all namespaces or within a specified namespace, returning their detailed status, replicas, and associated metadata.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list deployments from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_deployment_details', // New function
    getKubernetesDeploymentDetails,
    ['deploymentName', 'namespace'],
    'Get detailed information about a specific Kubernetes Deployment by its name within a given namespace.',
    {
      deploymentName: { type: 'string', description: 'The name of the deployment to get details for.' },
      namespace: { type: 'string', description: 'The namespace the deployment resides in.' },
    },
    ['deploymentName', 'namespace'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_services',
    listKubernetesServices,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes services across all namespaces or within a specified namespace, returning their detailed status, cluster IPs, ports, and selectors.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list services from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_service_details', // New function
    getKubernetesServiceDetails,
    ['serviceName', 'namespace'],
    'Get detailed information about a specific Kubernetes Service by its name within a given namespace.',
    {
      serviceName: { type: 'string', description: 'The name of the service to get details for.' },
      namespace: { type: 'string', description: 'The namespace the service resides in.' },
    },
    ['serviceName', 'namespace'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_pods',
    listKubernetesPods,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes pods across all namespaces or within a specified namespace, returning their detailed status, node assignments, and container information.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list pods from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_pod_details', // New function
    getKubernetesPodDetails,
    ['podName', 'namespace'],
    'Get detailed information about a specific Kubernetes Pod by its name within a given namespace. This is ONLY for Kubernetes use, not for host machine details',
    {
      podName: { type: 'string', description: 'The name of the pod to get details for.' },
      namespace: { type: 'string', description: 'The namespace the pod resides in.' },
    },
    ['podName', 'namespace'],
    true,
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_pod_logs',
    getKubernetesPodLogs,
    ['podName', 'namespace'],
    'Get the logs for a specific pod in a given namespace.',
    {
      podName: { type: 'string', description: 'The name of the pod to get logs from.' },
      namespace: { type: 'string', description: 'The namespace the pod resides in.' },
    },
    ['podName', 'namespace'], // Both podName and namespace are required
    true,
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_node_details',
    getKubernetesNodeDetails, // This function needs to be imported from k8s.js
    ['nodeName'],
    'Get detailed information about a specific Kubernetes Node by its name.',
    {
      nodeName: { type: 'string', description: 'The name of the node to get details for.' },
    },
    ['nodeName'],
    true,
  );

  await registerFunction(
    sessionId,
    'get_kubernetes_secret_details',
    getKubernetesSecretDetails, // This function needs to be imported from k8s.js
    ['secretName', 'namespace'],
    'Get detailed information about a specific Kubernetes Secret by its name within a given namespace.',
    {
      secretName: { type: 'string', description: 'The name of the secret to get details for.' },
      namespace: { type: 'string', description: 'The namespace the secret resides in.' },
    },
    ['secretName', 'namespace'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_events',
    listKubernetesEvents, // This function needs to be imported from k8s.js
    ['namespace'],
    'List or get all Kubernetes Events across all namespaces or within a specified namespace, returning their detailed status and associated resources.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list events from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_nodes',
    listKubernetesNodes, // This function needs to be imported from k8s.js
    [], // No direct parameters, nodes are cluster-scoped
    'List or get all Kubernetes Nodes, returning their detailed status, capacity, and allocatable resources.',
    {}, // Empty parameter schema
    [], // No required parameters
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_secrets',
    listKubernetesSecrets, // This function needs to be imported from k8s.js
    ['namespace'],
    'List or get all Kubernetes Secrets across all namespaces or within a specified namespace, returning their detailed data (excluding sensitive content).',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list secrets from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true,
  );

  await registerFunction(
    sessionId,
    'scale_kubernetes_deployment', // New function
    scaleKubernetesDeployment,
    ['deploymentName', 'namespace', 'replicas'],
    'Scale a specified Kubernetes Deployment to a desired number of replicas.',
    {
      deploymentName: { type: 'string', description: 'The name of the deployment to scale.' },
      namespace: { type: 'string', description: 'The namespace the deployment resides in.' },
      replicas: { type: 'number', description: 'The desired number of replicas for the deployment.' },
    },
    ['deploymentName', 'namespace', 'replicas'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_replicasets',
    listKubernetesReplicaSets,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes ReplicaSets across all namespaces or within a specified namespace, returning their detailed status and replica counts.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list ReplicaSets from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_daemonsets',
    listKubernetesDaemonSets,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes DaemonSets across all namespaces or within a specified namespace, returning their detailed status.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list DaemonSets from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_statefulsets',
    listKubernetesStatefulSets,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes StatefulSets across all namespaces or within a specified namespace, returning their detailed status and replica counts.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list StatefulSets from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_ingresses',
    listKubernetesIngresses,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes Ingresses across all namespaces or within a specified namespace, returning their detailed rules and backend services.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list Ingresses from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_configmaps',
    listKubernetesConfigMaps,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes ConfigMaps across all namespaces or within a specified namespace, returning their detailed data.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list ConfigMaps from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_persistent_volumes',
    listKubernetesPersistentVolumes,
    [], // No direct parameters, PVs are cluster-scoped
    'List or get all the Kubernetes PersistentVolumes, returning their detailed status, capacity, and access modes.',
    {}, // Empty parameter schema
    [], // No required parameters
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_persistent_volume_claims',
    listKubernetesPersistentVolumeClaims,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes PersistentVolumeClaims across all namespaces or within a specified namespace, returning their detailed status and volume bindings.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list PersistentVolumeClaims from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_jobs',
    listKubernetesJobs,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes Jobs across all namespaces or within a specified namespace, returning their detailed status and completion information.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list Jobs from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );

  await registerFunction(
    sessionId,
    'list_kubernetes_cronjobs',
    listKubernetesCronJobs,
    ['namespace'], // Added namespace parameter
    'List or get all the Kubernetes CronJobs across all namespaces or within a specified namespace, returning their detailed status and schedule.',
    {
      namespace: { type: 'string', description: 'Optional: The namespace to list CronJobs from. If not provided, lists from all namespaces.' },
    },
    [], // No required parameters, namespace is optional
    true, // needSession is true
  );
}

async function loadDockerHub(sessionId) {
  await registerFunction(
    sessionId,
    'search_docker_images',
    searchDockerImages,
    ['searchTerm', 'isPrivate', 'username'],
    'Search for Docker images on Docker Hub, supporting both public and private repositories. For private searches, the Docker Hub username and password must be configured as environment variables.',
    {
      searchTerm: { type: 'string', description: 'The term to search for (e.g., "ubuntu", "my-private-repo/my-image").' },
      isPrivate: { type: 'boolean', description: 'Set to true to search private repositories of the configured Docker Hub user. Defaults to false (public search).' },
      username: { type: 'string', description: 'Optional: Docker Hub username if searching private repos. Defaults to DOCKERHUB_USERNAME env var if not provided and isPrivate is true.' },
    },
    ['searchTerm'], // Only searchTerm is strictly required for any search
    true,
  );

  await registerFunction(
    sessionId,
    'get_docker_tags',
    getDockerImageTags,
    ['imageName'],
    'For a given Docker image name, get all the details of its tags.',
    {
      imageName: { type: 'string', description: 'The Docker image name to get tags for (e.g., "latest", "my-private-repo/my-image").' },
    },
    ['imageName'],
  );
}

/**
 * Loads database utility functions into the registry if DATABASE_URI is set.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadDatabaseFunctions(sessionId) {
  await registerFunction(
    sessionId,
    'connect_database',
    connectToDatabase,
    ['uri'],
    'Connects to a database using a JDBC-like URI. This function establishes a connection to the specified database and returns a client object for further operations.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection (e.g., "jdbc:postgresql://host:port/database?user=...").' },
    },
    ['uri'],
    true,
  );

  await registerFunction(
    sessionId,
    'dump_database_structure',
    dumpDatabaseStructure,
    ['uri'],
    'Dumps the structure (tables, views, columns) of a database in JSON format. Requires a JDBC-like URI to connect.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
    },
    ['uri'],
    true,
  );

  await registerFunction(
    sessionId,
    'select_database_data',
    selectDatabaseData,
    ['uri', 'tableNameOrViewName', 'percentage'],
    'Selects an optional percentage of data from a specified table or view in a database, returning the results in JSON format including column names. Defaults to 10% if percentage is not specified.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      tableNameOrViewName: { type: 'string', description: 'The name of the table or view to select data from.' },
      percentage: { type: 'number', description: 'Optional: The percentage of data to select (0-100). Defaults to 10% if not provided.' },
    },
    ['uri', 'tableNameOrViewName'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_database_schemas',
    listDatabaseSchemas,
    ['uri'],
    'Lists all schemas available in the connected database.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
    },
    ['uri'],
    true,
  );

  await registerFunction(
    sessionId,
    'list_schema_objects',
    listSchemaObjects,
    ['uri', 'schemaName', 'objectTypes'],
    'Lists objects (tables, views, indexes, constraints) owned by a specific schema in a database. The type of objects to list can be specified, defaulting to all if not provided.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      schemaName: { type: 'string', description: 'The name of the schema to list objects from.' },
      objectTypes: {
        type: 'array',
        items: { type: 'string', enum: ['tables', 'views', 'indexes', 'constraints'] },
        description: 'Optional: An array of object types to list (e.g., ["tables", "views"]). Defaults to all types if not provided.',
      },
    },
    ['uri', 'schemaName'],
    true,
  );

  // Register the new runAdhocSql function
  await registerFunction(
    sessionId,
    'run_adhoc_sql',
    runAdhocSql,
    ['uri', 'sqlQuery'],
    'Executes any arbitrary SQL query against a connected relational database. This includes DML (INSERT, UPDATE, DELETE, SELECT) and DDL (CREATE, ALTER, DROP, etc.) statements, as well as stored procedure calls, triggers, and other advanced SQL commands. Returns query results for SELECT statements and affected rows for DML/DDL statements.',
    {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      sqlQuery: { type: 'string', description: 'The free-text SQL query to execute.' },
    },
    ['uri', 'sqlQuery'],
    true,
  );
}

/**
 * Loads system information functions into the registry.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadSystemInfoFunctions(sessionId) {
  await registerFunction(
    sessionId,
    'scan_network_for_ssh',
    scanNetworkForSSH,
    ['baseIp', 'startRange', 'endRange', 'port', 'timeout'],
    'Scans a network range for hosts with SSH (port 22 by default) open. Returns a list of reachable SSH targets in the format "ip:port". Useful for discovering available SSH endpoints on a subnet.',
    {
      baseIp: {
        type: 'string',
        description: 'The base IP address of the subnet to scan (e.g., "192.168.1").',
      },
      startRange: {
        type: 'number',
        description: 'The starting value for the last octet in the IP range (default: 1).',
      },
      endRange: {
        type: 'number',
        description: 'The ending value for the last octet in the IP range (default: 254).',
      },
      port: {
        type: 'number',
        description: 'The port to scan for SSH (default: 22).',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds for each connection attempt (default: 1000).',
      },
    },
    [], // Only baseIp is strictly required, others have defaults
    true, // needsSession is true
  );

  await registerFunction(
    sessionId,
    'collect_basic_system_info',
    collectBasicSystemInfo,
    // Updated parameter list to use a single sshTarget string
    ['sshTarget'],
    'Collects basic host machine information, including OS, CPU, memory and hardware details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    {
      // Updated parameter schema for the single sshTarget string
      sshTarget: {
        type: 'string',
        description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
      },
    },
    [], // sshTarget is optional
    true, // needsSession is true
  );

  await registerFunction(
    sessionId,
    'collect_detailed_system_info',
    collectDetailedSystemInfo,
    // Updated parameter list to use a single sshTarget string
    ['sshTarget'],
    'Collects additional host machine information, including disk, kernal and network socket details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    {
      // Updated parameter schema for the single sshTarget string
      sshTarget: {
        type: 'string',
        description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
      },
    },
    [], // sshTarget is optional
    true, // needsSession is true
  );

  await registerFunction(
    sessionId,
    'test_ssh_connect',
    testSshConnect,
    // Updated parameter list to use a single sshTarget string
    ['sshTarget'],
    'Perform a test connection only to a remote host via SSH, with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found. Returns a success message if works.',
    {
      // Updated parameter schema for the single sshTarget string
      sshTarget: {
        type: 'string',
        description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
      },
    },
    [], // sshTarget is optional
    true, // needsSession is true
  );

  await registerFunction(
    sessionId,
    'collect_system_process_info',
    collectProcessInfo,
    // Updated parameter list to use a single sshTarget string
    ['sshTarget'],
    'Collects comprehensive host machine process information. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    {
      // Updated parameter schema for the single sshTarget string
      sshTarget: {
        type: 'string',
        description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
      },
    },
    [], // sshTarget is optional
    true, // needsSession is true
  );

  await registerFunction(
    sessionId,
    'collect_system_service_info',
    collectAllServicesInfo,
    // Updated parameter list to use a single sshTarget string
    ['sshTarget'],
    'Collects comprehensive host machine network services, identified databases/services and service details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    {
      // Updated parameter schema for the single sshTarget string
      sshTarget: {
        type: 'string',
        description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
      },
    },
    [], // sshTarget is optional
    true, // needsSession is true
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

  // New ADO integration loading
  if (process.env.AZURE_DEVOPS_PAT) {
    logger.info(`Loading Azure DevOps (ADO) integration for session: ${sessionId}`);
    await loadAdoIntegration(sessionId);
    logger.info(`Loading Azure DevOps (ADO) code review integration for session: ${sessionId}`);
    await loadAdoCodeReviews(sessionId);
  } else {
    logger.info(`Azure DevOps (ADO) integration not loaded for session: ${sessionId}. AZURE_DEVOPS_PAT not set.`);
  }

  if (process.env.DOSA_API_KEY && process.env.DOSA_API_SECRET
        && process.env.DOSA_AUTH_TENANT_ID
        && process.env.DOSA_CLIENT_ID) {
    logger.info(`Loading DOSA/DLVA integration for session: ${sessionId}`);
    await loadDosa(sessionId);
  }

  if (process.env.MAPS_API_KEY) {
    logger.info(`Loading Google Maps integration for session: ${sessionId}`);
    await loadMappingFunctions(sessionId);
  }

  if (process.env.KUBERNETES_API_ENDPOINT && process.env.KUBERNETES_BEARER_TOKEN) {
    logger.info(`Loading Kubernetes integration for session: ${sessionId}`);
    await loadKubernetes(sessionId);
    await loadDockerHub(sessionId);
  } else {
    logger.info(`Kubernetes integration not loaded for session: ${sessionId}. KUBERNETES_API_ENDPOINT or KUBERNETES_BEARER_TOKEN not set.`);
  }

  // Load Database integration
  if (process.env.DATABASE_URI) {
    logger.info(`Loading Database integration for session: ${sessionId}`);
    await loadDatabaseFunctions(sessionId);
  } else {
    logger.info(`Database integration not loaded for session: ${sessionId}. DATABASE_URI not set.`);
  }

  // Load System Info integration
  logger.info(`Loading System Information integration for session: ${sessionId}`);
  await loadSystemInfoFunctions(sessionId);
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
