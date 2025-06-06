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

// Import Terraform Cloud API functions
const {
  listTerraformWorkspaces,
  getTerraformWorkspaceDetails,
  createTerraformWorkspace,
  updateTerraformWorkspace,
  deleteTerraformWorkspace,
  createTerraformRun,
  createTerraformConfigurationVersion,
  uploadTerraformConfiguration,
  applyTerraformRun,
  discardTerraformRun,
  getTerraformRunDetails,
  terraformApply,
  terraformPlan,
  terraformDestroy,
  terraformRefresh,
} = require('./terraform'); // Import the terraform.js module for Cloud API

// Import Terraform CLI functions
const {
  checkTerraformCliExists,
  runTerraformCliWorkflow,
  setCloudContext, // Import the new setCloudContext function
} = require('./terraformCli'); // Import the new terraform-cli.js module

const {
  runTerraformWorkflow,
} = require('./terraformWorkflow'); // Import the Terraform CLI workflow function

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
    'Get detailed information about a specific Kubernetes Pod by its name within a given namespace.',
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
 * Loads the comprehensive Terraform workflow function into the registry.
 * This function handles saving Terraform files, archiving them, and then
 * initiating a plan or apply operation via Terraform Cloud.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadTerraformWorkflow(sessionId) {
  await registerFunction(
    sessionId,
    'run_terraform_workflow',
    runTerraformWorkflow,
    ['organizationName', 'workspaceName', 'terraformFiles', 'action', 'projectDirectoryName', 'message'],
    'Orchestrates a full Terraform workflow: saves provided Terraform code to a temporary directory, creates a .tar.gz archive, uploads it to Terraform Cloud, and then initiates either a plan or apply operation.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the Terraform Cloud workspace.' },
      terraformFiles: {
        type: 'string', // Will be a JSON string of an object
        description: 'A JSON string representing an object where keys are filenames (e.g., "main.tf", "variables.tf") and values are their HCL/JSON content. Example: \'{"main.tf": "resource \\"aws_s3_bucket\\" \\"example\\" { bucket = \\"my-bucket\\" }", "variables.tf": "variable \\"region\\" { default = \\"us-east-1\\" }"}\'',
      },
      action: {
        type: 'string',
        description: 'The desired Terraform action to perform ("plan" or "apply").',
        enum: ['plan', 'apply'],
      },
      projectDirectoryName: { type: 'string', description: 'Optional: A subdirectory name within the session\'s temporary directory to store the Terraform files. Defaults to "terraform-project".' },
      message: { type: 'string', description: 'Optional: A message for the Terraform run in Terraform Cloud. Defaults to "Triggered by API [action]".' },
    },
    ['organizationName', 'workspaceName', 'terraformFiles', 'action'],
    true, // needSession is true
  );
}

