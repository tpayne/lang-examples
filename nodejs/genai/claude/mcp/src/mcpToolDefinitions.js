/**
 * Declarative tool definitions for the MCP server.
 *
 * This is the MCP-era replacement for the old `registerFunction` calls that
 * used to live in `functions.js`. Each entry below carries exactly the same
 * information that used to be passed to `registerFunction` (name, the real
 * implementation function, its positional parameter names, a description,
 * a JSON-schema-style parameter map, which parameters are required, and
 * whether the function needs the caller's sessionId injected as its first
 * argument) - the underlying implementation functions themselves are
 * untouched and still live in gitFunctions.js, k8s.js, etc.
 *
 * mcpServer.js turns each of these specs into a FastMCP tool via
 * jsonSchemaToZod.js; chatbot.js never sees this file directly - it talks to
 * the resulting tools purely over MCP.
 */

const {
  checkBranchExists,
  checkRepoExists,
  commitFiles,
  createBranch,
  createGithubPullRequest,
  createRepo,
  deleteContent,
  fetchRepoContentsRecursive,
  getFileContents,
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listPublicRepos,
  switchBranch,
} = require('./gitFunctions');

const {
  createGithubWorkflowDispatch,
  deleteGithubWorkflowRun,
  getGithubWorkflowRunLogs,
  listGithubWorkflowRuns,
  listGithubWorkflows,
  listGitHubActions,
} = require('./gitActions');

const {
  checkAdoBranchExists,
  checkAdoRepoExists,
  commitAdoFiles,
  createAdoBranch,
  createAdoPullRequest,
  createAdoRepo,
  fetchAdoRepoContentsRecursive,
  getAdoFileContents,
  listAdoBranches,
  listAdoCommitHistory,
  listAdoDirectoryContents,
  listAdoRepos,
  switchAdoBranch,
} = require('./adoFunctions');

const {
  codeReviews,
  adoCodeReviews,
} = require('./codeReviews');

const { getVehicleHistory } = require('./dosaFunctions');

const { generateGoogleMapsLink, planRoute } = require('./mappingFunctions');

const { saveCodeToFile } = require('./utilities');

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

const { getDockerImageTags, searchDockerImages } = require('./dockerHub');

const {
  connectToDatabase,
  dumpDatabaseStructure,
  selectDatabaseData,
  listDatabaseSchemas,
  listSchemaObjects,
  runAdhocSql,
} = require('./dbfuncs');

const {
  collectBasicSystemInfo,
  collectDetailedSystemInfo,
  collectProcessInfo,
  collectAllServicesInfo,
  testSshConnect,
} = require('./getInfo');

const { scanNetworkForSSH } = require('./sshscan');

const {
  createAdoPipeline,
  deleteAdoPipeline,
  getAdoPipelineRunLogs,
  listAdoPipelineRuns,
  listAdoPipelines,
  listAdoProjects,
  runAdoPipeline,
} = require('./adoPipelines');

/* eslint-disable max-len */

/**
 * @typedef {object} ToolDefinition
 * @property {string} name - The unique tool name (as seen by the MCP client / Claude).
 * @property {Function} func - The real implementation function to invoke.
 * @property {string[]} params - Positional parameter names (in call order) the function expects.
 * @property {string} description - A description of what the tool does.
 * @property {Record<string, object>} parametersSchema - JSON-schema-style property definitions.
 * @property {string[]} required - Names of required parameters.
 * @property {boolean} [needSession] - Whether `sessionId` must be injected as the function's first argument.
 */

