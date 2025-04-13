const path = require('path');
const fs = require('fs');

const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'AIBot';
const githubToken = process.env.GITHUB_TOKEN;
const superagent = require('superagent');
const logger = require('./logger');

/**
 * Handles "Not Found" errors from the GitHub API.
 * If the error message indicates "Not Found", it throws a more
 * user-friendly error suggesting the user reword their request.
 * Otherwise, it re-throws the original error.
 * @param {Error} error The error object caught from the API call.
 * @param {string} [context=''] Optional context for the error message.
 * @throws {Error} Modified error for "Not Found" or the original.
 */
function handleNotFoundError(error, context = '') {
  if (error.message === 'Not Found') {
    throw new Error(`${error} ${context}: Please reword the request as it was not understood`);
  }
  throw error;
}

/**
 * Logs and throws a custom error for GitHub API responses that
 * indicate an error status. Includes status, text, and body message.
 * @param {object} response The SuperAgent response object.
 * @param {string} [context=''] Optional context for the error message.
 * @throws {Error} Custom error detailing the GitHub API error.
 */
async function handleGitHubApiError(response, context = '') {
  logger.error(`GitHub API Error ${context} (status):`, response.status,
    response.statusText, response.body);
  let errorMessage = `GitHub API Error ${context}: ${response.status} - ${response.statusText}`;
  if (response.body && response.body.message) {
    errorMessage += ` - ${response.body.message}`;
  }
  throw new Error(errorMessage);
}

/**
* Helper function to download a file from a URL using Superagent.
* @param {string} url - The URL to download from.
* @param {string} localFilePath - The local path to save the file.
* @param {string|null} [token=null] - Optional GitHub token (usually not needed for download_url).
*/
async function downloadFile(url, localFilePath, token = null) {
  try {
    // --- Superagent File Download ---
    const request = superagent.get(url);
    request.set('User-Agent', USER_AGENT);
    if (token) { request.set('Authorization', `token ${token}`); }

    request.buffer(true); // Tell superagent to receive the response body as a Buffer
    request.parse(superagent.parse['application/octet-stream']); // Treat response as binary

    const response = await request;
    // response.body should now be a Node.js Buffer
    if (Buffer.isBuffer(response.body)) {
      await fs.writeFile(localFilePath, response.body);
      // console.log(`  Downloaded: ${url} -> ${localFilePath}`);
    } else {
      throw new Error(`  Error downloading ${url}: Expected Buffer, received ${typeof response.body}`);
    }
  } catch (error) {
    logger.error('Error downloading (exception):', url, localFilePath, error);
    handleNotFoundError(error, ' for repository ${username}/${repoName}"');
  }
}

