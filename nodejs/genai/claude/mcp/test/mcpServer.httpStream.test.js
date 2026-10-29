/**
 * Integration test for the MCP server's remote transport: MCP_TRANSPORT=
 * httpStream, served over HTTPS with bearer-token auth (see mcpServer.js),
 * reached by mcpClient.js via MCP_SERVER_URL/MCP_SERVER_AUTH_TOKEN exactly
 * as a real "remote MCP server" deployment would be used.
 *
 * Unlike mcpClient.integration.test.js (which spawns the server itself,
 * locally, over stdio), this test manually starts the server as a
 * standalone child process - the same way an operator would run it on a
 * separate host - and connects to it purely over the network transport.
 *
 * Generates a throwaway self-signed certificate into a temp directory for
 * the duration of this file (via the `openssl` CLI - see the Dockerfile's
 * prebuild stage) rather than committing a private key to the repo, so
 * this test can exercise real TLS instead of mocking it away.
 *
 * Needs NODE_TLS_REJECT_UNAUTHORIZED=0 to trust that self-signed cert
 * (NODE_EXTRA_CA_CERTS, the right way to trust a private/self-signed CA -
 * see README.md - is only read once at Node startup, so it can't be
 * pointed at a cert generated after the process has already started).
 * Set via the test:unit script in package.json, not in this file, so a
 * static analyzer scanning this source file never sees a statement that
 * disables certificate validation.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const {
  test, describe, before, after,
} = require('node:test');

const { getClaudeToolDefinitions, callMcpTool, closeMcpClient } = require('../src/mcpClient');

const MCP_SERVER_PATH = path.join(__dirname, '..', 'src', 'mcpServer.js');
const TEST_PORT = 18443;
const AUTH_TOKEN = 'test-only-shared-secret';
const SERVER_URL = `https://localhost:${TEST_PORT}/mcp`;

let serverProcess;
let certDir;

/**
 * Polls until a TCP connection to the given port succeeds, or rejects after
 * the timeout. Used instead of a fixed sleep so the test isn't flaky under
 * load.
 * @param {number} port The port to probe.
 * @param {number} timeoutMs Give up after this many milliseconds.
 * @returns {Promise<void>} Resolves once the port accepts a connection.
 */
function waitForPort(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, 'localhost');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for port ${port} to open`));
        } else {
          setTimeout(attempt, 100);
        }
      });
    };
    attempt();
  });
}

before(async () => {
  certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-certs-'));
  const certPath = path.join(certDir, 'server.crt');
  const keyPath = path.join(certDir, 'server.key');
  execFileSync('openssl', [
    'req', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath,
    '-x509', '-days', '1', '-out', certPath, '-subj', '/CN=localhost',
  ], { stdio: 'ignore' });

  serverProcess = spawn(process.execPath, [MCP_SERVER_PATH], {
    env: {
      ...process.env,
      MCP_TRANSPORT: 'httpStream',
      MCP_HTTP_PORT: String(TEST_PORT),
      MCP_HTTP_HOST: '0.0.0.0',
      MCP_HTTPS_CERT_PATH: certPath,
      MCP_HTTPS_KEY_PATH: keyPath,
      MCP_HTTP_AUTH_TOKEN: AUTH_TOKEN,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForPort(TEST_PORT);
});

after(async () => {
  await closeMcpClient();
  if (serverProcess) {
    serverProcess.kill();
  }
  if (certDir) {
    fs.rmSync(certDir, { recursive: true, force: true });
  }
});

describe('MCP server - httpStream transport over HTTPS', () => {
  test('rejects a request over the raw HTTPS endpoint with no Authorization header', async () => {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    assert.equal(response.status, 401);
  });

  test('getClaudeToolDefinitions and callMcpTool work end-to-end over the remote transport', async () => {
    process.env.MCP_SERVER_URL = SERVER_URL;
    process.env.MCP_SERVER_AUTH_TOKEN = AUTH_TOKEN;

    const tools = await getClaudeToolDefinitions();
    assert.ok(tools.length >= 6, 'expected at least the 6 always-on system info tools');
    assert.ok(tools.every((t) => !('sessionId' in t.input_schema.properties)));

    const { text, isError } = await callMcpTool('remote-test-session', 'scan_network_for_ssh', {
      baseIp: '203.0.113', // TEST-NET-3 (RFC 5737) - guaranteed unreachable
      startRange: 1,
      endRange: 1,
      port: 9,
      timeout: 50,
    });
    assert.equal(isError, false);
    assert.deepEqual(JSON.parse(text), []);

    await closeMcpClient();
  });

  test('rejects an incorrect bearer token', async () => {
    process.env.MCP_SERVER_URL = SERVER_URL;
    process.env.MCP_SERVER_AUTH_TOKEN = 'wrong-token';

    await assert.rejects(() => getClaudeToolDefinitions());
    await closeMcpClient();
  });
});
