const superagent = require('superagent');
const logger = require('./logger');

const githubToken = process.env.GITHUB_TOKEN;
const USER_AGENT = 'AIBot';
const GITHUB_API_VERSION = '2022-11-28';

function handleNotFoundError(error, context = '') {
  if (error.message === 'Not Found') {
    throw new Error(`${error}${context}: Please reword the request as it was not understood`);
  }
  throw error;
}

async function handleGitHubApiError(response, context = '') {
  logger.error(`GitHub API Error ${context} (status):`, response.status, response.statusText, response.body);
  let errorMessage = `GitHub API Error ${context}: ${response.status} - ${response.statusText}`;
  if (response.body && response.body.message) {
    errorMessage += ` - ${response.body.message}`;
  }
  throw new Error(errorMessage);
}

/* eslint-disable no-restricted-syntax, no-await-in-loop, consistent-return */
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
    await handleGitHubApiError(response, `listing branches for "${username}/${repoName}"`);
  } catch (error) {
    logger.error('Error listing branches (exception):', username, repoName, error);
    handleNotFoundError(error, ` for repository "${username}/${repoName}"`);
  }
}

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
    await handleGitHubApiError(response, `listing commit history for "${filePath}" in "${username}/${repoName}"`);
  } catch (error) {
    logger.error('Error listing commit history (exception):', username, repoName, filePath, error);
    handleNotFoundError(error, ` for file "${filePath}" in "${username}/${repoName}"`);
  }
}

async function listDirectoryContents(username, repoName, path = '') {
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
    await handleGitHubApiError(response, `listing directory contents for "${path}" in "${username}/${repoName}"`);
  } catch (error) {
    logger.error('Error listing directories (exception):', username, repoName, path, error);
    handleNotFoundError(error, ` for path "${path}" in "${username}/${repoName}"`);
  }
}

async function createGithubPullRequest(
  username,
  repoName,
  title,
  sourceBranch,
  targetBranch,
  body = '',
) {
  const url = `https://api.github.com/repos/${username}/${repoName}/pulls`;
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
    await handleGitHubApiError(response, `creating pull request for "${username}/${repoName}"`);
  } catch (error) {
    if (error.response) {
      logger.error(`Error creating pull request (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Please check the repository and branch names.');
      }
      if (error.response.body && error.response.body.errors && 
          error.response.body.errors.length > 0) {
        throw new Error(error.response.body.errors[0].message);
      }
      throw new Error(error.response.body.message || 'Failed to create pull request');
    } else {
      throw error;
    }
  }
}

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
        throw new Error('Not Found: Please check the repository and user names.');
      }
      if (error.response.body && error.response.body.errors && 
          error.response.body.errors.length > 0) {
        throw new Error(error.response.body.errors[0].message);
      }
      throw new Error(error.response.body.message || 'Failed to list actions');
    } else {
      throw error;
    }
  }
}

/* eslint-enable no-restricted-syntax, no-await-in-loop, consistent-return */

const availableFunctionsRegistry = {
  create_pull_request: {
    func: createGithubPullRequest,
    params: ['username', 'repoName', 'title', 'sourceBranch', 'targetBranch', 'body'], // Explicit parameter order
  },
  list_actions: {
    func: listGitHubActions,
    params: ['username', 'repoName', 'status'], // Explicit parameter order
  },
  list_public_repos: {
    func: listPublicRepos,
    params: ['username'], // Explicit parameter order
  },
  list_branches: {
    func: listBranches,
    params: ['username', 'repoName'], // Explicit parameter order
  },
  list_commit_history: {
    func: listCommitHistory,
    params: ['username', 'repoName', 'filePath'], // Explicit parameter order
  },
  list_directory_contents: {
    func: listDirectoryContents,
    params: ['username', 'repoName', 'path'], // Explicit parameter order
  },
};

// Define the array of functions metadata for tools
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
