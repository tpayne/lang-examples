const superagent = require('superagent');
const logger = require('./logger');

const githubToken = process.env.GITHUB_TOKEN;

// Define the array of functions
const funcs = [
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

async function listPublicRepos(username) {
  try {
    const response = await superagent
      .get(`https://api.github.com/users/${username}/repos`)
      .set('Authorization', githubToken) // Use the token directly
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((repo) => repo.name); // Use response.body instead of response.data
    }
    logger.error('Error listing repos (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing repos (exception):', error);
    throw error;
  }
}

async function listBranches(username, repoName) {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/branches`)
      .set('Authorization', githubToken) // Use the token directly
      .set('Accept', 'application/json') // Optional: Set the Accept header
      .set('User-Agent', 'YourAppName'); // Set a User-Agent header

    // Check if the response is OK
    if (response.status === 200) {
      return response.body.map((branch) => branch.name);
    }
    logger.error('Error listing repos (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing repos (exception):', error);
    throw error;
  }
}

async function listCommitHistory(username, repoName, filePath) {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/commits?path=${filePath}`)
      .set('Authorization', githubToken) // Use the token directly
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
    logger.error('Error listing repos (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing repos (exception):', error);
    throw error;
  }
}

async function listDirectoryContents(username, repoName, path = '') {
  try {
    const response = await superagent
      .get(`https://api.github.com/repos/${username}/${repoName}/contents/${path}`)
      .set('Authorization', githubToken) // Use the token directly
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
    logger.error('Error listing repos (status):', response.status, response.statusText);
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  } catch (error) {
    logger.error('Error listing repos (exception):', error);
    throw error;
  }
}

module.exports = {
  getFunctions,
  listBranches,
  listCommitHistory,
  listDirectoryContents,
  listPublicRepos,
};
