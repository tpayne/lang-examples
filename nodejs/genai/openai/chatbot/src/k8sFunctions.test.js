const k8sFunctions = require('./k8s');
const superagent = require('superagent');

jest.mock('superagent');

describe('Kubernetes Functions Tests', () => {
  beforeEach(() => {
    superagent.get.mockClear();
    superagent.post.mockClear();
    superagent.put.mockClear();
    superagent.delete.mockClear();
  });

  test('getKubernetesVersion should return version data', async () => {
    const mockResponse = { body: { gitVersion: 'v1.21.0', major: '1', minor: '21' } };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.getKubernetesVersion('session1');
    expect(result.gitVersion).toBe('v1.21.0');
    expect(superagent.get).toHaveBeenCalled();
  });

  test('listKubernetesPods should return pod list', async () => {
    const mockResponse = { body: { items: [{ metadata: { name: 'pod1' } }, { metadata: { name: 'pod2' } }] } };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.listKubernetesPods('session1', 'default');
    expect(result.body).toBeDefined();
    expect(superagent.get).toHaveBeenCalled();
  });

  test('getKubernetesDeploymentDetails should return deployment details', async () => {
    const mockResponse = { body: { metadata: { name: 'deployment1' } } };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.getKubernetesDeploymentDetails('session1', 'deployment1', 'default');
    expect(result.metadata.name).toBe('deployment1');
    expect(superagent.get).toHaveBeenCalled();
  });

  test('createKubernetesResource should call POST with parsed body', async () => {
    const resourceBody = JSON.stringify({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'pod1' } });
    const mockResponse = { body: { kind: 'Pod', metadata: { name: 'pod1' } } };
    superagent.post.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.createKubernetesResource('session1', 'pods', resourceBody, 'default');
    expect(result.kind).toBe('Pod');
    expect(superagent.post).toHaveBeenCalled();
  });

  test('deleteKubernetesResource should call DELETE', async () => {
    const mockResponse = { body: { status: 'Success' } };
    superagent.delete.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.deleteKubernetesResource('session1', 'pods', 'pod1', 'default');
    expect(result.status).toBe('Success');
    expect(superagent.delete).toHaveBeenCalled();
  });

  test('updateKubernetesResource should call PUT with parsed body', async () => {
    const resourceBody = JSON.stringify({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'pod1' } });
    const mockResponse = { body: { kind: 'Pod', metadata: { name: 'pod1' } } };
    superagent.put.mockResolvedValue(mockResponse);

    const result = await k8sFunctions.updateKubernetesResource('session1', 'pods', 'pod1', resourceBody, 'default');
    expect(result.kind).toBe('Pod');
    expect(superagent.put).toHaveBeenCalled();
  });

  // Additional tests can be added for other Kubernetes functions as needed.
});