/** @type {ToolDefinition[]} */
const gitHubTools = [
  {
    name: 'create_repo',
    func: createRepo,
    params: ['repoName', 'username', 'orgName', 'description', 'isPrivate'],
    description: 'Create a GitHub repository under an organisation or user',
    parametersSchema: {
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      username: { type: 'string', description: 'The username of the repository owner.' },
      // NB: present in `params` but missing from the original functions.js
      // registration, so the model could never actually set it (createRepo
      // silently defaulted orgName to 'user' every time). Added here.
      orgName: { type: 'string', description: 'The organisation to create the repository under (optional). Defaults to the user account if not provided.' },
      description: { type: 'string', description: 'The description of the repository name (optional). Defaults if not provided' },
      isPrivate: { type: 'boolean', description: 'Is the repository private (true) or public (false) (optional). Defaults to public if not provided' },
    },
    required: ['repoName'],
  },
  {
    name: 'switch_branch',
    func: switchBranch,
    params: ['username', 'repoName', 'branchName'],
    description: 'Switch a branch in a GitHub repository',
    parametersSchema: {
      username: { type: 'string', description: 'The username of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The branch name to switch to.' },
    },
    required: ['username', 'repoName', 'branchName'],
  },
  {
    name: 'save_code_to_file',
    func: saveCodeToFile,
    params: ['code', 'filename', 'repoDirName'],
    description: 'Save generated code or changes made by the bot to a local file',
    parametersSchema: {
      code: { type: 'string', description: 'The generated code or changes to save.' },
      filename: { type: 'string', description: 'The local filename to save the changes to.' },
      repoDirName: { type: 'string', description: 'The directory name that is used (optional).' },
    },
    required: ['code', 'filename', 'repoDirName'],
    needSession: true,
  },
  {
    name: 'create_branch',
    func: createBranch,
    params: ['username', 'repoName', 'branchName', 'baseBranch'],
    description: 'Create a new branch in a GitHub repository based on an existing branch',
    parametersSchema: {
      username: { type: 'string', description: 'The username of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The name of the new branch to be created.' },
      baseBranch: { type: 'string', description: 'The name of the existing branch to base the new branch on (optional). Defaults to "main".' },
    },
    required: ['username', 'repoName', 'branchName'],
  },
  {
    name: 'check_branch_exists',
    func: checkBranchExists,
    params: ['username', 'repoName', 'branchName'],
    description: 'Check if a GitHub branch exists in a specified repository',
    parametersSchema: {
      username: { type: 'string', description: 'The username or organization name of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
      branchName: { type: 'string', description: 'The name of the branch to check.' },
    },
    required: ['username', 'repoName', 'branchName'],
  },
  {
    name: 'check_repo_exists',
    func: checkRepoExists,
    params: ['username', 'repoName'],
    description: 'Check if a GitHub repository exists under a given user or organization',
    parametersSchema: {
      username: { type: 'string', description: 'The username or organization name of the repository owner.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
    },
    required: ['username', 'repoName'],
  },
  {
    name: 'get_github_file_contents',
    func: getFileContents,
    params: ['username', 'repoName', 'filePath', 'branchName'],
    description: 'Gets the contents of a single file from a GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The name of the repository.' },
      filePath: { type: 'string', description: 'The path to the file within the repository.' },
      branchName: { type: 'string', description: 'Optional branch name. If not specified, the default branch will be used.' },
    },
    required: ['username', 'repoName', 'filePath'],
  },
  {
    name: 'commit_files',
    func: commitFiles,
    params: ['username', 'repoName', 'repoDirName', 'branchName'],
    description: 'Upload, push, load or commit files from the session temporary directory to a specified GitHub repository, maintaining directory structure.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The base directory in the GitHub repository to commit files into.' },
      branchName: { type: 'string', description: 'The name of the branch to commit to.' },
    },
    required: ['username', 'repoName', 'repoDirName'],
    needSession: true,
  },
  {
    name: 'create_pull_request',
    func: createGithubPullRequest,
    params: ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'],
    description: 'Create a pull request on a given GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      title: { type: 'string', description: 'The Pull Request title.' },
      sourceBranch: { type: 'string', description: 'The source branch name.' },
      targetBranch: { type: 'string', description: 'The target branch name.' },
      body: { type: 'string', description: 'The description or body of the pull request.' },
    },
    required: ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch'],
  },
  {
    name: 'delete_content',
    func: deleteContent,
    params: ['username', 'repoName', 'repoDirName', 'branchName'],
    description: 'Delete files or directories from a specified GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The base directory in the GitHub repository to delete files from.' },
      branchName: { type: 'string', description: 'The name of the branch to commit to.' },
    },
    required: ['username', 'repoName', 'repoDirName'],
  },
  {
    name: 'fetch_repo_contents',
    func: fetchRepoContentsRecursive,
    params: ['username', 'repoName', 'repoDirName'],
    description: 'Fetch or download the contents of a GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The GitHub repository path to start download at.' },
    },
    required: ['username', 'repoName', 'repoDirName'],
    needSession: true,
  },
  {
    name: 'list_public_repos',
    func: listPublicRepos,
    params: ['username'],
    description: 'Lists public repositories for a given GitHub username.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
    },
    required: ['username'],
  },
  {
    name: 'list_branches',
    func: listBranches,
    params: ['username', 'repoName'],
    description: 'Lists branches for a given GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    required: ['username', 'repoName'],
  },
  {
    name: 'list_commit_history',
    func: listCommitHistory,
    params: ['username', 'repoName', 'repoDirName'],
    description: 'Lists commit history for a file in a GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The file or directory path.' },
    },
    required: ['username', 'repoName', 'repoDirName'],
  },
  {
    name: 'list_directory_contents',
    func: listDirectoryContents,
    params: ['username', 'repoName', 'branchName', 'repoDirName', 'recursive'],
    description: 'Lists the contents of a directory in a GitHub repository on a specific branch. Defaults to the root and recursive scan.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      branchName: { type: 'string', description: 'The name of the branch to list contents from (optional). Defaults to "main" if not provided.' },
      repoDirName: { type: 'string', description: 'The directory path within the repository (optional). Defaults to the repository root if not provided.' },
      recursive: { type: 'boolean', description: 'Perform a recursive scan or not (optional). Defaults to true if not provided.' },
    },
    required: ['username', 'repoName'],
  },
];

/** @type {ToolDefinition[]} */
const gitHubActionsTools = [
  {
    name: 'list_github_actions',
    func: listGitHubActions,
    params: ['username', 'repoName', 'status'],
    description: 'Lists the GitHub actions running in a GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      status: { type: 'string', description: 'The status of the actions (optional). Defaults to in_progress if not provided' },
    },
    required: ['username', 'repoName'],
  },
  {
    name: 'list_github_workflows',
    func: listGithubWorkflows,
    params: ['username', 'repoName'],
    description: 'Lists all workflows in a given GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    required: ['username', 'repoName'],
  },
  {
    name: 'create_github_workflow_dispatch',
    func: createGithubWorkflowDispatch,
    params: ['username', 'repoName', 'workflowId', 'ref', 'inputs'],
    description: 'Dispatches a workflow_dispatch event to trigger a workflow.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      workflowId: { type: 'string', description: 'The ID or file name of the workflow to trigger.' },
      ref: { type: 'string', description: 'The Git reference (branch, tag, or SHA).' },
      inputs: { type: 'object', description: 'The inputs for the workflow_dispatch event.' },
    },
    required: ['username', 'repoName', 'workflowId', 'ref'],
  },
  {
    name: 'list_github_workflow_runs',
    func: listGithubWorkflowRuns,
    params: ['username', 'repoName'],
    description: 'Lists all workflow runs for a given GitHub repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    required: ['username', 'repoName'],
  },
  {
    name: 'get_github_workflow_run_logs',
    func: getGithubWorkflowRunLogs,
    params: ['username', 'repoName', 'runId'],
    description: 'Gets the logs for a specific workflow run.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      runId: { type: 'string', description: 'The ID of the workflow run.' },
    },
    required: ['username', 'repoName', 'runId'],
  },
  {
    name: 'delete_github_workflow_run',
    func: deleteGithubWorkflowRun,
    // NB: the original functions.js listed params as ['owner', 'repo',
    // 'runId'], but deleteGithubWorkflowRun's real signature (and this
    // tool's own schema/required list, below) use username/repoName - so
    // the first two positional arguments were always undefined. Fixed here
    // to match the function signature and schema.
    params: ['username', 'repoName', 'runId'],
    description: 'Deletes a specific workflow run from a repository.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The repository name.' },
      runId: { type: 'string', description: 'The ID of the workflow run to delete.' },
    },
    required: ['username', 'repoName', 'runId'],
  },
];

