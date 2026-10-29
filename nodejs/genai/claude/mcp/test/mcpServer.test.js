const assert = require('node:assert/strict');
const { test, describe, beforeEach, afterEach } = require('node:test');

const { createServer } = require('../src/mcpServer');

const INTEGRATION_ENV_VARS = [
  'GITHUB_TOKEN', 'AZURE_DEVOPS_PAT', 'DOSA_API_KEY', 'DOSA_API_SECRET',
  'DOSA_AUTH_TENANT_ID', 'DOSA_CLIENT_ID', 'MAPS_API_KEY', 'KUBERNETES_API_ENDPOINT',
  'KUBERNETES_BEARER_TOKEN', 'DATABASE_URI',
];

let originalEnv;

beforeEach(() => {
  originalEnv = {};
  INTEGRATION_ENV_VARS.forEach((key) => {
    originalEnv[key] = process.env[key];
  });
});

afterEach(() => {
  INTEGRATION_ENV_VARS.forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
});

describe('createServer', () => {
  test('builds successfully with no integrations enabled (system info tools only)', () => {
    INTEGRATION_ENV_VARS.forEach((key) => delete process.env[key]);
    const server = createServer();
    assert.equal(typeof server.addTool, 'function');
    assert.equal(typeof server.start, 'function');
  });

  test('builds successfully with every integration enabled, exercising every tool schema', () => {
    process.env.GITHUB_TOKEN = 'x';
    process.env.AZURE_DEVOPS_PAT = 'x';
    process.env.DOSA_API_KEY = 'x';
    process.env.DOSA_API_SECRET = 'x';
    process.env.DOSA_AUTH_TENANT_ID = 'x';
    process.env.DOSA_CLIENT_ID = 'x';
    process.env.MAPS_API_KEY = 'x';
    process.env.KUBERNETES_API_ENDPOINT = 'x';
    process.env.KUBERNETES_BEARER_TOKEN = 'x';
    process.env.DATABASE_URI = 'x';

    // Every tool definition's parametersSchema gets converted to a Zod
    // shape here (buildZodShape + z.object) - this is the main place a bad
    // schema (e.g. the nested 'params' object used by the mapping tools)
    // would throw at registration time rather than at call time.
    assert.doesNotThrow(() => createServer());
  });
});
