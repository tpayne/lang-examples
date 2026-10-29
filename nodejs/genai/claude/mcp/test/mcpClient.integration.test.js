/**
 * Integration test for mcpClient.js <-> mcpServer.js.
 *
 * Unlike the other test files, this one spawns a *real* MCP server child
 * process (exactly as chatbot.js does at runtime) and talks to it over the
 * real stdio transport. It deliberately only exercises tools from the
 * always-on "system info" group, so it needs no GitHub/Azure/Kubernetes/
 * database/Maps credentials and is safe to run in CI or inside the
 * Dockerfile's `npm test` build step.
 */
const assert = require('node:assert/strict');
const { test, describe, after } = require('node:test');

const { getClaudeToolDefinitions, callMcpTool, closeMcpClient } = require('../src/mcpClient');

after(async () => {
  await closeMcpClient();
});

describe('mcpClient <-> mcpServer (real stdio round trip)', () => {
  test('getClaudeToolDefinitions lists the always-on tools in Claude\'s format', async () => {
    const tools = await getClaudeToolDefinitions();

    assert.ok(Array.isArray(tools));
    assert.ok(tools.length >= 6, 'expected at least the 6 always-on system info tools');

    const scanTool = tools.find((t) => t.name === 'scan_network_for_ssh');
    assert.ok(scanTool, 'scan_network_for_ssh should be registered');
    assert.equal(scanTool.input_schema.type, 'object');
    assert.ok(typeof scanTool.description === 'string' && scanTool.description.length > 0);

    // sessionId is a needSession-only, server-side concept - it must never
    // be exposed to the model.
    tools.forEach((tool) => {
      assert.ok(
        !('sessionId' in tool.input_schema.properties),
        `${tool.name} must not expose a 'sessionId' property to the model`,
      );
      assert.ok(
        !tool.input_schema.required.includes('sessionId'),
        `${tool.name} must not require 'sessionId' from the model`,
      );
    });
  }, { timeout: 20_000 });

  test('callMcpTool runs a real tool end-to-end and injects sessionId server-side', async () => {
    const { text, isError } = await callMcpTool('integration-test-session', 'scan_network_for_ssh', {
      baseIp: '203.0.113', // TEST-NET-3 (RFC 5737) - guaranteed unreachable, won't false-positive
      startRange: 1,
      endRange: 1,
      port: 9,
      timeout: 50,
    });

    assert.equal(isError, false);
    assert.deepEqual(JSON.parse(text), []);
  }, { timeout: 20_000 });

  test('callMcpTool reports isError for an unknown tool name', async () => {
    const { isError, text } = await callMcpTool('integration-test-session', 'this_tool_does_not_exist', {});
    assert.equal(isError, true);
    assert.ok(text.length > 0);
  }, { timeout: 20_000 });

  test('callMcpTool reports isError when a required parameter is missing', async () => {
    // collect_basic_system_info has no required params, but
    // scan_network_for_ssh's zod schema still enforces types - passing a
    // string where a number is required must fail validation before the
    // underlying function ever runs (replacing the old manual
    // "missing required arguments" check in functions.js).
    const { isError } = await callMcpTool('integration-test-session', 'scan_network_for_ssh', {
      baseIp: '203.0.113',
      startRange: 'not-a-number',
    });
    assert.equal(isError, true);
  }, { timeout: 20_000 });
});