/**
* Recursively fetches files and directories from a GitHub repository
*
* @param {string} username - The owner of the repository (user or organization).
* @param {string} repoName - The name of the repository.
* @param {string} repoPath - The starting path within the repository (use '' or '/' for the root).
* @param {string} localDestPath - The local directory path where content should be saved.
* @param {boolean} [includeDotGithub=true] - Whether to include the .github directory nor not
*/
async function fetchRepoContentsRecursive(
  username,
  repoName,
  repoPath,
  localDestPath,
  includeDotGithub = true,
) {
  const apiUrl = `https://api.github.com/repos/${username}/${repoName}/contents/${repoPath}`;

  try {
    // Ensure the local destination directory exists for the current level
    await fs.mkdir(localDestPath, { recursive: true });

    // --- Superagent Request ---
    const request = superagent.get(apiUrl);
    request.set('Accept', 'application/vnd.github.v3+json');
    request.set('User-Agent', USER_AGENT); // Identify script
    request.set('Authorization', `token ${githubToken}`);

    const response = await request; // Await the request promise
    const items = response.body; // Superagent parses JSON response body by default

    if (!Array.isArray(items)) {
      logger.error(`Error: Expected an array of items from API for path "${repoPath}", but received:`, typeof items);
      // Handle potential single file response if repoPath points directly to a file
      if (items && items.type === 'file' && items.download_url) {
        const filePath = path.join(localDestPath, items.name);
        await downloadFile(items.download_url, filePath, githubToken);
      }
      return; // Stop processing this path if response is not an array
    }

    /* eslint-disable no-continue, no-restricted-syntax, no-await-in-loop, consistent-return */
    for (const item of items) {
      const currentRepoPath = item.path; // Full path from repo root
      const currentLocalPath = path.join(localDestPath, item.name);

      if (!includeDotGithub && (item.name === '.github' || currentRepoPath.startsWith('.github/'))) {
        continue;
      }

      if (item.type === 'file') {
        if (item.download_url) {
          await downloadFile(item.download_url, currentLocalPath, githubToken);
        }
      } else if (item.type === 'dir') {
        await fetchRepoContentsRecursive(
          username,
          repoName,
          item.path,
          currentLocalPath,
          includeDotGithub,
          githubToken,
        );
      } else if (item.type === 'symlink') {
        // logger.warn(` Skipping symlink: ${item.name} (content not fetched)`);
      } else if (item.type === 'submodule') {
        // logger.warn(` Skipping submodule: ${item.name} (content not fetched)`);
      } else {
        // logger.warn(` Unknown item type "${item.type}" for item: ${item.name}`);
      }
    }
    /* eslint-enable no-continue, no-restricted-syntax, no-await-in-loop, consistent-return */
  } catch (error) {
    logger.error('Error downloading (exception):', repoPath, error);
    handleNotFoundError(error, ' for repository ${username}/${repoName}"');
  }
}

/* eslint-disable no-restricted-syntax, no-await-in-loop, consistent-return */
/**
 * Lists the names of public repositories for a given GitHub username.
 * Fetches repo data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @returns {Promise<string[]>} Array of public repository names.
 * @throws {Error} If API request fails or user is not found.
 */
async function listPublicRepos(username) {
  const url = `https://api.github.com/users/${username}/repos`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/json')
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      return response.body.map((repo) => repo.name);
    }
    await handleGitHubApiError(response, `listing repos for user "${username}"`);
  } catch (error) {
    logger.error('Error listing repos (exception):', username, error);
    handleNotFoundError(error, ` for user "${username}"`);
  }
}

/**
 * Lists the names of branches for a given GitHub repository.
 * Fetches branch data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The name of the repository.
 * @returns {Promise<string[]>} Array of branch names.
 * @throws {Error} If API request fails or repository is not found.
 */
async function listBranches(username, repoName) {
  const url = `https://api.github.com/repos/${username}/${repoName}/branches`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/json')
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      return response.body.map((branch) => branch.name);
    }
    await handleGitHubApiError(response, 'listing branches for ${username}/${repoName}"');
  } catch (error) {
    logger.error('Error listing branches (exception):', username, repoName, error);
    handleNotFoundError(error, ' for repository ${username}/${repoName}"');
  }
}

/**
 * Lists commit history for a specific file in a given GitHub repository.
 * Fetches commit data and extracts SHA, message, author, and date.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The name of the repository.
 * @param {string} filePath The path to the file within the repository.
 * @returns {Promise<Array<{ sha: string, message: string, author: string, date: string }>>}
 * Array of commit history objects.
 * @throws {Error} If API request fails or file/repository not found.
 */
async function listCommitHistory(username, repoName, filePath) {
  const url = `https://api.github.com/repos/${username}/${repoName}/commits?path=${filePath}`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/json')
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      return response.body.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
      }));
    }
    await handleGitHubApiError(response, 'listing commit history for ${filePath}" in "${username}/{repoName}"');
  } catch (error) {
    logger.error('Error listing commit history (exception):', username, repoName, filePath, error);
    handleNotFoundError(error, ' for file ${filePath}" in "${username}/{repoName}"');
  }
}

