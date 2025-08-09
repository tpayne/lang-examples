const githubFunctions = require('./gitFunctions');
const superagent = require('superagent');

jest.mock('superagent');

describe('GitHub Functions Tests', () => {
  beforeEach(() => {
    superagent.get.mockClear();
    superagent.post.mockClear();
    superagent.patch.mockClear();
  });

  test('getDefaultBranch should return the correct default branch', async () => {
    const mockResponse = {
      status: 200,
      body: {
        default_branch: 'main',
      },
    };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await githubFunctions.getDefaultBranch('user1', 'repo1');
    expect(result).toBe('main');
    expect(superagent.get).toHaveBeenCalled();
  });

  test('listPublicRepos should return list of repo names', async () => {
    const mockResponse = {
      status: 200,
      body: [
        { name: 'repo1' },
        { name: 'repo2' },
      ],
    };
    superagent.get.mockResolvedValue(mockResponse);

    const repos = await githubFunctions.listPublicRepos('user1');
    expect(repos).toEqual(['repo1', 'repo2']);
    expect(superagent.get).toHaveBeenCalled();
  });

  test('createRepo should return success on 201 response', async () => {
    const mockResponse = {
      status: 201,
      body: {},
    };
    superagent.post.mockResolvedValue(mockResponse);

    const result = await githubFunctions.createRepo('testRepo', 'testUser');
    expect(result).toEqual({ success: true, message: 'Repository created' });
    expect(superagent.post).toHaveBeenCalled();
  });

  test('createRepo should throw error on failure', async () => {
    const error = new Error('Failed to create');
    error.response = { body: { message: 'Unauthorized' } };
    superagent.post.mockRejectedValue(error);

    await expect(githubFunctions.createRepo('testRepo', 'testUser')).rejects.toThrow(
      /Failed to create repository: Unauthorized/,
    );
  });

  test('checkRepoExists returns exists true on 200 response', async () => {
    const mockResponse = { status: 200 };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await githubFunctions.checkRepoExists('user1', 'repo1');
    expect(result.exists).toBe(true);
  });

  test('checkRepoExists returns exists false on 404 error', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    superagent.get.mockRejectedValue(error);

    const result = await githubFunctions.checkRepoExists('user1', 'repo1');
    expect(result.exists).toBe(false);
  });

  test('checkBranchExists returns exists true on 200 response', async () => {
    const mockResponse = { status: 200 };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await githubFunctions.checkBranchExists('user1', 'repo1', 'main');
    expect(result.exists).toBe(true);
  });

  test('checkBranchExists returns exists false on 404 error', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    superagent.get.mockRejectedValue(error);

    const result = await githubFunctions.checkBranchExists('user1', 'repo1', 'main');
    expect(result.exists).toBe(false);
  });

  // More tests can be added similarly for other functions
});
