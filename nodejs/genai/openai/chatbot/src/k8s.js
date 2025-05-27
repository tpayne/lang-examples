const superagent = require('superagent');
const https = require('https');
const logger = require('./logger');

/**
 * Executes a GET request to the Kubernetes API.
 * This function handles authentication and basic error reporting.
 * @param {string} sessionId - The session ID for logging purposes.
 * @param {string} path - The Kubernetes API path (e.g., '/api/v1/namespaces').
 * @returns {Promise<object>} The response body from the Kubernetes API.
 * @throws {Error} If the Kubernetes API endpoint or bearer token are not configured,
 * or if the API request fails.
 */
async function callKubernetesApi(sessionId, path) {
  const kubernetesApiEndpoint = process.env.KUBERNETES_API_ENDPOINT;
  const kubernetesBearerToken = process.env.KUBERNETES_BEARER_TOKEN;

  // KUBERNETES_TLS_SKIP_VERIFY should only be used for development/testing, NEVER in production.
  const skipTlsVerify = process.env.KUBERNETES_TLS_SKIP_VERIFY === 'true';

  if (!kubernetesApiEndpoint) {
    throw new Error('Kubernetes API endpoint is not configured. Please set KUBERNETES_API_ENDPOINT in your .env or properties file.');
  }
  if (!kubernetesBearerToken) {
    throw new Error('Kubernetes Bearer Token is not configured. Please set KUBERNETES_BEARER_TOKEN in your .env or properties file.');
  }

  const url = `${kubernetesApiEndpoint}${path}`;
  logger.debug(`[Session: ${sessionId}] Calling Kubernetes API: ${url}`);

  try {
    let request = superagent.get(url)
      .set('Authorization', `Bearer ${kubernetesBearerToken}`)
      .set('Accept', 'application/json');

    // WARNING: Skipping TLS verification is INSECURE and should ONLY be used for development/testing.
    // For production, ensure proper CA certificates are configured or use a trusted certificate chain.
    if (skipTlsVerify) {
      logger.warn(`[Session: ${sessionId}] Skipping Kubernetes TLS verification for ${url}. This is INSECURE and should ONLY be used for development/testing.`);

      // Create an HTTPS agent that does not reject unauthorized (self-signed) certificates
      const insecureAgent = new https.Agent({
        rejectUnauthorized: false, // This is the key setting to ignore certificate errors
      });

      // Apply this insecure agent to your superagent request
      request = request.agent(insecureAgent);
    }

    const response = await request;
    return response.body;
  } catch (error) {
    const errorMessage = error.response
      ? `Status: ${error.status}, Body: ${JSON.stringify(error.response.body)}`
      : error.message;
    logger.error(`[Session: ${sessionId}] Kubernetes API call failed for ${path}: ${errorMessage}`, error);
    throw new Error(`Failed to get Kubernetes data from ${path}: ${errorMessage}`);
  }
}

/**
 * Gets the Kubernetes cluster version.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} Kubernetes version information (e.g., gitVersion, major, minor).
 */
async function getKubernetesVersion(sessionId) {
  return callKubernetesApi(sessionId, '/version');
}

/**
 * Lists all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes namespaces with their detailed status and metadata.
 */
async function listKubernetesNamespaces(sessionId) {
  return callKubernetesApi(sessionId, '/api/v1/namespaces');
}

/**
 * Lists all deployments across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes deployments with their detailed status, replicas, and associated metadata.
 */
async function listKubernetesDeployments(sessionId) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/deployments');
}

/**
 * Lists all services across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes services with their detailed status, cluster IPs, ports, and selectors.
 */
async function listKubernetesServices(sessionId) {
  return callKubernetesApi(sessionId, '/api/v1/services');
}

/**
 * Lists all pods across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes pods with their detailed status, node assignments, and container information.
 */
async function listKubernetesPods(sessionId) {
  return callKubernetesApi(sessionId, '/api/v1/pods');
}

/**
 * Lists all ReplicaSets across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes ReplicaSets with their detailed status and replica counts.
 */
async function listKubernetesReplicaSets(sessionId) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/replicasets');
}

/**
 * Lists all DaemonSets across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes DaemonSets with their detailed status.
 */
async function listKubernetesDaemonSets(sessionId) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/daemonsets');
}

/**
 * Lists all StatefulSets across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes StatefulSets with their detailed status and replica counts.
 */
async function listKubernetesStatefulSets(sessionId) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/statefulsets');
}

/**
 * Lists all Ingresses across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes Ingresses with their detailed rules and backend services.
 */
async function listKubernetesIngresses(sessionId) {
  return callKubernetesApi(sessionId, '/apis/networking.k8s.io/v1/ingresses');
}

/**
 * Lists all ConfigMaps across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes ConfigMaps with their detailed data.
 */
async function listKubernetesConfigMaps(sessionId) {
  return callKubernetesApi(sessionId, '/api/v1/configmaps');
}

/**
 * Lists all PersistentVolumes in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes PersistentVolumes with their detailed status, capacity, and access modes.
 */
async function listKubernetesPersistentVolumes(sessionId) {
  return callKubernetesApi(sessionId, '/apis/storage.k8s.io/v1/persistentvolumes');
}

/**
 * Lists all PersistentVolumeClaims across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes PersistentVolumeClaims with their detailed status and volume bindings.
 */
async function listKubernetesPersistentVolumeClaims(sessionId) {
  return callKubernetesApi(sessionId, '/apis/storage.k8s.io/v1/persistentvolumeclaims');
}

/**
 * Lists all Jobs across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes Jobs with their detailed status and completion information.
 */
async function listKubernetesJobs(sessionId) {
  return callKubernetesApi(sessionId, '/apis/batch/v1/jobs');
}

/**
 * Lists all CronJobs across all namespaces in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes CronJobs with their detailed status and schedule.
 */
async function listKubernetesCronJobs(sessionId) {
  return callKubernetesApi(sessionId, '/apis/batch/v1/cronjobs');
}

module.exports = {
  getKubernetesVersion,
  listKubernetesNamespaces,
  listKubernetesDeployments,
  listKubernetesServices,
  listKubernetesPods,
  listKubernetesReplicaSets,
  listKubernetesDaemonSets,
  listKubernetesStatefulSets,
  listKubernetesIngresses,
  listKubernetesConfigMaps,
  listKubernetesPersistentVolumes,
  listKubernetesPersistentVolumeClaims,
  listKubernetesJobs,
  listKubernetesCronJobs,
};