/**
 * Lists the contents of a directory (or root if no path) in a GitHub repo.
 * Fetches content data and extracts name, type ('file'/'dir'), and path.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The name of the repository.
 * @param {string} [xpath=''] Optional path to the directory.
 * @returns {Promise<Array<{ name: string, type: string, path: string }>>}
 * Array of directory content objects.
 * @throws {Error} If API request fails or repository/path not found.
 */
async function listDirectoryContents(username, repoName, xpath = '') {
  const url = `https://api.github.com/repos/${username}/${repoName}/contents/${path}`;
  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/json')
      .set('User-Agent', USER_AGENT);

    if (response.status === 200) {
      return response.body.map((item) => ({
        name: item.name,
        type: item.type, // "file" or "dir"
        path: item.path,
      }));
    }
    await handleGitHubApiError(response, 'listing directory contents for ${path}" in "${username}/{repoName}"');
  } catch (error) {
    logger.error('Error listing directories (exception):', username, repoName, xpath, error);
    handleNotFoundError(error, ' for path ${xpath}" in "${username}/{repoName}"');
  }
}

/**
 * Creates a pull request on a given GitHub repository.
 * Sends a POST request to the GitHub API.
 * Handles API errors, including specific GitHub errors.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The name of the repository.
 * @param {string} title The title of the pull request.
 * @param {string} sourceBranch The branch to merge from.
 * @param {string} targetBranch The branch to merge into.
 * @param {string} [body=''] Optional body of the pull request.
 * @returns {Promise<object>} GitHub API response for the created PR.
 * @throws {Error} If API request fails, repo/branches not found, or validation errors.
 */