/** @type {ToolDefinition[]} */
const codeReviewTools = [
  {
    name: 'github_file_review',
    func: codeReviews,
    params: ['username', 'repoName', 'repoDirName', 'branchName'],
    description: 'Review files in a given GitHub repository. Use this for GitHub URLs and GitHub repositories.',
    parametersSchema: {
      username: { type: 'string', description: 'The GitHub username.' },
      repoName: { type: 'string', description: 'The GitHub repository name.' },
      repoDirName: { type: 'string', description: 'The GitHub repository path to start download at.' },
      branchName: { type: 'string', description: 'The name of the branch to review.' },
    },
    required: ['username', 'repoName', 'repoDirName'],
    needSession: true,
  },
];

/** @type {ToolDefinition[]} */
const adoCodeReviewTools = [
  {
    name: 'ado_file_review',
    func: adoCodeReviews,
    params: ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    description: 'Review files in a given Azure DevOps repository. Use this for Azure DevOps URLs and Azure DevOps repositories.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The Azure DevOps repository name.' },
      repoDirName: { type: 'string', description: 'The Azure DevOps repository path to start download at.' },
      branchName: { type: 'string', description: 'The name of the branch to review.' },
    },
    required: ['organization', 'project', 'repoName', 'repoDirName'],
    needSession: true,
  },
];

/** @type {ToolDefinition[]} */
const dosaTools = [
  {
    name: 'get_mot_history',
    func: getVehicleHistory,
    params: ['registrationNumber'],
    description: 'Get the MOT History for a vehicle.',
    parametersSchema: {
      registrationNumber: { type: 'string', description: 'The Vehicle registration or VIN number.' },
    },
    required: ['registrationNumber'],
    needSession: true,
  },
];

