const getInfo = require('./getInfo');
const { checkIfRunningInDocker } = require('./utilities');

jest.mock('./utilities');

describe('GetInfo Functions Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('collectBasicSystemInfo returns info', async () => {
    checkIfRunningInDocker.mockResolvedValue(true);
    const result = await getInfo.collectBasicSystemInfo('session1');
    expect(result).toBeDefined();
  });

  test('collectDetailedSystemInfo returns info', async () => {
    checkIfRunningInDocker.mockResolvedValue(true);
    const result = await getInfo.collectDetailedSystemInfo('session1');
    expect(result).toBeDefined();
  });

  test('collectProcessInfo returns process info', async () => {
    checkIfRunningInDocker.mockResolvedValue(true);
    const result = await getInfo.collectProcessInfo('session1');
    expect(result).toBeDefined();
  });

  test('collectAllServicesInfo returns service info', async () => {
    checkIfRunningInDocker.mockResolvedValue(true);
    const result = await getInfo.collectAllServicesInfo('session1');
    expect(result).toBeDefined();
  });

  test('testSshConnect returns true on success', async () => {
    checkIfRunningInDocker.mockResolvedValue(true);
    // This method internally calls SSH setup and commands; mock those as needed
    const result = await getInfo.testSshConnect('session1', 'user@host');
    expect(result).toBe(true);
  });

  // Add more specific tests for edge cases, errors, etc.
});
