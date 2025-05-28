const superagent = require('superagent');
const https = require('https');
const logger = require('./logger');

/**
 * Executes a request to the Kubernetes API.
 * This function handles authentication, different HTTP methods, request bodies, and basic error reporting.
 * @param {string} sessionId - The session ID for logging purposes.
 * @param {string} path - The base Kubernetes API path (e.g., '/api/v1/namespaces').
 * @param {string} [namespace] - Optional: The namespace to scope the request to.
 * @param {string} [method='GET'] - Optional: The HTTP method (GET, PUT, DELETE, POST). Defaults to 'GET'.
 * @param {object} [body=null] - Optional: The request body for PUT/POST requests.
 * @returns {Promise<object|string>} The response body from the Kubernetes API. For logs, it might be a string.
 * @throws {Error} If the Kubernetes API endpoint or bearer token are not configured,
 * or if the API request fails.
 */
async function callKubernetesApi(sessionId, path, namespace, method = 'GET', body = null) {
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
  // This logic needs to be careful not to double-add 'namespaces' if the path already contains it.
  // For simplicity, let's assume `path` always comes without `namespaces/{namespace}` if it's a namespaced resource.
  // This is how most list calls are done, e.g., /api/v1/pods which callKubernetesApi then makes /api/v1/namespaces/default/pods
  if (namespace) {
    const parts = path.split('/');
    if (parts.length >= 3 && (parts[1] === 'api' || parts[1] === 'apis')) {
      const versionIndex = parts.findIndex((part, index) => index > 1 && part.match(/^v\d+((alpha|beta)\d+)?$/));
      // Check if 'namespaces' is *not* already present immediately after the version,
      // and if the resource type is generally namespaced (e.g., not a cluster-scoped resource like nodes or persistentvolumes)
      const isNamespacedPath = parts[versionIndex + 1] !== 'namespaces';

      if (versionIndex !== -1 && isNamespacedPath) {
        // This splices "namespaces" and the actual namespace into the path.
        parts.splice(versionIndex + 1, 0, 'namespaces', namespace);
        fullPath = parts.join('/');
      }
    }
  }

  const url = `${kubernetesApiEndpoint}${fullPath}`;
  logger.debug(`[Session: ${sessionId}] Calling Kubernetes API: ${method} ${url}`);

  try {
    let request;
    switch (method.toUpperCase()) {
      case 'GET':
        request = superagent.get(url);
        break;
      case 'POST': // Added POST for creation
        request = superagent.post(url);
        break;
      case 'PUT':
        request = superagent.put(url);
        break;
      case 'DELETE':
        request = superagent.delete(url);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    request
      .set('Authorization', `Bearer ${kubernetesBearerToken}`)
      .set('Accept', 'application/json');

    if (body) {
      request.send(body);
      request.set('Content-Type', 'application/json');
    }

    // WARNING: Skipping TLS verification is INSECURE and should ONLY be used for development/testing.
    if (skipTlsVerify) {
      logger.warn(`[Session: ${sessionId}] Skipping Kubernetes TLS verification for ${url}. This is INSECURE and should ONLY be used for development/testing.`);
      const insecureAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      request = request.agent(insecureAgent);
    }

    const response = await request;
    // For logs, the response body might not be JSON, so return as is.
    if (path.endsWith('/log')) {
      return { text: response.text }; // Returning an object with 'text' key as previously observed from tool output
    }
    return response.body;
  } catch (error) {
    const errorMessage = error.response
      ? `Status: ${error.status}, Body: ${error.response.text || JSON.stringify(error.response.body)}`
      : error.message;
    logger.error(`[Session: ${sessionId}] Kubernetes API call failed for ${method} ${fullPath}: ${errorMessage}`, error);
    throw new Error(`Failed to perform Kubernetes operation on ${fullPath}: ${errorMessage}`);
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
 * Gets detailed information about a specific Kubernetes Deployment.
 * @param {string} sessionId - The session ID.
 * @param {string} deploymentName - The name of the deployment.
 * @param {string} namespace - The namespace the deployment resides in.
 * @returns {Promise<object>} Detailed information about the Kubernetes Deployment.
 */
async function getKubernetesDeploymentDetails(sessionId, deploymentName, namespace) {
  return callKubernetesApi(sessionId, `/apis/apps/v1/deployments/${deploymentName}`, namespace);
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
 * Gets detailed information about a specific Kubernetes Service.
 * @param {string} sessionId - The session ID.
 * @param {string} serviceName - The name of the service.
 * @param {string} namespace - The namespace the service resides in.
 * @returns {Promise<object>} Detailed information about the Kubernetes Service.
 */
async function getKubernetesServiceDetails(sessionId, serviceName, namespace) {
  return callKubernetesApi(sessionId, `/api/v1/services/${serviceName}`, namespace);
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
 * Gets detailed information about a specific Kubernetes Pod.
 * @param {string} sessionId - The session ID.
 * @param {string} podName - The name of the pod.
 * @param {string} namespace - The namespace the pod resides in.
 * @returns {Promise<object>} Detailed information about the Kubernetes Pod.
 */
async function getKubernetesPodDetails(sessionId, podName, namespace) {
  return callKubernetesApi(sessionId, `/api/v1/pods/${podName}`, namespace);
}

/**
 * Gets the logs for a specific pod in a given namespace.
 * @param {string} sessionId - The session ID.
 * @param {string} podName - The name of the pod to get logs from.
 * @param {string} namespace - The namespace the pod resides in.
 * @returns {Promise<object>} The logs from the specified pod. The logs are returned as a string in the 'text' property of the returned object.
 */
async function getKubernetesPodLogs(sessionId, podName, namespace) {
  return callKubernetesApi(sessionId, `/api/v1/pods/${podName}/log`, namespace);
}

/**
 * Scales a specified Kubernetes Deployment to a desired number of replicas.
 * This directly updates the 'scale' subresource of the deployment.
 * @param {string} sessionId - The session ID.
 * @param {string} deploymentName - The name of the deployment to scale.
 * @param {string} namespace - The namespace the deployment resides in.
 * @param {number} replicas - The desired number of replicas.
 * @returns {Promise<object>} The updated Scale object for the Deployment.
 */
async function scaleKubernetesDeployment(sessionId, deploymentName, namespace, replicas) {
  const scaleBody = {
    apiVersion: 'autoscaling/v1', // Or 'apps/v1' depending on the API version of the scale subresource
    kind: 'Scale',
    metadata: {
      name: deploymentName,
      namespace,
    },
    spec: {
      replicas,
    },
  };
  return callKubernetesApi(sessionId, `/apis/apps/v1/deployments/${deploymentName}/scale`, namespace, 'PUT', scaleBody);
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

/**
 * Deletes a specified Kubernetes resource.
 * @param {string} sessionId - The session ID.
 * @param {string} resourceType - The type of the resource to delete (e.g., 'pods', 'deployments', 'services').
 * @param {string} name - The name of the resource to delete.
 * @param {string} namespace - The namespace the resource resides in.
 * @returns {Promise<object>} The status object from the deletion operation.
 */
async function deleteKubernetesResource(sessionId, resourceType, name, namespace) {
  let apiPath;
  switch (resourceType.toLowerCase()) {
    case 'pods':
      apiPath = `/api/v1/pods/${name}`;
      break;
    case 'deployments':
      apiPath = `/apis/apps/v1/deployments/${name}`;
      break;
    case 'services':
      apiPath = `/api/v1/services/${name}`;
      break;
    case 'replicasets':
      apiPath = `/apis/apps/v1/replicasets/${name}`;
      break;
    case 'daemonsets':
      apiPath = `/apis/apps/v1/daemonsets/${name}`;
      break;
    case 'statefulsets':
      apiPath = `/apis/apps/v1/statefulsets/${name}`;
      break;
    case 'ingresses':
      apiPath = `/apis/networking.k8s.io/v1/ingresses/${name}`;
      break;
    case 'configmaps':
      apiPath = `/api/v1/configmaps/${name}`;
      break;
    case 'persistentvolumeclaims':
      apiPath = `/apis/storage.k8s.io/v1/persistentvolumeclaims/${name}`;
      break;
    case 'jobs':
      apiPath = `/apis/batch/v1/jobs/${name}`;
      break;
    case 'cronjobs':
      apiPath = `/apis/batch/v1/cronjobs/${name}`;
      break;
    case 'namespaces':
      apiPath = `/api/v1/namespaces/${name}`; // Namespaces are cluster-scoped, but API path follows similar pattern
      break;
    // Add other resource types as needed
    default:
      throw new Error(`Unsupported resource type for deletion: ${resourceType}`);
  }
  return callKubernetesApi(sessionId, apiPath, namespace, 'DELETE');
}

/**
 * Lists all Nodes in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<object>} A list of Kubernetes Nodes with their detailed status and metadata.
 */
async function listKubernetesNodes(sessionId) {
  return callKubernetesApi(sessionId, '/api/v1/nodes');
}

/**
 * Gets detailed information about a specific Kubernetes Node.
 * @param {string} sessionId - The session ID.
 * @param {string} nodeName - The name of the node.
 * @returns {Promise<object>} Detailed information about the Kubernetes Node.
 */
async function getKubernetesNodeDetails(sessionId, nodeName) {
  return callKubernetesApi(sessionId, `/api/v1/nodes/${nodeName}`);
}

/**
 * Lists all Secrets across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list secrets from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes Secrets with their detailed data and metadata.
 */
async function listKubernetesSecrets(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/api/v1/secrets', namespace);
}

/**
 * Gets detailed information about a specific Kubernetes Secret.
 * @param {string} sessionId - The session ID.
 * @param {string} secretName - The name of the secret.
 * @param {string} namespace - The namespace the secret resides in.
 * @returns {Promise<object>} Detailed information about the Kubernetes Secret.
 */
async function getKubernetesSecretDetails(sessionId, secretName, namespace) {
  return callKubernetesApi(sessionId, `/api/v1/secrets/${secretName}`, namespace);
}

/**
 * Lists all Events across all namespaces or within a specified namespace in the Kubernetes cluster.
 * @param {string} sessionId - The session ID.
 * @param {string} [namespace] - Optional: The namespace to list events from. If not provided, lists from all namespaces.
 * @returns {Promise<object>} A list of Kubernetes Events with their detailed information.
 */
async function listKubernetesEvents(sessionId, namespace) {
  return callKubernetesApi(sessionId, '/api/v1/events', namespace);
}

/**
 * Creates a Kubernetes resource from a provided resource definition.
 * @param {string} sessionId - The session ID.
 * @param {string} resourceType - The plural type of the resource to create (e.g., 'deployments', 'pods', 'services').
 * This should correspond to the API path segment.
 * @param {string} [namespace] - Optional: The namespace to create the resource in. Required for namespaced resources.
 * @param {object} resourceBody - The full resource definition (JSON object) to create.
 * @returns {Promise<object>} The created Kubernetes resource object.
 */
async function createKubernetesResource(sessionId, resourceType, namespace, resourceBody) {
  let apiPath;
  // Determine the base API path based on resourceType and API group/version
  // This switch statement will need to be comprehensive for all creatable resources
  // For simplicity here, we'll assume common types. A more robust solution might
  // parse apiVersion and kind from resourceBody to determine the correct path.
  switch (resourceType.toLowerCase()) {
    case 'pods':
      apiPath = '/api/v1/pods';
      break;
    case 'deployments':
      apiPath = '/apis/apps/v1/deployments';
      break;
    case 'services':
      apiPath = '/api/v1/services';
      break;
    case 'configmaps':
      apiPath = '/api/v1/configmaps';
      break;
    case 'secrets':
      apiPath = '/api/v1/secrets';
      break;
    case 'namespaces': // Namespaces are cluster-scoped for creation, but API path follows pattern
      apiPath = '/api/v1/namespaces';
      // No namespace parameter for callKubernetesApi for cluster-scoped creation
      return callKubernetesApi(sessionId, apiPath, null, 'POST', resourceBody);
    default:
      // Fallback: Attempt to derive path from resourceBody's apiVersion and kind
      if (resourceBody && resourceBody.apiVersion && resourceBody.kind) {
        const { apiVersion } = resourceBody;
        const kind = `${resourceBody.kind.toLowerCase()}s`; // Pluralize kind
        if (apiVersion.includes('/')) { // e.g., apps/v1
          apiPath = `/apis/${apiVersion}/${kind}`;
        } else { // e.g., v1
          apiPath = `/api/${apiVersion}/${kind}`;
        }
      } else {
        throw new Error(`Unsupported resource type for creation: ${resourceType} or missing apiVersion/kind in body.`);
      }
  }
  return callKubernetesApi(sessionId, apiPath, namespace, 'POST', resourceBody);
}

/**
 * Updates an existing Kubernetes resource with a provided resource definition.
 * This performs a full replacement (PUT operation).
 * @param {string} sessionId - The session ID.
 * @param {string} resourceType - The plural type of the resource to update (e.g., 'deployments', 'pods', 'services').
 * @param {string} name - The name of the resource to update.
 * @param {string} [namespace] - Optional: The namespace the resource resides in. Required for namespaced resources.
 * @param {object} resourceBody - The full updated resource definition (JSON object).
 * @returns {Promise<object>} The updated Kubernetes resource object.
 */
async function updateKubernetesResource(sessionId, resourceType, name, namespace, resourceBody) {
  let apiPath;
  switch (resourceType.toLowerCase()) {
    case 'pods':
      apiPath = `/api/v1/pods/${name}`;
      break;
    case 'deployments':
      apiPath = `/apis/apps/v1/deployments/${name}`;
      break;
    case 'services':
      apiPath = `/api/v1/services/${name}`;
      break;
    case 'configmaps':
      apiPath = `/api/v1/configmaps/${name}`;
      break;
    case 'secrets':
      apiPath = `/api/v1/secrets/${name}`;
      break;
    case 'namespaces': // Namespaces are cluster-scoped for update, but API path follows pattern
      apiPath = `/api/v1/namespaces/${name}`;
      // No namespace parameter for callKubernetesApi for cluster-scoped update
      return callKubernetesApi(sessionId, apiPath, null, 'PUT', resourceBody);
    default:
      // Fallback: Attempt to derive path from resourceBody's apiVersion and kind
      if (resourceBody && resourceBody.apiVersion && resourceBody.kind) {
        const { apiVersion } = resourceBody;
        const kind = `${resourceBody.kind.toLowerCase()}s`;
        if (apiVersion.includes('/')) {
          apiPath = `/apis/${apiVersion}/${kind}/${name}`;
        } else {
          apiPath = `/api/${apiVersion}/${kind}/${name}`;
        }
      } else {
        throw new Error(`Unsupported resource type for update: ${resourceType} or missing apiVersion/kind in body.`);
      }
  }
  return callKubernetesApi(sessionId, apiPath, namespace, 'PUT', resourceBody);
}

module.exports = {
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
};