/** @type {ToolDefinition[]} */
const adoTools = [
  {
    name: 'create_ado_repo',
    func: createAdoRepo,
    params: ['organization', 'project', 'repoName', 'isPublic'],
    description: 'Create an Azure DevOps (ADO) Git repository under a specified organization and project.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to be created.' },
      isPublic: { type: 'boolean', description: 'Is the repository public (true) or private (false) (optional). Defaults to private if not provided.' },
    },
    required: ['organization', 'project', 'repoName'],
  },
  {
    name: 'get_ado_file_contents',
    func: getAdoFileContents,
    params: ['organization', 'project', 'repoName', 'filePath', 'branchName'],
    description: 'Gets the contents of a single file from an Azure DevOps Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository.' },
      filePath: { type: 'string', description: 'The path to the file within the repository.' },
      branchName: { type: 'string', description: 'Optional branch name. If not specified, the default branch will be used.' },
    },
    required: ['organization', 'project', 'repoName', 'filePath'],
  },
  {
    name: 'switch_ado_branch',
    func: switchAdoBranch,
    params: ['organization', 'project', 'repoName', 'branchName'],
    description: 'Switch the default branch in an Azure DevOps (ADO) Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository.' },
      branchName: { type: 'string', description: 'The branch name to switch to as the new default.' },
    },
    required: ['organization', 'project', 'repoName', 'branchName'],
  },
  {
    name: 'commit_ado_files',
    func: commitAdoFiles,
    params: ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    description: 'Upload, push, load or commit files from the session temporary directory to a specified Azure DevOps (ADO) Git repository, maintaining directory structure.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The base directory in the Azure DevOps repository to commit files into (optional). Defaults to the repository root if not provided.' },
      branchName: { type: 'string', description: "The name of the branch to commit to (optional). Defaults to the repository's default branch if not provided." },
    },
    required: ['organization', 'project', 'repoName'],
    needSession: true,
  },
  {
    name: 'create_ado_pull_request',
    func: createAdoPullRequest,
    params: ['organization', 'project', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'],
    description: 'Create a pull request on a given Azure DevOps (ADO) Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      title: { type: 'string', description: 'The Pull Request title.' },
      sourceBranch: { type: 'string', description: 'The source branch name.' },
      targetBranch: { type: 'string', description: 'The target branch name.' },
      body: { type: 'string', description: 'The description or body of the pull request (optional).' },
    },
    required: ['organization', 'project', 'repoName', 'title', 'sourceBranch', 'targetBranch'],
  },
  {
    name: 'fetch_ado_repo_contents',
    func: fetchAdoRepoContentsRecursive,
    params: ['organization', 'project', 'repoName', 'repoDirName', 'branchName'],
    description: 'Fetch or download the contents of an Azure DevOps (ADO) Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The Azure DevOps repository path to start download at (optional). Defaults to the repository root if not provided.' },
      branchName: { type: 'string', description: "The name of the branch to fetch contents from (optional). Defaults to the repository's default branch if not provided." },
    },
    required: ['organization', 'project', 'repoName'],
    needSession: true,
  },
  {
    name: 'list_ado_pipelines',
    func: listAdoPipelines,
    params: ['organization', 'project', 'repoName', 'statusFilter'],
    description: 'Lists Azure DevOps (ADO) Pipelines and builds that ran in a specified repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      statusFilter: { type: 'string', description: 'The status to filter pipelines by (e.g., "inProgress", "queued", "completed", "failed") (optional). Defaults to "inProgress" if not provided.' },
    },
    required: ['organization', 'project', 'repoName'],
  },
  {
    name: 'list_ado_repos',
    func: listAdoRepos,
    params: ['organization', 'project'],
    description: 'Lists repositories for a given Azure DevOps (ADO) organization and project.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
    },
    required: ['organization', 'project'],
  },
  {
    name: 'list_ado_branches',
    func: listAdoBranches,
    params: ['organization', 'project', 'repoName'],
    description: 'Lists branches for a given Azure DevOps (ADO) Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
    },
    required: ['organization', 'project', 'repoName'],
  },
  {
    name: 'list_ado_commit_history',
    func: listAdoCommitHistory,
    params: ['organization', 'project', 'repoName', 'repoDirName'],
    description: 'Lists commit history for a file or directory in an Azure DevOps (ADO) Git repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      repoDirName: { type: 'string', description: 'The file or directory path within the repository.' },
    },
    required: ['organization', 'project', 'repoName', 'repoDirName'],
  },
  {
    name: 'list_ado_directory_contents',
    func: listAdoDirectoryContents,
    params: ['organization', 'project', 'repoName', 'branchName', 'repoDirName', 'recursive'],
    description: 'Lists the contents of a directory in an Azure DevOps (ADO) Git repository on a specific branch. Defaults to the root and recursive scan.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The repository name.' },
      branchName: { type: 'string', description: "The name of the branch to list contents from (optional). Defaults to the repository's default branch if not provided." },
      repoDirName: { type: 'string', description: 'The directory path within the repository (optional). Defaults to the repository root if not provided.' },
      recursive: { type: 'boolean', description: 'Perform a recursive scan or not (optional). Defaults to true if not provided.' },
    },
    required: ['organization', 'project', 'repoName'],
  },
  {
    name: 'check_ado_branch_exists',
    func: checkAdoBranchExists,
    params: ['organization', 'project', 'repoName', 'branchName'],
    description: 'Check if an Azure DevOps (ADO) Git branch exists in a specified repository.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
      branchName: { type: 'string', description: 'The name of the branch to check.' },
    },
    required: ['organization', 'project', 'repoName', 'branchName'],
  },
  {
    name: 'check_ado_repo_exists',
    func: checkAdoRepoExists,
    params: ['organization', 'project', 'repoName'],
    description: 'Check if an Azure DevOps (ADO) Git repository exists under a given organization and project.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository to check.' },
    },
    required: ['organization', 'project', 'repoName'],
  },
  {
    name: 'create_ado_branch',
    func: createAdoBranch,
    params: ['organization', 'project', 'repoName', 'branchName', 'baseBranch'],
    description: 'Create a new branch in an Azure DevOps (ADO) Git repository based on an existing branch.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project name.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      branchName: { type: 'string', description: 'The name of the new branch to be created.' },
      baseBranch: { type: 'string', description: "The name of the existing branch to base the new branch on (optional). Defaults to the repository's default branch." },
    },
    required: ['organization', 'project', 'repoName', 'branchName'],
  },
  {
    name: 'list_ado_projects',
    func: listAdoProjects,
    params: ['organization'],
    description: 'Fetches a list of Azure DevOps projects.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
    },
    required: ['organization'],
  },
  {
    name: 'create_ado_pipeline',
    func: createAdoPipeline,
    params: ['organization', 'project', 'repoName', 'yamlPath'],
    description: 'Creates a new Azure DevOps pipeline (build definition).',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      repoName: { type: 'string', description: 'The name of the repository where the branch will be created.' },
      yamlPath: { type: 'string', description: 'The path to the YAML file defining the pipeline (default is "azure-pipelines.yml".' },
    },
    required: ['organization', 'project', 'repoName', 'yamlPath'],
  },
  {
    name: 'run_ado_pipeline',
    func: runAdoPipeline,
    params: ['organization', 'project', 'pipelineId', 'repoName', 'branchName', 'userParameters'],
    description: 'Triggers a new run for an Azure DevOps pipeline.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline to run.' },
      repoName: { type: 'string', description: 'The name of the repository where the pipeline will be run.' },
      branchName: { type: 'string', description: 'The name of branch to use.' },
      userParameters: { type: 'object', description: 'Optional parameters for the pipeline run (e.g., variables, branch).' },
    },
    required: ['organization', 'project', 'pipelineId', 'repoName'],
  },
  {
    name: 'get_ado_pipeline_run_logs',
    func: getAdoPipelineRunLogs,
    params: ['organization', 'project', 'pipelineId', 'runId'],
    description: 'Retrieves logs for a specific pipeline run in Azure DevOps. This function retrieves a list of log entries; to get the full content of a specific log file, a subsequent call to the specific log URL might be needed.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline.' },
      runId: { type: 'number', description: 'The ID of the pipeline run.' },
    },
    required: ['organization', 'project', 'pipelineId', 'runId'],
  },
  {
    name: 'list_ado_pipeline_runs',
    func: listAdoPipelineRuns,
    params: ['organization', 'project', 'pipelineId'],
    description: 'Fetches a list of runs for a specific Azure DevOps pipeline.',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The Azure DevOps project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline.' },
    },
    required: ['organization', 'project', 'pipelineId'],
  },
  {
    name: 'delete_ado_pipeline',
    func: deleteAdoPipeline,
    params: ['organization', 'project', 'pipelineId'],
    description: 'Deletes an Azure DevOps pipeline (build definition).',
    parametersSchema: {
      organization: { type: 'string', description: 'The Azure DevOps organization name.' },
      project: { type: 'string', description: 'The project ID or name.' },
      pipelineId: { type: 'number', description: 'The ID of the pipeline to delete.' },
    },
    required: ['organization', 'project', 'pipelineId'],
  },
];

