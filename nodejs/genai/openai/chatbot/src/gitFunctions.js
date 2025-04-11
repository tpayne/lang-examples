const superagent = require('superagent');
const util = require('util');
const logger = require('./logger');

const githubToken = process.env.GITHUB_TOKEN;

async function listPublicRepos(username) {
  try {
    const response = await superagent
      .get(`https://api.github.com/users/${username}/repos`)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((repo) => repo.name);
    }
    logger.error('Error listing repos (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing repos (exception):', error);
    if (error.message === 'Not Found') {
      throw new Error(`${error}: Please reword the request as it was not understood`);
    }
    throw error;
  }
}

async function listBranches(username, repoName) {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/branches`)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((branch) => branch.name);
    }
    logger.error('Error listing branches (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing branches (exception):', error);
    if (error.message === 'Not Found') {
      throw new Error(`${error}: Please reword the request as it was not understood`);
    }
    throw error;
  }
}

async function listCommitHistory(username, repoName, filePath) {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/commits?path=${filePath}`)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
      }));
    }
    logger.error('Error listing commit history (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing commit history (exception):', error);
    if (error.message === 'Not Found') {
      throw new Error(`${error}: Please reword the request as it was not understood`);
    }
    throw error;
  }
}

async function listDirectoryContents(username, repoName, path = '') {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/contents/${path}`)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((item) => ({
        name: item.name,
        type: item.type, // "file" or "dir"
        path: item.path,
      }));
    }
    logger.error('Error listing directories (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing directories (exception):', error);
    if (error.message === 'Not Found') {
      throw new Error(`${error}: Please reword the request as it was not understood`);
    }
    throw error;
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
    title,
    head: sourceBranch,
    base: targetBranch,
    body,
  };

  try {
    const response = await superagent
      .post(url)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/vnd.github+json')
      .set('User-Agent', 'YourAppName') // Set a User-Agent header
      .set('X-GitHub-Api-Version', '2022-11-28')
      .send(postData); // Send the data as JSON

    if ([200, 201].includes(response.status)) {
      return response.body; // Return the pull request object
    }
    logger.error('Error creating pull request (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    if (error.response) {
      logger.error(`Error creating pull request (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Please check the repository and branch names.');
      }
      if (error.response.text) {        
        throw new Error(error.response.body.errors[0].message);
      }
      throw new Error(error.response.body.message || 'Failed to create pull request');
    } else {
      throw error; // Rethrow the error if it doesn't have a response
    }
  }
}

async function listGitHubActions(username, repoName, status = 'in_progress') {
  try {
    // Fetch in-progress workflow runs
    const runsResponse = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/actions/runs?status=${status}`)
      .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
      .set('Accept', 'application/vnd.github+json') // Optional: Set the Accept header
      .set('X-GitHub-Api-Version', '2022-11-28')
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    const runsData = runsResponse.body;

    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      return []; // No workflow runs found
    }

    const runningJobs = [];

    /* eslint-disable no-restricted-syntax, no-await-in-loop */

    // Fetch jobs for each workflow run
    for (const run of runsData.workflow_runs) {
      const jobsResponse = await superagent
        .get(`https://api.github.com/repos/${username}/${repoName}/actions/runs/${run.id}/jobs`)
        .set('Authorization', `token ${githubToken}`) // Ensure token is prefixed with 'token '
        .set('Accept', 'application/vnd.github+json') // Optional: Set the Accept header
        .set('X-GitHub-Api-Version', '2022-11-28')
        .set('User-Agent', 'YourAppName'); // Set a User-Agent header
  
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
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    return runningJobs; // Return the array of running jobs
  } catch (error) {
    logger.error('Error listing jobs (exception):', error);
    if (error.message === 'Not Found') {
      throw new Error(`${error}: Please reword the request as it was not understood`);
    }
    if (error.response) {
      throw new Error(error.response.body.message || 'Failed to fetch build jobs');
    } else {
      throw error; // Rethrow the error if it doesn't have a response
    }
  }
}

const availableFunctions = {
  create_pull_request: createGithubPullRequest,
  list_actions: listGitHubActions,
  list_public_repos: listPublicRepos,
  list_branches: listBranches,
  list_commit_history: listCommitHistory,
  list_directory_contents: listDirectoryContents,
};

// Define the array of functions
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

// Define the getFunctions function
function getFunctions() {
  return funcs;
}

function getAvailableFunctions() {
  return availableFunctions;
}

module.exports = {
  createGithubPullRequest,
  getAvailableFunctions,
  getFunctions,
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listPublicRepos,
};