/**
 * Loads Terraform Cloud API functions into the registry if TERRAFORM_API_ENDPOINT and TERRAFORM_API_TOKEN are set.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadTerraform(sessionId) {
  await loadTerraformWorkflow();

  await registerFunction(
    sessionId,
    'list_terraform_workspaces',
    listTerraformWorkspaces,
    ['organizationName'],
    'List all workspaces in a given Terraform Cloud/Enterprise organization.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
    },
    ['organizationName'],
    true,
  );

  await registerFunction(
    sessionId,
    'get_terraform_workspace_details',
    getTerraformWorkspaceDetails,
    ['workspaceId'],
    'Get detailed information about a specific Terraform workspace by its ID.',
    {
      workspaceId: { type: 'string', description: 'The ID of the Terraform workspace.' },
    },
    ['workspaceId'],
    true,
  );

  await registerFunction(
    sessionId,
    'create_terraform_workspace',
    createTerraformWorkspace,
    ['organizationName', 'workspaceName', 'autoApply', 'workingDirectory', 'vcsRepoIdentifier'],
    'Create a new Terraform workspace in a specified organization.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the new workspace.' },
      autoApply: { type: 'boolean', description: 'Optional: Whether to automatically apply runs in this workspace. Defaults to false.' },
      workingDirectory: { type: 'string', description: 'Optional: The working directory for the workspace.' },
      vcsRepoIdentifier: { type: 'string', description: 'Optional: The VCS repository identifier (e.g., "org/repo"). If provided, TERRAFORM_VCS_OAUTH_TOKEN_ID must also be set.' },
    },
    ['organizationName', 'workspaceName'],
    true,
  );

  await registerFunction(
    sessionId,
    'update_terraform_workspace',
    updateTerraformWorkspace,
    ['workspaceId', 'updates'],
    'Update an existing Terraform workspace with specified attributes.',
    {
      workspaceId: { type: 'string', description: 'The ID of the workspace to update.' },
      updates: {
        type: 'object',
        description: 'An object containing attributes to update (e.g., { "auto-apply": true, "working-directory": "new-path" }).',
        properties: {
          'auto-apply': { type: 'boolean', description: 'Whether to automatically apply runs in this workspace.' },
          'working-directory': { type: 'string', description: 'The working directory for the workspace.' },
          name: { type: 'string', description: 'The new name of the workspace.' },
          // Add other updatable attributes as needed based on Terraform API documentation
        },
        // No required properties for updates, as it's a partial update
      },
    },
    ['workspaceId', 'updates'],
    true,
  );

  await registerFunction(
    sessionId,
    'delete_terraform_workspace',
    deleteTerraformWorkspace,
    ['workspaceId'],
    'Delete a Terraform workspace by its ID.',
    {
      workspaceId: { type: 'string', description: 'The ID of the workspace to delete.' },
    },
    ['workspaceId'],
    true,
  );

  await registerFunction(
    sessionId,
    'create_terraform_run',
    createTerraformRun,
    ['workspaceId', 'message', 'runType', 'isDestroy', 'isRefreshOnly'],
    'Create a new run in a Terraform workspace for planning, applying, destroying, or refreshing.',
    {
      workspaceId: { type: 'string', description: 'The ID of the workspace to create the run in.' },
      message: { type: 'string', description: 'A message describing the run.' },
      runType: {
        type: 'string',
        description: 'The type of run ("plan-and-apply", "destroy", "refresh-only"). Defaults to "plan-and-apply".',
        enum: ['plan-and-apply', 'destroy', 'refresh-only'],
      },
      isDestroy: { type: 'boolean', description: 'Set to true for a destroy run. Defaults to false.' },
      isRefreshOnly: { type: 'boolean', description: 'Set to true for a refresh-only run. Defaults to false.' },
    },
    ['workspaceId', 'message'],
    true,
  );

  // New registration for createTerraformConfigurationVersion
  await registerFunction(
    sessionId,
    'create_terraform_configuration_version',
    createTerraformConfigurationVersion,
    ['workspaceId', 'autoQueueRuns'],
    'Create a new configuration version for a Terraform workspace. This is a prerequisite for uploading Terraform code.',
    {
      workspaceId: { type: 'string', description: 'The ID of the workspace to create the configuration version for.' },
      autoQueueRuns: { type: 'boolean', description: 'Optional: Whether to automatically queue runs after configuration upload. Defaults to true.' },
    },
    ['workspaceId'],
    true,
  );

  await registerFunction(
    sessionId,
    'upload_terraform_configuration',
    uploadTerraformConfiguration,
    ['uploadUrl', 'tarGzBuffer'],
    'Upload a .tar.gz file containing Terraform configuration to a given upload URL obtained from create_terraform_configuration_version.',
    {
      uploadUrl: { type: 'string', description: 'The pre-signed URL provided by the create_terraform_configuration_version endpoint for uploading the .tar.gz file.' },
      tarGzBuffer: { type: 'string', description: 'The base64 encoded string of the .tar.gz archive containing your Terraform configuration.' },
    },
    ['uploadUrl', 'tarGzBuffer'],
    true,
  );

  await registerFunction(
    sessionId,
    'apply_terraform_run',
    applyTerraformRun,
    ['runId', 'comment'],
    'Apply a specific Terraform run that is in a "planned" or "cost_estimated" state.',
    {
      runId: { type: 'string', description: 'The ID of the run to apply.' },
      comment: { type: 'string', description: 'Optional: A comment for the apply action. Defaults to "Applied via API".' },
    },
    ['runId'],
    true,
  );

  await registerFunction(
    sessionId,
    'discard_terraform_run',
    discardTerraformRun,
    ['runId', 'comment'],
    'Discard a specific Terraform run.',
    {
      runId: { type: 'string', description: 'The ID of the run to discard.' },
      comment: { type: 'string', description: 'Optional: A comment for the discard action. Defaults to "Discarded via API".' },
    },
    ['runId'],
    true,
  );

  await registerFunction(
    sessionId,
    'get_terraform_run_details',
    getTerraformRunDetails,
    ['runId'],
    'Get detailed information about a specific Terraform run.',
    {
      runId: { type: 'string', description: 'The ID of the run to get details for.' },
    },
    ['runId'],
    true,
  );

  await registerFunction(
    sessionId,
    'terraform_apply',
    terraformApply,
    ['organizationName', 'workspaceName', 'tarGzBuffer', 'message'],
    'Perform a full Terraform "apply" workflow: creates a config version, uploads code, creates a run, and applies it. Requires a .tar.gz buffer of your Terraform configuration.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the workspace to apply changes to.' },
      tarGzBuffer: { type: 'string', description: 'The base64 encoded string of the .tar.gz archive containing your Terraform configuration. This should be generated from the Terraform configuration files.' },
      message: { type: 'string', description: 'Optional: A message for the run. Defaults to "Triggered by API apply".' },
    },
    ['organizationName', 'workspaceName', 'tarGzBuffer'],
    true,
  );

  await registerFunction(
    sessionId,
    'terraform_plan',
    terraformPlan,
    ['organizationName', 'workspaceName', 'tarGzBuffer', 'message'],
    'Perform a Terraform "plan" workflow: creates a config version, uploads code, and creates a run. Does NOT apply the changes. Requires a .tar.gz buffer of your Terraform configuration.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the workspace to plan changes for.' },
      tarGzBuffer: { type: 'string', description: 'The base64 encoded string of the .tar.gz archive containing your Terraform configuration. This should be generated from the Terraform configuration files.' },
      message: { type: 'string', description: 'Optional: A message for the run. Defaults to "Triggered by API plan".' },
    },
    ['organizationName', 'workspaceName', 'tarGzBuffer'],
    true,
  );

  await registerFunction(
    sessionId,
    'terraform_destroy',
    terraformDestroy,
    ['organizationName', 'workspaceName', 'message'],
    'Perform a Terraform "destroy" workflow: creates a destroy run and applies it. Note: Terraform Cloud typically requires a confirmation step for destroy runs.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the workspace to destroy.' },
      message: { type: 'string', description: 'Optional: A message for the destroy run. Defaults to "Triggered by API destroy".' },
    },
    ['organizationName', 'workspaceName'],
    true,
  );

  await registerFunction(
    sessionId,
    'terraform_refresh',
    terraformRefresh,
    ['organizationName', 'workspaceName', 'message'],
    'Perform a Terraform "refresh-only" workflow: creates a refresh-only run and applies it. This will update the state without making any infrastructure changes.',
    {
      organizationName: { type: 'string', description: 'The name of the Terraform Cloud/Enterprise organization.' },
      workspaceName: { type: 'string', description: 'The name of the workspace to refresh.' },
      message: { type: 'string', description: 'Optional: A message for the refresh-only run. Defaults to "Triggered by API refresh".' },
    },
    ['organizationName', 'workspaceName'],
    true,
  );
}

/**
 * Loads Terraform CLI functions into the registry if the Terraform CLI is available.
 * @param {string} sessionId - The unique identifier for the session.
 */
