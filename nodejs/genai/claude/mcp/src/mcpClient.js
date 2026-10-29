/**
 * Thin MCP client wrapper used by chatbot.js.
 *
 * Replaces the old in-process function registry from functions.js:
 * chatbot.js no longer calls tool implementations directly - it spawns the
 * MCP server in mcpServer.js as a child process (once, lazily, on first
 * use) and talks to it exclusively over the Model Context Protocol
 * (stdio transport).
 *
 * `sessionId` is never exposed to Claude as a tool parameter (see
 * getClaudeToolDefinitions), but every tool call is annotated with the
 * caller's sessionId (see callMcpTool) so that tools which need it
 * (needSession in mcpToolDefinitions.js) still receive it, exactly as
 * functions.js used to inject it as the function's first argument.
 */
const path = require('path');
// eslint-plugin-import's resolver doesn't follow this package's conditional
// "exports" subpaths, even though Node resolves them fine at runtime.
// eslint-disable-next-line import/no-unresolved
const { Client } = require('@modelcontextprotocol/sdk/client');
// eslint-disable-next-line import/no-unresolved, import/extensions
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const logger = require('./logger');

const MCP_SERVER_PATH = path.join(__dirname, 'mcpServer.js');

/** @type {Promise<Client>|null} */
let clientPromise = null;

/**
 * Lazily spawns the MCP server (src/mcpServer.js) as a child process and
 * connects an MCP client to it over stdio. Subsequent calls reuse the same
 * connection; a dropped connection is reconnected on the next call.
 * @returns {Promise<Client>} A connected MCP client.
 */
async function getMcpClient() {
  if (clientPromise) {
    return clientPromise;
  }

  clientPromise = (async () => {
    const transport = new StdioClientTransport({
      command: process.execPath, // The currently running `node` binary
      args: [MCP_SERVER_PATH],
      env: process.env,
    });

    const client = new Client({ name: 'chatbot-mcp-client', version: '1.0.0' });

    transport.onerror = (err) => {
      logger.error('MCP server transport error', err);
    };
    transport.onclose = () => {
      logger.warn('MCP server connection closed; it will be restarted on next use.');
      clientPromise = null;
    };

    await client.connect(transport);
    logger.info('Connected to MCP tools server');
    return client;
  })();

  try {
    return await clientPromise;
  } catch (err) {
    // Allow a future call to retry spawning the server rather than being
    // stuck on a permanently rejected promise.
    clientPromise = null;
    throw err;
  }
}

/**
 * Lists the tools exposed by the MCP server and converts them into Claude
 * Messages API tool definitions ({ name, description, input_schema }).
 * The internal `sessionId` property (see mcpServer.js) is stripped from
 * every tool's schema so the model never sees or has to supply it - the
 * chatbot injects the real value itself in callMcpTool.
 * @returns {Promise<Array<{name: string, description: string, input_schema: object}>>} Claude-formatted tool definitions.
 */
async function getClaudeToolDefinitions() {
  const client = await getMcpClient();
  const { tools } = await client.listTools();

  return tools.map((tool) => {
    const inputSchema = tool.inputSchema || { type: 'object', properties: {} };
    const properties = { ...(inputSchema.properties || {}) };
    const required = (inputSchema.required || []).filter((name) => name !== 'sessionId');
    delete properties.sessionId;

    return {
      name: tool.name,
      description: tool.description || '',
      input_schema: {
        type: 'object',
        properties,
        required,
      },
    };
  });
}

/**
 * Calls a tool on the MCP server on behalf of a chatbot session.
 * @param {string} sessionId The chatbot session ID making the call (injected for tools that need it).
 * @param {string} name The MCP tool name, as returned by getClaudeToolDefinitions.
 * @param {object} args The tool arguments chosen by the model (never includes sessionId).
 * @returns {Promise<{ text: string, isError: boolean }>} The tool's text result and whether it was an error.
 */
async function callMcpTool(sessionId, name, args) {
  const client = await getMcpClient();

  try {
    const result = await client.callTool({
      name,
      // Harmless for tools that don't declare a `sessionId` parameter -
      // the MCP server's zod schemas silently strip unknown properties.
      arguments: { ...args, sessionId },
    });

    const text = (result.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return { text, isError: Boolean(result.isError) };
  } catch (err) {
    logger.error(`MCP tool call failed for '${name}' [Session: ${sessionId}]`, err);
    return {
      text: JSON.stringify({ error: 'Function execution failed', details: err.message }),
      isError: true,
    };
  }
}

/**
 * Closes the connection to the MCP server (and terminates its child
 * process) if one is open. Mainly useful for tests and graceful shutdown -
 * normal request handling never needs to call this, since the connection
 * is reused for the lifetime of the chatbot process.
 * @returns {Promise<void>} Resolves once the client (if any) has closed.
 */
async function closeMcpClient() {
  if (!clientPromise) {
    return;
  }
  const pending = clientPromise;
  clientPromise = null;
  try {
    const client = await pending;
    await client.close();
  } catch (err) {
    logger.warn('Error while closing MCP client connection', err);
  }
}

module.exports = { getClaudeToolDefinitions, callMcpTool, closeMcpClient };
