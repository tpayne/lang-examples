const superagent = require('superagent');
const AdmZip = require('adm-zip');
const logger = require('./logger');

// GitHub Actions specific constants - these would ideally come from environment variables or configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'AIBot';
const githubToken = process.env.GITHUB_TOKEN;

/**
 * Lists all workflows in a given GitHub repository.
 * @param {string} username - The username of the repository.
 * @param {string} repoName - The name of the repository.
 * @returns {Promise<any>} - A promise that resolves with the list of workflows.
 */

async function listGithubWorkflows(username, repoName) {
  try {
    const url = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/workflows`;
    logger.debug(`Listing GitHub workflows for ${username}/${repoName} at ${url}`);
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('User-Agent', USER_AGENT)
      .set('Accept', 'application/vnd.github+json')
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION);

    return response.body;
  } catch (err) {
    logger.error(`Failed to list GitHub workflows for ${username}/${repoName}: ${err.message}`);
    if (err.response) {
      logger.error(`GitHub API response: ${err.response.text}`);
      if (err.response.status === 404) {
        throw new Error('Not Found: Check user and repo names.');
      }
      if (err.response.body && err.response.body.errors && err.response.body.errors.length > 0) {
        throw new Error(err.response.body.errors[0].message);
      }
      throw new Error(err.response.body.message || 'Failed to list GitHub workflows');
    } else {
      throw err;
    }
  }
}

/**
 * Dispatches a 'workflow_dispatch' event to trigger a workflow.
 * @param {string} username - The username of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {string} workflowId - The ID or file name of the workflow to trigger.
 * @param {string} ref - The Git reference (branch, tag, or SHA).
 * @param {object} inputs - The inputs for the workflow_dispatch event.
 * @returns {Promise<any>} - A promise that resolves with the API response.
 */
async function createGithubWorkflowDispatch(username, repoName, workflowId, ref, inputs) {
  try {
    const url = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/workflows/${workflowId}/dispatches`;
    logger.debug(`Triggering GitHub workflow ${workflowId} with inputs: ${JSON.stringify(inputs)}, for url ${url}`);
    const payload = inputs ? { ref, inputs } : { ref };
    const response = await superagent
      .post(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/vnd.github.v3+json')
      .set('User-Agent', USER_AGENT)
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION)
      .send(payload);

    return response.body;
  } catch (err) {
    logger.error(`Failed to list GitHub workflows for ${username}/${repoName}: ${err.message}`);
    if (err.response) {
      logger.error(`GitHub API response: ${err.response.text}`);
      if (err.response.status === 404) {
        throw new Error('Not Found: Check user and repo names.');
      }
      if (err.response.body && err.response.body.errors && err.response.body.errors.length > 0) {
        throw new Error(err.response.body.errors[0].message);
      }
      throw new Error(err.response.body.message || 'Failed to list GitHub workflows');
    } else {
      throw err;
    }
  }
}

/**
 * Lists all workflow runs for a given GitHub repository.
 * @param {string} username - The username of the repository.
 * @param {string} repoName - The name of the repository.
 * @returns {Promise<any>} - A promise that resolves with the list of workflow runs.
 */
async function listGithubWorkflowRuns(username, repoName) {
  try {
    const url = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/runs`;
    logger.debug(`Listing GitHub workflow runs for ${username}/${repoName} at ${url}`);
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/vnd.github+json')
      .set('User-Agent', USER_AGENT)
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION);

    return response.body;
  } catch (err) {
    logger.error('Failed to list GitHub workflow runs', err);
    throw err;
  }
}

/**
 * Deletes a specific workflow run from a repository.
 * @param {string} username - The username of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {string} runId - The ID of the workflow run to delete.
 * @returns {Promise<any>} - A promise that resolves with the API response.
 */
async function deleteGithubWorkflowRun(username, repoName, runId) {
  try {
    const url = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/runs/${runId}`;
    logger.debug(`Deleting GitHub workflow run ${runId} for ${username}/${repoName} at ${url}`);
    const response = await superagent
      .delete(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/vnd.github+json')
      .set('User-Agent', USER_AGENT)
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION);

    // A successful deletion returns a 204 No Content status.
    return response;
  } catch (err) {
    logger.error('Failed to delete GitHub workflow run', err);
    throw err;
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
 * job_id: number, job_name: string, html_url: string, status: string,
 * started_at: string }>>}
 * Array of running/queued GitHub Action job details.
 * @throws {Error} If API request fails or repository/user not found.
 */
async function listGitHubActions(username, repoName, status = 'in_progress') {
  const urlRuns = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/runs?status=${status}`;
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

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    const runningJobs = [];
    for (const run of runsData.workflow_runs) {
      const urlJobs = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/runs/${run.id}/jobs`;
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
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
    return runningJobs;
  } catch (error) {
    logger.error(`Error listing actions (exception): ${username} ${repoName} ${status} ${error}`);
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

/**
 * Gets the logs for a specific workflow run.
 * @param {string} username - The username of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {string} runId - The ID of the workflow run.
 * @returns {Promise<any>} - A promise that resolves with the log data.
 */
async function getGithubWorkflowRunLogs(username, repoName, runId) {
  try {
    const url = `${GITHUB_API_URL}/repos/${username}/${repoName}/actions/runs/${runId}/logs`;
    logger.debug(`Getting logs for GitHub workflow run ${runId} for ${username}/${repoName} at ${url}`);
    const response = await superagent
      .get(url)
      .set('Authorization', `Bearer ${githubToken}`)
      .set('Accept', 'application/vnd.github+json')
      .set('User-Agent', USER_AGENT)
      .set('X-GitHub-Api-Version', GITHUB_API_VERSION);

    // The logs are returned as a ZIP file, so we might need to handle that.
    // The logs are returned as a ZIP file, so we need to extract and parse them.
    const zip = new AdmZip(response.body);
    const zipEntries = zip.getEntries();

    // Convert each file in the zip to a JSON element: { filename, content }
    const files = zipEntries.map((entry) => ({
      filename: entry.entryName,
      content: entry.getData().toString('utf8'),
    }));

    return files;
  } catch (err) {
    logger.error('Failed to get GitHub workflow run logs', err);
    throw err;
  }
}

module.exports = {
  createGithubWorkflowDispatch,
  deleteGithubWorkflowRun,
  getGithubWorkflowRunLogs,
  listGithubWorkflowRuns,
  listGithubWorkflows,
  listGitHubActions,
};