async function loadTerraformCli(sessionId) {
  await registerFunction(
    sessionId,
    'run_terraform_cli_workflow',
    runTerraformCliWorkflow,
    ['terraformFiles', 'action', 'projectDirectoryName', 'additionalArgs'],
    'Orchestrates a full Terraform CLI workflow: saves provided Terraform code to a temporary directory, runs `terraform init`, and then executes the specified Terraform CLI action (e.g., `plan`, `apply`, `destroy`, `refresh`, `validate`, `fmt`, `output`, `state list`, `state show`, `state rm`, `state mv`).',
    {
      terraformFiles: {
        type: 'string', // Will be a JSON string of an object
        description: 'A JSON string representing an object where keys are filenames (e.g., "main.tf", "variables.tf") and values are their HCL/JSON content. Example: \'{"main.tf": "resource \\"aws_s3_bucket\\" \\"example\\" { bucket = \\"my-bucket\\" }", "variables.tf": "variable \\"region\\" { default = \\"us-east-1\\" }"}\'',
      },
      action: {
        type: 'string',
        description: 'The desired Terraform CLI action to perform. Supported actions: "plan", "apply", "destroy", "refresh", "validate", "fmt", "output", "state list", "state show", "state rm", "state mv".',
        enum: ['plan', 'apply', 'destroy', 'refresh', 'validate', 'fmt', 'output', 'state list', 'state show', 'state rm', 'state mv'],
      },
      projectDirectoryName: { type: 'string', description: 'Optional: A subdirectory name within the session\'s temporary directory to store the Terraform files. Defaults to "terraform-project".' },
      additionalArgs: { type: 'string', description: 'Optional: Any additional arguments to pass directly to the Terraform command (e.g., \'-var="foo=bar"\', \'-auto-approve\'). Note: `apply` and `destroy` actions automatically include `-auto-approve` by default in this workflow unless overridden.' },
    },
    ['terraformFiles', 'action'],
    true, // needSession is true
  );

  // Register the new set_cloud_context function
  await registerFunction(
    sessionId,
    'set_terraform_cloud_context',
    setCloudContext,
    ['cloudProvider', 'credentials'],
    'Sets the Terraform cloud provider context (AWS, Azure, or GCP) for subsequent Terraform CLI operations in this session. This will configure environment variables for the chosen provider.',
    {
      cloudProvider: {
        type: 'string',
        description: 'The target cloud provider (e.g., "aws", "azure", "gcp").',
        enum: ['aws', 'azure', 'gcp'],
      },
      credentials: {
        type: 'string', // Will be a JSON string of an object
        description: 'A JSON string representing the credentials for the specified cloud provider. For AWS: {"AWS_ACCESS_KEY_ID": "...", "AWS_SECRET_ACCESS_KEY": "...", "AWS_REGION": "..."}. For Azure: {"ARM_CLIENT_ID": "...", "ARM_CLIENT_SECRET": "...", "ARM_TENANT_ID": "...", "ARM_SUBSCRIPTION_ID": "..."}. For GCP: {"GOOGLE_APPLICATION_CREDENTIALS_JSON": "..."} (the content of your service account key JSON file).',
      },
    },
    ['cloudProvider', 'credentials'],
    true, // needSession is true
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

  if (process.env.Maps_API_KEY) {
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

  // Terraform integration loading logic (CLI vs. Cloud API)
  const terraformCliEnabled = process.env.TERRAFORM_CLI_ENABLED === 'true';
  const terraformApiConfigured = process.env.TERRAFORM_API_ENDPOINT && process.env.TERRAFORM_API_TOKEN;

  // Prioritize CLI if enabled and available
  if (terraformCliEnabled) {
    logger.info(`Checking for Terraform CLI availability for session: ${sessionId}`);
    const cliAvailable = await checkTerraformCliExists();
    if (cliAvailable) {
      logger.info(`Loading Terraform CLI integration for session: ${sessionId}`);
      await loadTerraformCli(sessionId);
    } else {
      logger.warn(`Terraform CLI integration not loaded for session: ${sessionId}. CLI not found or not accessible.`);
      // If CLI is enabled but not found, check for Cloud API as a fallback
      if (terraformApiConfigured) {
        logger.info(`Falling back to Terraform Cloud API integration for session: ${sessionId}`);
        await loadTerraform(sessionId);
      } else {
        logger.warn(`No Terraform integration loaded for session: ${sessionId}. Neither CLI (enabled but not found) nor Cloud API (not configured).`);
      }
    }
  } else if (terraformApiConfigured) { // Load Cloud API if CLI not enabled, but API is configured
    logger.info(`Loading Terraform Cloud API integration for session: ${sessionId}`);
    await loadTerraform(sessionId);
  } else { // No Terraform integration loaded at all
    logger.info(`No Terraform integration loaded for session: ${sessionId}. TERRAFORM_CLI_ENABLED is not 'true' and TERRAFORM_API_ENDPOINT/TERRAFORM_API_TOKEN are not set.`);
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