const routeParamsProperties = {
  origin: { type: 'string', description: 'The starting point for the directions request.' },
  destination: { type: 'string', description: 'The ending point for the directions request.' },
  waypoints: {
    type: 'array',
    description: 'An array of intermediate locations to include in the route.',
    items: { type: 'string' },
    nullable: true,
  },
  mode: {
    type: 'string',
    description: 'Specifies the mode of transport (e.g., "driving", "walking", "bicycling", "transit"). Defaults to "driving".',
    nullable: true,
    enum: ['driving', 'walking', 'bicycling', 'transit'],
  },
  language: { type: 'string', description: 'The language to use for the results.', nullable: true },
  units: {
    type: 'string',
    description: 'Specifies the unit system to use (e.g., "metric", "imperial"). Defaults to "metric".',
    nullable: true,
    enum: ['metric', 'imperial'],
  },
  alternatives: { type: 'boolean', description: 'If true, more than one route may be returned.', nullable: true },
  avoid: {
    type: 'string',
    description: 'Indicates features to avoid (e.g., "tolls", "highways", "ferries", "indoor"). Can be a single value or multiple values separated by "|".',
    nullable: true,
  },
  transit_mode: {
    type: 'string',
    description: 'Specifies the desired modes of transit (e.g., "bus", "subway", "train", "tram", "rail"). Can be multiple values separated by "|".',
    nullable: true,
  },
  transit_routing_preference: {
    type: 'string',
    description: 'Specifies preferences for transit routes (e.g., "less_walking", "fewer_transfers").',
    nullable: true,
    enum: ['less_walking', 'fewer_transfers'],
  },
  departure_time: { type: 'string', description: 'The desired time of departure. Can be a timestamp or "now".', nullable: true },
  arrival_time: { type: 'string', description: 'The desired time of arrival (for transit). Can be a timestamp.', nullable: true },
  traffic_model: {
    type: 'string',
    description: 'Specifies the assumptions to use when calculating time in traffic (e.g., "best_guess", "optimistic", "pessimistic").',
    nullable: true,
    enum: ['best_guess', 'optimistic', 'pessimistic'],
  },
  optimizeWaypoints: {
    type: 'boolean',
    description: 'If true and waypoints are provided, the API will attempt to reorder the waypoints to minimize the total travel time.',
    nullable: true,
  },
};

/** @type {ToolDefinition[]} */
const mappingTools = [
  {
    name: 'plan_route',
    func: planRoute,
    params: ['params'],
    description: 'Plans a route between multiple points using the Google Maps Directions API and returns the details in JSON format.',
    parametersSchema: {
      params: {
        type: 'object',
        description: 'Parameters for the Google Maps Directions API request.',
        properties: routeParamsProperties,
        required: ['origin', 'destination'],
      },
    },
    required: ['params'],
    needSession: true,
  },
  {
    name: 'generate_Maps_link',
    func: generateGoogleMapsLink,
    params: ['params'],
    description: 'Generates an HTTP link to view a planned route on the Google Maps website using the original route parameters.',
    parametersSchema: {
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
            nullable: true,
          },
          mode: {
            type: 'string',
            description: 'The mode of transport used for the route.',
            nullable: true,
            enum: ['driving', 'walking', 'bicycling', 'transit'],
          },
        },
        required: ['origin', 'destination'],
      },
    },
    required: ['params'],
  },
];

