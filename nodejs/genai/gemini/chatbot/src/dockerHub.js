const superagent = require('superagent');
const logger = require('./logger');

/**
 * Authenticates with Docker Hub to obtain a JWT token.
 * This token is required for accessing private repositories.
 * @param {string} username - Your Docker Hub username.
 * @param {string} password - Your Docker Hub password.
 * @returns {Promise<string>} A JWT token if authentication is successful.
 * @throws {Error} If authentication fails.
 */
async function authenticateDockerHub(username, password) {
  const authUrl = 'https://hub.docker.com/v2/users/login/';
  try {
    const response = await superagent.post(authUrl)
      .send({ username, password })
      .set('Accept', 'application/json');

    if (response.body && response.body.token) {
      logger.debug(`Successfully authenticated with Docker Hub for user: ${username}`);
      return response.body.token;
    }
    throw new Error('No token received from Docker Hub authentication.');
  } catch (error) {
    const errorMessage = error.response
      ? `Status: ${error.status}, Body: ${error.response.text || JSON.stringify(error.response.body)}`
      : error.message;
    logger.error(`Failed to authenticate with Docker Hub for user ${username}: ${errorMessage}`, error);
    throw new Error(`Docker Hub authentication failed: ${errorMessage}`);
  }
}

/**
 * Gets the tags for a specified Docker image from Docker Hub.
 * @param {string} imageName - The full name of the Docker image (e.g., 'library/nginx', 'myuser/myimage').
 * @returns {Promise<object>} A list of image tags.
 * @throws {Error} If the API request fails.
 */
async function getDockerImageTags(imageName) {
  if (!imageName) {
    throw new Error('Image name cannot be empty.');
  }

  const url = `https://hub.docker.com/v2/repositories/${imageName}/tags`;
  logger.info(`Fetching Docker image tags from: ${url}`);

  try {
    const response = await superagent.get(url).set('Accept', 'application/json');
    // The sample output shows the tags within the 'results' array
    return response.body.results;
  } catch (error) {
    logger.error(`Failed to fetch Docker image tags for ${imageName}: ${error.message}`);
    throw new Error(`Could not retrieve tags for image ${imageName}: ${error.message}`);
  }
}

/**
 * Searches for Docker images on Docker Hub.
 * Supports both public and private repositories. For private repositories,
 * DOCKERHUB_USERNAME and DOCKERHUB_PASSWORD environment variables must be set.
 * @param {string} sessionId - The session ID for logging purposes.
 * @param {string} searchTerm - The term to search for (e.g., 'ubuntu', 'my-private-repo/my-image').
 * @param {boolean} [isPrivate=false] - If true, searches private repositories of the configured user.
 * @param {string} [username=null] - Optional: Docker Hub username if searching private repos.
 * Defaults to DOCKERHUB_USERNAME env var if not provided and isPrivate is true.
 * @returns {Promise<Array<object>>} An array of image objects found.
 * @throws {Error} If the search fails or authentication is required but credentials are missing.
 */
async function searchDockerImages(sessionId, searchTerm, isPrivate = false, username = null) {
  let images = [];

  if (isPrivate) {
    const dockerHubUsername = username || process.env.DOCKERHUB_USERNAME;
    const dockerHubPassword = process.env.DOCKERHUB_PASSWORD;

    if (!dockerHubUsername || !dockerHubPassword) {
      throw new Error('Docker Hub username and password are required for private image search. Please set DOCKERHUB_USERNAME and DOCKERHUB_PASSWORD environment variables.');
    }

    try {
      const token = await authenticateDockerHub(dockerHubUsername, dockerHubPassword);
      // For private repos, we typically list user's repos and filter by name
      // Docker Hub API for listing repositories: /v2/repositories/{username}/
      // Note: This endpoint lists repos BY the user, and allows filtering by name.
      // This is different from the public search which searches across ALL public repos.
      const privateSearchUrl = `https://hub.docker.com/v2/repositories/${dockerHubUsername}/?name=${encodeURIComponent(searchTerm)}`;
      logger.debug(`[Session: ${sessionId}] Searching private Docker Hub for: ${searchTerm}`);

      const response = await superagent.get(privateSearchUrl)
        .set('Authorization', `JWT ${token}`)
        .set('Accept', 'application/json');

      if (response.body && Array.isArray(response.body.results)) {
        images = response.body.results.map((repo) => ({
          name: `${repo.user}/${repo.name}`,
          description: repo.description,
          is_private: repo.is_private,
          star_count: repo.star_count,
          pull_count: repo.pull_count,
          last_updated: repo.last_updated,
        }));
      }
    } catch (error) {
      const errorMessage = error.response
        ? `Status: ${error.status}, Body: ${error.response.text || JSON.stringify(error.response.body)}`
        : error.message;
      logger.error(`[Session: ${sessionId}] Failed to search private Docker Hub for ${searchTerm}: ${errorMessage}`, error);
      throw new Error(`Failed to search private Docker Hub: ${errorMessage}`);
    }
  } else {
    // Public search API using the endpoint confirmed to work
    const publicSearchUrl = `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(searchTerm)}&page_size=25`; // Limit to first 25 results
    logger.debug(`[Session: ${sessionId}] Searching public Docker Hub for: ${searchTerm} at URL: ${publicSearchUrl}`);

    try {
      const response = await superagent.get(publicSearchUrl)
        .set('Accept', 'application/json');

      if (response.body && Array.isArray(response.body.results)) { // Changed 'summaries' to 'results'
        images = response.body.results.map((repo) => ({ // Changed 'summary' to 'repo'
          name: repo.repo_name, // Changed from summary.name to repo.repo_name
          description: repo.short_description, // Changed from summary.short_description to repo.short_description
          is_official: repo.is_official,
          is_automated: repo.is_automated,
          star_count: repo.star_count,
          pull_count: repo.pull_count,
          // Removed last_updated as it's not consistently present in this endpoint's results
        }));
      }
    } catch (error) {
      const errorMessage = error.response
        ? `Status: ${error.status}, Body: ${error.response.text || JSON.stringify(error.response.body)}`
        : error.message;
      logger.error(`[Session: ${sessionId}] Failed to search public Docker Hub for ${searchTerm}: ${errorMessage}`, error);
      throw new Error(`Failed to search public Docker Hub: ${errorMessage}`);
    }
  }

  return images;
}

module.exports = {
  getDockerImageTags,
  searchDockerImages,
};
