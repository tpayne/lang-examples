const superagent = require('superagent');
const logger = require('./logger');

const { getRepoByName } = require('./adoFunctions');

// Azure DevOps specific constants - these would ideally come from environment variables or configuration
const AZURE_DEVOPS_API_VERSION = '7.1'; // API version
const { AZURE_DEVOPS_PAT } = process.env; // Personal Access Token
const USER_AGENT = 'AIBot-AzureDevOps'; // Custom user agent
const ADO_BASEURI = 'https://dev.azure.com';

/**
 * Encodes a Personal Access Token for Basic Authentication.
 * @param {string} pat The Azure DevOps Personal Access Token.
 * @returns {string} Base64 encoded string for the Authorization header.
 */
function encodePat(pat) {
  return Buffer.from(`:${pat}`).toString('base64');
}

/**
 * Retrieves the Azure DevOps project ID by its name within a specified organization.
 *
 * @async
 * @function
 * @param {string} organization - The name of the Azure DevOps organization.
 * @param {string} projectName - The name of the project to search for.
 * @returns {Promise<string>} The ID of the matching project.
 * @throws {Error} If the project is not found or if an error occurs during the API request.
 */
async function getprojectByName(organization, projectName) {
  const url = `${ADO_BASEURI}/${organization}/_apis/projects`;
  logger.debug(`Retrieving project ID for project "${projectName}" in organization "${organization}"`);

  try {
    const response = await superagent
      .get(url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .query({ 'api-version': AZURE_DEVOPS_API_VERSION });

    const match = response.body.value.find((p) => p.name.toLowerCase() === projectName.toLowerCase());

    if (!match) {
      throw new Error(`Project "${projectName}" not found in organization "${organization}".`);
    }

    return match.id;
  } catch (error) {
    logger.error(`Error retrieving project ID: ${error.message}`);
    if (error.response) {
      logger.error('Response status:', error.response.status);
      logger.error('Response body:', error.response.text);
    }
    throw error;
  }
}

/**
 * Makes an authenticated request to the Azure DevOps API.
 * @param {string} method HTTP method (GET, POST, etc.).
 * @param {string} url The API endpoint URL.
 * @param {object} [data] Request body for POST/PUT requests.
 * @returns {Promise<object>} The response body.
 * @throws {Error} If the request fails.
 */
async function adoApiRequest(method, url, data = null) {
  if (!AZURE_DEVOPS_PAT) {
    throw new Error('AZURE_DEVOPS_PAT environment variable is not set.');
  }

  logger.debug(`Making ${method} request to Azure DevOps API: ${url}`);

  try {
    const request = superagent(method, url)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT)
      .set('Content-Type', 'application/json')
      .query({ 'api-version': AZURE_DEVOPS_API_VERSION });

    if (data) request.send(data);

    const response = await request;
    return response.body;
  } catch (error) {
    logger.error(`Azure DevOps API request failed: ${error.message}`);
    logger.error(`Request URL: ${url}`);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response body: ${error.response.text}`);
    }
    throw new Error(`Failed to communicate with Azure DevOps: ${error.message}`);
  }
}

/**
 * Lists running or queued Azure DevOps Pipelines builds and their jobs.
 * This is a significant re-write from GitHub Actions.
 * @async
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The Azure DevOps project name.
 * @param {string} repoName The name of the repository.
 * @param {string} [statusFilter='all'] Status to filter builds (e.g., 'inProgress', 'queued', 'completed').
 * @returns {Promise<Array<{ buildId: number, buildNumber: string, definitionName: string,
 * jobName: string, status: string, url: string, startTime: string }>>}
 * Array of running/queued Azure DevOps Pipeline job details.
 * @throws {Error} If API request fails or repository/project/organization not found.
 */
async function listAdoPipelines(organization, project, repoName, statusFilter = 'all') {
  // First, get the repository ID from its name
  const repo = await getRepoByName(organization, project, repoName);
  const repoId = repo.id;

  const urlRuns = `${ADO_BASEURI}/${organization}/${project}/_apis/build/builds?repositoryId=${repoId}&repositoryType=TfsGit&statusFilter=${statusFilter}&api-version=${AZURE_DEVOPS_API_VERSION}`;
  try {
    const runsResponse = await superagent
      .get(urlRuns)
      .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
      .set('User-Agent', USER_AGENT);

    const builds = runsResponse.body.value;

    if (!builds || builds.length === 0) {
      return [];
    }

    // Refactor to use Promise.all for concurrent timeline fetching
    const pipelineJobsPromises = builds.map(async (build) => {
      const urlTimeline = `${ADO_BASEURI}/${organization}/${project}/_apis/build/builds/${build.id}/timeline?api-version=${AZURE_DEVOPS_API_VERSION}`;
      const timelineResponse = await superagent
        .get(urlTimeline)
        .set('Authorization', `Basic ${encodePat(AZURE_DEVOPS_PAT)}`)
        .set('User-Agent', USER_AGENT);

      const timeline = timelineResponse.body.records;
      const jobsForBuild = [];

      if (timeline) {
        timeline.forEach((record) => {
          if (record.type === 'Job' && (record.state !== 'completed')) {
            jobsForBuild.push({
              buildId: build.id,
              buildNumber: build.buildNumber,
              definitionName: build.definition ? build.definition.name : 'N/A',
              jobName: record.name,
              status: record.state,
              url: record.url, // URL specific to this timeline record
              startTime: record.startTime,
            });
          }
        });
      }
      return jobsForBuild;
    });

    const allPipelineJobsArrays = await Promise.all(pipelineJobsPromises);
    // Flatten the array of arrays into a single array
    const allPipelineJobs = [].concat(...allPipelineJobsArrays);

    return allPipelineJobs;
  } catch (error) {
    logger.error(`Error listing Azure DevOps Pipelines (exception): ${organization} ${project} ${repoName} ${statusFilter} ${error}`);
    if (error.response) {
      logger.error(`Error listing pipelines (exception): ${error.response.text}`);
      if (error.response.status === 404) {
        throw new Error('Not Found: Check organization, project, and repo names.');
      }
      throw new Error(error.response.body.message || 'Failed to list pipelines');
    }
    throw error;
  }
}

/**
 * Fetches a list of Azure DevOps projects.
 * @async
 * @param {string} organization - The name of the Azure DevOps organization.
 * @returns {Promise<Array>} A list of project objects.
 */
async function listAdoProjects(organization) {
  const url = `${ADO_BASEURI}/${organization}/_apis/projects`;
  logger.info(`Fetching Azure DevOps projects from ${url}`);
  return adoApiRequest('GET', url);
}

/**
 * Creates a new Azure DevOps pipeline in the specified project using a YAML definition.
 *
 * @async
 * @param {string} organization - The name of the Azure DevOps organization.
 * @param {string} project - The ID or name of the Azure DevOps project.
 * @param {string} repoName - The name of the repository containing the pipeline YAML file.
 * @param {string} [yamlPath='azure-pipelines.yml'] - The path to the YAML file defining the pipeline (default is 'azure-pipelines.yml').
 * @returns {Promise<Object>} The response from the Azure DevOps API after creating the pipeline.
 */
async function createAdoPipeline(organization, project, repoName, yamlPath = 'azure-pipelines.yml') {
  logger.info(`Creating Azure DevOps pipeline in project ${project} for repository ${repoName} using YAML at ${yamlPath}`);
  const id = await getprojectByName(organization, project);
  const url = `${ADO_BASEURI}/${organization}/${id}/_apis/pipelines`;
  const repo = await getRepoByName(organization, project, repoName);

  const pipelineDefinition = {
    name: 'Generated Pipeline',
    folder: '\\',
    configuration: {
      type: 'yaml',
      path: yamlPath,
      repository: {
        id: repo.id,
        name: repoName,
        type: 'azureReposGit',
      },
    },
  };
  logger.info(`Creating pipeline in project ${project}`);
  return adoApiRequest('POST', url, pipelineDefinition);
}

/**
 * Triggers a new run for an Azure DevOps pipeline.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The project ID or name.
 * @param {number} pipelineId The ID of the pipeline to run.
 * @param {object} [runParameters] Optional parameters for the pipeline run (e.g., variables, branch).
 * @returns {Promise<object>} The queued pipeline run object.
 */
async function runAdoPipeline(organization, project, pipelineId, runParameters = {}) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/pipelines/${pipelineId}/runs`;
  logger.info(`Running pipeline ${pipelineId} in ${project}`);
  return adoApiRequest('POST', url, runParameters);
}

/**
 * Retrieves logs for a specific pipeline run in Azure DevOps.
 * This function retrieves a list of log entries; to get the full content of a specific log file,
 * a subsequent call to the specific log URL might be needed.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The project ID or name.
 * @param {number} pipelineId The ID of the pipeline.
 * @param {number} runId The ID of the pipeline run.
 * @returns {Promise<Array>} An array of log entries for the pipeline run.
 */
async function getAdoPipelineRunLogs(organization, project, pipelineId, runId) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/pipelines/${pipelineId}/runs/${runId}/logs`;
  logger.info(`Fetching logs for run ${runId} of pipeline ${pipelineId}`);
  return adoApiRequest('GET', url);
}

/**
 * Fetches a list of runs for a specific Azure DevOps pipeline.
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The project ID or name.
 * @param {number} pipelineId The ID of the pipeline.
 * @returns {Promise<Array>} A list of pipeline run objects.
 */
async function listAdoPipelineRuns(organization, project, pipelineId) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/pipelines/${pipelineId}/runs`;
  logger.info(`Fetching runs for pipeline ${pipelineId}`);
  return adoApiRequest('GET', url);
}

/**
 * Deletes an Azure DevOps pipeline (build definition).
 * @param {string} organization The Azure DevOps organization name.
 * @param {string} project The project ID or name.
 * @param {number} pipelineId The ID of the pipeline to delete.
 * @returns {Promise<void>} A promise that resolves upon successful deletion.
 */
async function deleteAdoPipeline(organization, project, pipelineId) {
  const url = `${ADO_BASEURI}/${organization}/${project}/_apis/build/definitions/${pipelineId}`;
  logger.info(`Deleting pipeline ${pipelineId}`);
  await adoApiRequest('DELETE', url);
  return { message: `Pipeline ${pipelineId} deleted successfully.` };
}

module.exports = {
  createAdoPipeline,
  deleteAdoPipeline,
  getAdoPipelineRunLogs,
  listAdoPipelineRuns,
  listAdoProjects,
  listAdoPipelines,
  runAdoPipeline,
};