/** @type {ToolDefinition[]} */
const kubernetesTools = [
  {
    name: 'get_kubernetes_version',
    func: getKubernetesVersion,
    params: [],
    description: 'List or get all the Kubernetes version information for the connected Kubernetes cluster.',
    parametersSchema: {},
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_namespaces',
    func: listKubernetesNamespaces,
    params: [],
    description: 'List or get all the Kubernetes namespaces in the cluster, returning their detailed status and metadata.',
    parametersSchema: {},
    required: [],
    needSession: true,
  },
  {
    name: 'create_kubernetes_resource',
    func: createKubernetesResource,
    params: ['resourceType', 'resourceBody', 'namespace'],
    description: 'Create a Kubernetes resource from a provided YAML or JSON body.',
    parametersSchema: {
      resourceType: { type: 'string', description: 'The type of the resource to create (e.g., "pods", "deployments", "services", "namespaces").' },
      resourceBody: { type: 'string', description: 'The YAML or JSON string representation of the Kubernetes resource to create. This should be auto-generated by the chatbot based on the description given' },
      namespace: { type: 'string', description: 'Optional: The namespace in which to create the resource. Not required for cluster-scoped resources like Namespaces or PersistentVolumes. The default will be "default" if not provided.' },
    },
    required: ['resourceType', 'resourceBody'],
    needSession: true,
  },
  {
    name: 'delete_kubernetes_resource',
    func: deleteKubernetesResource,
    params: ['resourceType', 'name', 'namespace'],
    description: 'Delete a specified Kubernetes resource (e.g., Pod, Deployment, Service) by its name from a given namespace.',
    parametersSchema: {
      resourceType: { type: 'string', description: 'The type of the resource to delete (e.g., "pods", "deployments", "services", "namespaces").' },
      name: { type: 'string', description: 'The name of the resource to delete.' },
      namespace: { type: 'string', description: 'The namespace the resource resides in. Required for namespaced resources. Not used for cluster-scoped resources like PersistentVolumes or Namespaces (when deleting the namespace itself).' },
    },
    required: ['resourceType', 'name'],
    needSession: true,
  },
  {
    name: 'update_kubernetes_resource',
    func: updateKubernetesResource,
    params: ['resourceType', 'name', 'resourceBody', 'namespace'],
    description: 'Update an existing Kubernetes resource with a provided YAML or JSON body.',
    parametersSchema: {
      resourceType: { type: 'string', description: 'The type of the resource to update (e.g., "pods", "deployments", "services", "namespaces").' },
      name: { type: 'string', description: 'The name of the resource to update.' },
      resourceBody: { type: 'string', description: 'The YAML or JSON string representation of the Kubernetes resource with the updated configuration. This should be auto-generated by the chatbot based on the description given' },
      namespace: { type: 'string', description: 'Optional: The namespace in which to create the resource. Not required for cluster-scoped resources like Namespaces or PersistentVolumes. The default will be "default" if not provided.' },
    },
    required: ['resourceType', 'name', 'resourceBody'],
    needSession: true,
  },
  {
    name: 'list_kubernetes_deployments',
    func: listKubernetesDeployments,
    params: ['namespace'],
    description: 'List or get all the Kubernetes deployments across all namespaces or within a specified namespace, returning their detailed status, replicas, and associated metadata.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list deployments from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'get_kubernetes_deployment_details',
    func: getKubernetesDeploymentDetails,
    params: ['deploymentName', 'namespace'],
    description: 'Get detailed information about a specific Kubernetes Deployment by its name within a given namespace.',
    parametersSchema: {
      deploymentName: { type: 'string', description: 'The name of the deployment to get details for.' },
      namespace: { type: 'string', description: 'The namespace the deployment resides in.' },
    },
    required: ['deploymentName', 'namespace'],
    needSession: true,
  },
  {
    name: 'list_kubernetes_services',
    func: listKubernetesServices,
    params: ['namespace'],
    description: 'List or get all the Kubernetes services across all namespaces or within a specified namespace, returning their detailed status, cluster IPs, ports, and selectors.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list services from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'get_kubernetes_service_details',
    func: getKubernetesServiceDetails,
    params: ['serviceName', 'namespace'],
    description: 'Get detailed information about a specific Kubernetes Service by its name within a given namespace.',
    parametersSchema: {
      serviceName: { type: 'string', description: 'The name of the service to get details for.' },
      namespace: { type: 'string', description: 'The namespace the service resides in.' },
    },
    required: ['serviceName', 'namespace'],
    needSession: true,
  },
  {
    name: 'list_kubernetes_pods',
    func: listKubernetesPods,
    params: ['namespace'],
    description: 'List or get all the Kubernetes pods across all namespaces or within a specified namespace, returning their detailed status, node assignments, and container information.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list pods from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'get_kubernetes_pod_details',
    func: getKubernetesPodDetails,
    params: ['podName', 'namespace'],
    description: 'Get detailed information about a specific Kubernetes Pod by its name within a given namespace. This is ONLY for Kubernetes use, not for host machine details',
    parametersSchema: {
      podName: { type: 'string', description: 'The name of the pod to get details for.' },
      namespace: { type: 'string', description: 'The namespace the pod resides in.' },
    },
    required: ['podName', 'namespace'],
    needSession: true,
  },
  {
    name: 'get_kubernetes_pod_logs',
    func: getKubernetesPodLogs,
    params: ['podName', 'namespace'],
    description: 'Get the logs for a specific pod in a given namespace.',
    parametersSchema: {
      podName: { type: 'string', description: 'The name of the pod to get logs from.' },
      namespace: { type: 'string', description: 'The namespace the pod resides in.' },
    },
    required: ['podName', 'namespace'],
    needSession: true,
  },
  {
    name: 'get_kubernetes_node_details',
    func: getKubernetesNodeDetails,
    params: ['nodeName'],
    description: 'Get detailed information about a specific Kubernetes Node by its name.',
    parametersSchema: {
      nodeName: { type: 'string', description: 'The name of the node to get details for.' },
    },
    required: ['nodeName'],
    needSession: true,
  },
  {
    name: 'get_kubernetes_secret_details',
    func: getKubernetesSecretDetails,
    params: ['secretName', 'namespace'],
    description: 'Get detailed information about a specific Kubernetes Secret by its name within a given namespace.',
    parametersSchema: {
      secretName: { type: 'string', description: 'The name of the secret to get details for.' },
      namespace: { type: 'string', description: 'The namespace the secret resides in.' },
    },
    required: ['secretName', 'namespace'],
    needSession: true,
  },
  {
    name: 'list_kubernetes_events',
    func: listKubernetesEvents,
    params: ['namespace'],
    description: 'List or get all Kubernetes Events across all namespaces or within a specified namespace, returning their detailed status and associated resources.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list events from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_nodes',
    func: listKubernetesNodes,
    params: [],
    description: 'List or get all Kubernetes Nodes, returning their detailed status, capacity, and allocatable resources.',
    parametersSchema: {},
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_secrets',
    func: listKubernetesSecrets,
    params: ['namespace'],
    description: 'List or get all Kubernetes Secrets across all namespaces or within a specified namespace, returning their detailed data (excluding sensitive content).',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list secrets from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'scale_kubernetes_deployment',
    func: scaleKubernetesDeployment,
    params: ['deploymentName', 'namespace', 'replicas'],
    description: 'Scale a specified Kubernetes Deployment to a desired number of replicas.',
    parametersSchema: {
      deploymentName: { type: 'string', description: 'The name of the deployment to scale.' },
      namespace: { type: 'string', description: 'The namespace the deployment resides in.' },
      replicas: { type: 'number', description: 'The desired number of replicas for the deployment.' },
    },
    required: ['deploymentName', 'namespace', 'replicas'],
    needSession: true,
  },
  {
    name: 'list_kubernetes_replicasets',
    func: listKubernetesReplicaSets,
    params: ['namespace'],
    description: 'List or get all the Kubernetes ReplicaSets across all namespaces or within a specified namespace, returning their detailed status and replica counts.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list ReplicaSets from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_daemonsets',
    func: listKubernetesDaemonSets,
    params: ['namespace'],
    description: 'List or get all the Kubernetes DaemonSets across all namespaces or within a specified namespace, returning their detailed status.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list DaemonSets from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_statefulsets',
    func: listKubernetesStatefulSets,
    params: ['namespace'],
    description: 'List or get all the Kubernetes StatefulSets across all namespaces or within a specified namespace, returning their detailed status and replica counts.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list StatefulSets from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_ingresses',
    func: listKubernetesIngresses,
    params: ['namespace'],
    description: 'List or get all the Kubernetes Ingresses across all namespaces or within a specified namespace, returning their detailed rules and backend services.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list Ingresses from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_configmaps',
    func: listKubernetesConfigMaps,
    params: ['namespace'],
    description: 'List or get all the Kubernetes ConfigMaps across all namespaces or within a specified namespace, returning their detailed data.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list ConfigMaps from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_persistent_volumes',
    func: listKubernetesPersistentVolumes,
    params: [],
    description: 'List or get all the Kubernetes PersistentVolumes, returning their detailed status, capacity, and access modes.',
    parametersSchema: {},
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_persistent_volume_claims',
    func: listKubernetesPersistentVolumeClaims,
    params: ['namespace'],
    description: 'List or get all the Kubernetes PersistentVolumeClaims across all namespaces or within a specified namespace, returning their detailed status and volume bindings.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list PersistentVolumeClaims from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_jobs',
    func: listKubernetesJobs,
    params: ['namespace'],
    description: 'List or get all the Kubernetes Jobs across all namespaces or within a specified namespace, returning their detailed status and completion information.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list Jobs from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'list_kubernetes_cronjobs',
    func: listKubernetesCronJobs,
    params: ['namespace'],
    description: 'List or get all the Kubernetes CronJobs across all namespaces or within a specified namespace, returning their detailed status and schedule.',
    parametersSchema: {
      namespace: { type: 'string', description: 'Optional: The namespace to list CronJobs from. If not provided, lists from all namespaces.' },
    },
    required: [],
    needSession: true,
  },
];

