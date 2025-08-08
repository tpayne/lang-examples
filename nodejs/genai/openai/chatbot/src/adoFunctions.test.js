const { getAdoDefaultBranch } = require('./adoFunctions'); // Adjust your path as necessary
const superagent = require('superagent');

jest.mock('superagent');

describe('ADO Functions Tests', () => {

  beforeEach(() => {
    // Clear any previous mocks before each test
    superagent.get.mockClear();
  });

  test('getAdoDefaultBranch should return the correct default branch', async () => {
    const mockResponse = {
      status: 200,
      body: {
        defaultBranch: 'refs/heads/main'
      }
    };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await getAdoDefaultBranch('organization', 'project', 'repoName');

    expect(result).toBe('main');
    expect(superagent.get).toHaveBeenCalled();
  });

  test('listAdoRepos should return the list of repositories', async () => {
    const mockResponse = {
      status: 200,
      body: {
        value: [{ name: 'repo1' }, { name: 'repo2' }]
      }
    };
    superagent.get.mockResolvedValue(mockResponse);

    const repos = await listAdoRepos('organization', 'project');

    expect(repos).toEqual(['repo1', 'repo2']);
    expect(superagent.get).toHaveBeenCalled();
  });

  test('downloadAdoFile should download file successfully', async () => {
    const mockResponse = {
      status: 200,
      body: Buffer.from('file content')
    };
    superagent.get.mockResolvedValue(mockResponse);

    const result = await downloadAdoFile('sessionId', 'organization', 'project', 'repoName', 'filePath', 'branchName', 'localFilePath');

    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  test('commitAdoFiles should not commit unchanged files', async () => {
    superagent.get.mockResolvedValueOnce({
      status: 200,
      body: { content: 'existing content in base64' }
    });

    const result = await commitAdoFiles('sessionId', 'organization', 'project', 'repoName', 'repoDir', 'branchName');

    expect(result.success).toBe(true);
    expect(result.message).toEqual(expect.stringContaining('No new or changed files to commit'));
  });

  // Further tests for other functions can be added similarly
});