async function createGithubPullRequest(
  username,
  repoName,
  title,
  sourceBranch,
  targetBranch,
  body = '',
) {
  const url = 'https://api.github.com/repos/${username}/${repoName}/pulls';
  const postData = {
    title, head: sourceBranch, base: targetBranch, body,
  };

  try {
    const response = await superagent
      .post(url)
      .set('Authorization', `token ${githubToken}`)
      .set('Accept', 'application/vnd.github+json')
      .set('User-Agent', USER_AGENT)
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION)
      .send(postData);

    if ([200, 201].includes(response.status)) {
      return response.body;
    }
    await handleGitHubApiError(response, 'creating pull request for ${username}/${repoName}"');
  } catch (error) {
    if (error.response) {
      logger.error(`Error creating pull request (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Check repo and branch names.');
      }
      if (error.response.body && error.response.body.errors
        && error.response.body.errors.length > 0) {
        throw new Error(error.response.body.errors[0].message);
      }
      throw new Error(error.response.body.message || 'Failed to create PR');
    } else {
      throw error;
    }
  }
}

/**
 * Lists running or queued GitHub Actions workflows and their jobs.
 * Fetches workflow runs by status, then fetches jobs for each run.
 * Filters jobs by 'queued' or the provided status.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The name of the repository.
 * @param {string} [status='in_progress'] Status to filter workflows (optional).
 * @returns {Promise<Array<{ workflow_run_id: number, workflow_name: string,
 *           job_id: number, job_name: string, html_url: string, status: string,
 *           started_at: string }>>}
 * Array of running/queued GitHub Action job details.
 * @throws {Error} If API request fails or repository/user not found.
 */
async function listGitHubActions(username, repoName, status = 'in_progress') {
  const urlRuns = `https://api.github.com/repos/${username}/${repoName}/actions/runs?status=${status}`;
  try {
    const runsResponse = await superagent
      .get(urlRuns)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/vnd.github+json')
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION)
      .set('User-Agent', USER_AGENT);

    const runsData = runsResponse.body;

    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      return [];
    }

    const runningJobs = [];
    for (const run of runsData.workflow_runs) {
      const urlJobs = `https://api.github.com/repos/${username}/${repoName}/actions/runs/${run.id}/jobs`;
      const jobsResponse = await superagent
        .get(urlJobs)
        .set('Authorization', `Bearer ${githubToken}`)
        .set('Accept', 'application/vnd.github+json')
        .set('X-GitHub-Api-Version', GITHUB_API_VERSION)
        .set('User-Agent', USER_AGENT);

      const jobsData = jobsResponse.body;

      if (jobsData.jobs) {
        jobsData.jobs.forEach((job) => {
          if (job.status === 'queued' || job.status === status) {
            runningJobs.push({
              workflow_run_id: run.id,
              workflow_name: run.name,
              job_id: job.id,
              job_name: job.name,
              html_url: job.html_url,
              status: job.status,
              started_at: job.started_at,
            });
          }
        });
      }
    }
    return runningJobs;
  } catch (error) {
    logger.error('Error listing actions (exception):', username, repoName, status, error);
    if (error.response) {
      logger.error(`Error listing actions (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Check user and repo names.');
      }
      if (error.response.body && error.response.body.errors
        && error.response.body.errors.length > 0) {
        throw new Error(error.response.body.errors[0].message);
      }
      throw new Error(error.response.body.message || 'Failed to list actions');
    } else {
      throw error;
    }
  }
}

/* eslint-enable no-restricted-syntax, no-await-in-loop, consistent-return */

/** Registry of available GitHub functions for AI. */
const availableFunctionsRegistry = {
  create_pull_request: {
    func: createGithubPullRequest,
    params: ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'],
  },
  fetch_repo_contents: {
    func: fetchRepoContentsRecursive,
    params: ['username', 'repoName', 'repoPath', 'localDestPath', 'includeDotGithub'],
  },
  list_actions: {
    func: listGitHubActions,
    params: ['username', 'repoName', 'status'],
  },
  list_public_repos: {
    func: listPublicRepos,
    params: ['username'],
  },
  list_branches: {
    func: listBranches,
    params: ['username', 'repoName'],
  },
  list_commit_history: {
    func: listCommitHistory,
    params: ['username', 'repoName', 'filePath'],
  },
  list_directory_contents: {
    func: listDirectoryContents,
    params: ['username', 'repoName', 'path'],
  },
};

/** Metadata for GitHub functions as AI tools. */
const funcs = [
  {
    type: 'function',
    function: {
      name: 'create_pull_request',
      description: 'Create a pull request on a given GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
          title: { type: 'string', description: 'The Pull Request title.' },
          sourceBranch: { type: 'string', description: 'The source branch name.' },
          targetBranch: { type: 'string', description: 'The target branch name.' },
          body: { type: 'string', description: 'The description or body of the pull request.' },
        },
        required: ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_repo_contents',
      description: 'Fetch or download the contents of a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
          repoPath: { type: 'string', description: 'The GitHub repository path to start download at.' },
          localDestPath: { type: 'string', description: 'The target local directory path.' },
        },
        required: ['username', 'repoName', 'repoPath', 'localDestPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_public_repos',
      description: 'Lists public repositories for a given GitHub username.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
        },
        required: ['username'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_actions',
      description: 'Lists the GitHub actions running in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
          status: { type: 'string', description: 'The status of the actions (optional). Defaults to in_progress if not provided' },
        },
        required: ['username', 'repoName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_branches',
      description: 'Lists branches for a given GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
        },
        required: ['username', 'repoName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_commit_history',
      description: 'Lists commit history for a file in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
          filePath: { type: 'string', description: 'The file path.' },
        },
        required: ['username', 'repoName', 'filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory_contents',
      description: 'Lists the contents of a directory in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'The GitHub username.' },
          repoName: { type: 'string', description: 'The repository name.' },
          path: { type: 'string', description: 'The directory path (optional). Defaults to root if not provided' },
        },
        required: ['username', 'repoName'],
      },
    },
  },
];

// Define the getFunctionDefinitionsForTool function
function getFunctionDefinitionsForTool() {
  return funcs;
}

function getAvailableFunctions() {
  return availableFunctionsRegistry;
}

module.exports = {
  createGithubPullRequest,
  getAvailableFunctions,
  getFunctionDefinitionsForTool, // Renamed function
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listGitHubActions,
  listPublicRepos,
};