/** @type {ToolDefinition[]} */
const dockerHubTools = [
  {
    name: 'search_docker_images',
    func: searchDockerImages,
    params: ['searchTerm', 'isPrivate', 'username'],
    description: 'Search for Docker images on Docker Hub, supporting both public and private repositories. For private searches, the Docker Hub username and password must be configured as environment variables.',
    parametersSchema: {
      searchTerm: { type: 'string', description: 'The term to search for (e.g., "ubuntu", "my-private-repo/my-image").' },
      isPrivate: { type: 'boolean', description: 'Set to true to search private repositories of the configured Docker Hub user. Defaults to false (public search).' },
      username: { type: 'string', description: 'Optional: Docker Hub username if searching private repos. Defaults to DOCKERHUB_USERNAME env var if not provided and isPrivate is true.' },
    },
    required: ['searchTerm'],
    needSession: true,
  },
  {
    name: 'get_docker_tags',
    func: getDockerImageTags,
    params: ['imageName'],
    description: 'For a given Docker image name, get all the details of its tags.',
    parametersSchema: {
      imageName: { type: 'string', description: 'The Docker image name to get tags for (e.g., "latest", "my-private-repo/my-image").' },
    },
    required: ['imageName'],
  },
];

/** @type {ToolDefinition[]} */
const databaseTools = [
  {
    name: 'connect_database',
    func: connectToDatabase,
    params: ['uri'],
    description: 'Connects to a database using a JDBC-like URI. This function establishes a connection to the specified database and returns a client object for further operations.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection (e.g., "jdbc:postgresql://host:port/database?user=...").' },
    },
    required: ['uri'],
    needSession: true,
  },
  {
    name: 'dump_database_structure',
    func: dumpDatabaseStructure,
    params: ['uri'],
    description: 'Dumps the structure (tables, views, columns) of a database in JSON format. Requires a JDBC-like URI to connect.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
    },
    required: ['uri'],
    needSession: true,
  },
  {
    name: 'select_database_data',
    func: selectDatabaseData,
    params: ['uri', 'tableNameOrViewName', 'percentage'],
    description: 'Selects an optional percentage of data from a specified table or view in a database, returning the results in JSON format including column names. Defaults to 10% if percentage is not specified.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      tableNameOrViewName: { type: 'string', description: 'The name of the table or view to select data from.' },
      percentage: { type: 'number', description: 'Optional: The percentage of data to select (0-100). Defaults to 10% if not provided.' },
    },
    required: ['uri', 'tableNameOrViewName'],
    needSession: true,
  },
  {
    name: 'list_database_schemas',
    func: listDatabaseSchemas,
    params: ['uri'],
    description: 'Lists all schemas available in the connected database.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
    },
    required: ['uri'],
    needSession: true,
  },
  {
    name: 'list_schema_objects',
    func: listSchemaObjects,
    params: ['uri', 'schemaName', 'objectTypes'],
    description: 'Lists objects (tables, views, indexes, constraints) owned by a specific schema in a database. The type of objects to list can be specified, defaulting to all if not provided.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      schemaName: { type: 'string', description: 'The name of the schema to list objects from.' },
      objectTypes: {
        type: 'array',
        items: { type: 'string', enum: ['tables', 'views', 'indexes', 'constraints'] },
        description: 'Optional: An array of object types to list (e.g., ["tables", "views"]). Defaults to all types if not provided.',
      },
    },
    required: ['uri', 'schemaName'],
    needSession: true,
  },
  {
    name: 'run_adhoc_sql',
    func: runAdhocSql,
    params: ['uri', 'sqlQuery'],
    description: 'Executes any arbitrary SQL query against a connected relational database. This includes DML (INSERT, UPDATE, DELETE, SELECT) and DDL (CREATE, ALTER, DROP, etc.) statements, as well as stored procedure calls, triggers, and other advanced SQL commands. Returns query results for SELECT statements and affected rows for DML/DDL statements.',
    parametersSchema: {
      uri: { type: 'string', description: 'The JDBC-like URI for the database connection.' },
      sqlQuery: { type: 'string', description: 'The free-text SQL query to execute.' },
    },
    required: ['uri', 'sqlQuery'],
    needSession: true,
  },
];

