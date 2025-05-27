const superagent = require('superagent');
const https = require('https');
const logger = require('./logger');

/**
 * Executes a GET request to the Kubernetes API.
 * This function handles authentication and basic error reporting.
 * @param {string} sessionId - The session ID for logging purposes.
 * @param {string} path - The base Kubernetes API path (e.g., '/api/v1/namespaces').
 * @param {string} [namespace] - Optional: The namespace to scope the request to.
 * @returns {Promise<object>} The response body from the Kubernetes API.
 * @throws {Error} If the Kubernetes API endpoint or bearer token are not configured,
 * or if the API request fails.
 */
async function callKubernetesApi(sessionId, path, namespace) {
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

  let fullPath = path;
  // If a namespace is provided and the path is for a namespaced resource,
  // insert the namespace into the path.
  // This logic assumes paths for namespaced resources typically start with /apis/<group>/<version>/ or /api/<version>/
  // and then would have /<resource-type>
  // We'll insert /namespaces/{namespace} after the version.
  if (namespace) {
    // Example: /apis/apps/v1/deployments -> /apis/apps/v1/namespaces/{namespace}/deployments
    // Example: /api/v1/pods -> /api/v1/namespaces/{namespace}/pods
    const parts = path.split('/');
    if (parts.length >= 3 && (parts[1] === 'api' || parts[1] === 'apis')) {
      // Find the index after the version (e.g., 'v1')
      const versionIndex = parts.findIndex((part, index) => index > 1 && part.match(/^v\d+((alpha|beta)\d+)?$/));
      if (versionIndex !== -1) {
        parts.splice(versionIndex + 1, 0, 'namespaces', namespace);
        fullPath = parts.join('/');
      }
    }
  }

  const url = `${kubernetesApiEndpoint}${fullPath}`;
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
    logger.error(`[Session: ${sessionId}] Kubernetes API call failed for ${fullPath}: ${errorMessage}`, error);
    throw new Error(`Failed to get Kubernetes data from ${fullPath}: ${errorMessage}`);
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
 * Lists all deployments across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list deployments from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes deployments with their detailed status, replicas, and associated metadata.
 */
async function listKubernetesDeployments(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/deployments', namespace);
}

/**
 * Lists all services across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list services from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes services with their detailed status, cluster IPs, ports, and selectors.
 */
async function listKubernetesServices(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/api/v1/services', namespace);
}

/**
 * Lists all pods across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list pods from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes pods with their detailed status, node assignments, and container information.
 */
async function listKubernetesPods(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/api/v1/pods', namespace);
}

/**
 * Lists all ReplicaSets across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list ReplicaSets from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes ReplicaSets with their detailed status and replica counts.
 */
async function listKubernetesReplicaSets(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/replicasets', namespace);
}

/**
 * Lists all DaemonSets across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list DaemonSets from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes DaemonSets with their detailed status.
 */
async function listKubernetesDaemonSets(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/daemonsets', namespace);
}

/**
 * Lists all StatefulSets across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list StatefulSets from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes StatefulSets with their detailed status and replica counts.
 */
async function listKubernetesStatefulSets(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/apps/v1/statefulsets', namespace);
}

/**
 * Lists all Ingresses across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list Ingresses from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes Ingresses with their detailed rules and backend services.
 */
async function listKubernetesIngresses(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/networking.k8s.io/v1/ingresses', namespace);
}

/**
 * Lists all ConfigMaps across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list ConfigMaps from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes ConfigMaps with their detailed data.
 */
async function listKubernetesConfigMaps(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/api/v1/configmaps', namespace);
}

/**
 * Lists all PersistentVolumes in the Kubernetes cluster.
 * PersistentVolumes are cluster-scoped, so they do not accept a namespace parameter.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes PersistentVolumes with their detailed status, capacity, and access modes.
 */
async function listKubernetesPersistentVolumes(sessionId) {
  return callKubernetesApi(sessionId, '/apis/storage.k8s.io/v1/persistentvolumes');
}

/**
 * Lists all PersistentVolumeClaims across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list PersistentVolumeClaims from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes PersistentVolumeClaims with their detailed status and volume bindings.
 */
async function listKubernetesPersistentVolumeClaims(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/storage.k8s.io/v1/persistentvolumeclaims', namespace);
}

/**
 * Lists all Jobs across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list Jobs from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes Jobs with their detailed status and completion information.
 */
async function listKubernetesJobs(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/batch/v1/jobs', namespace);
}

/**
 * Lists all CronJobs across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list CronJobs from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes CronJobs with their detailed status and schedule.
 */
async function listKubernetesCronJobs(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/apis/batch/v1/cronjobs', namespace);
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