const sshTargetSchema = {
  sshTarget: {
    type: 'string',
    description: 'Optional: The SSH target machine. If no user is specified it will be looked up. The password for this target will be looked up from a Docker secret map.',
  },
};

/** @type {ToolDefinition[]} */
const systemInfoTools = [
  {
    name: 'scan_network_for_ssh',
    func: scanNetworkForSSH,
    params: ['baseIp', 'startRange', 'endRange', 'port', 'timeout'],
    description: 'Scans a network range for hosts with SSH (port 22 by default) open. Returns a list of reachable SSH targets in the format "ip:port". Useful for discovering available SSH endpoints on a subnet.',
    parametersSchema: {
      baseIp: { type: 'string', description: 'The base IP address of the subnet to scan (e.g., "192.168.1").' },
      startRange: { type: 'number', description: 'The starting value for the last octet in the IP range (default: 1).' },
      endRange: { type: 'number', description: 'The ending value for the last octet in the IP range (default: 254).' },
      port: { type: 'number', description: 'The port to scan for SSH (default: 22).' },
      timeout: { type: 'number', description: 'Timeout in milliseconds for each connection attempt (default: 1000).' },
    },
    required: [],
    needSession: true,
  },
  {
    name: 'collect_basic_system_info',
    func: collectBasicSystemInfo,
    params: ['sshTarget'],
    description: 'Collects basic host machine information, including OS, CPU, memory and hardware details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    parametersSchema: sshTargetSchema,
    required: [],
    needSession: true,
  },
  {
    name: 'collect_detailed_system_info',
    func: collectDetailedSystemInfo,
    params: ['sshTarget'],
    description: 'Collects additional host machine information, including disk, kernal and network socket details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    parametersSchema: sshTargetSchema,
    required: [],
    needSession: true,
  },
  {
    name: 'test_ssh_connect',
    func: testSshConnect,
    params: ['sshTarget'],
    description: 'Perform a test connection only to a remote host via SSH, with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found. Returns a success message if works.',
    parametersSchema: sshTargetSchema,
    required: [],
    needSession: true,
  },
  {
    name: 'collect_system_process_info',
    func: collectProcessInfo,
    params: ['sshTarget'],
    description: 'Collects comprehensive host machine process information. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    parametersSchema: sshTargetSchema,
    required: [],
    needSession: true,
  },
  {
    name: 'collect_system_service_info',
    func: collectAllServicesInfo,
    params: ['sshTarget'],
    description: 'Collects comprehensive host machine network services, identified databases/services and service details. Returns the data in a structured JSON format. Can target a remote host via SSH with the username and password looked up from a Docker secret map if the username is not specified. Defaults to the Docker host if no SSH target is provided or password is not found.',
    parametersSchema: sshTargetSchema,
    required: [],
    needSession: true,
  },
];

/**
 * Builds the list of tool definitions that should be exposed by the MCP
 * server, gated by exactly the same environment variables that
 * `functions.js::loadIntegrations` used to check per-session. Since the MCP
 * server's tool set no longer varies per chatbot session, this is evaluated
 * once at server startup instead of once per session.
 * @returns {ToolDefinition[]} The tool definitions to register.
 */
function getToolDefinitions() {
  const tools = [];

  if (process.env.GITHUB_TOKEN) {
    tools.push(...gitHubTools, ...gitHubActionsTools, ...codeReviewTools);
  }

  if (process.env.AZURE_DEVOPS_PAT) {
    tools.push(...adoTools, ...adoCodeReviewTools);
  }

  if (
    process.env.DOSA_API_KEY
    && process.env.DOSA_API_SECRET
    && process.env.DOSA_AUTH_TENANT_ID
    && process.env.DOSA_CLIENT_ID
  ) {
    tools.push(...dosaTools);
  }

  if (process.env.MAPS_API_KEY) {
    tools.push(...mappingTools);
  }

  if (process.env.KUBERNETES_API_ENDPOINT && process.env.KUBERNETES_BEARER_TOKEN) {
    tools.push(...kubernetesTools, ...dockerHubTools);
  }

  if (process.env.DATABASE_URI) {
    tools.push(...databaseTools);
  }

  // System information tools are always available, matching the original
  // unconditional call to loadSystemInfoFunctions in loadIntegrations.
  tools.push(...systemInfoTools);

  return tools;
}

module.exports = { getToolDefinitions };
