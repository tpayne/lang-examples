/**
 * Thin MCP client wrapper used by chatbot.js.
 *
 * Replaces the old in-process function registry from functions.js:
 * chatbot.js no longer calls tool implementations directly - it talks to
 * the MCP server in mcpServer.js exclusively over the Model Context
 * Protocol, using one of two transports:
 *
 *  - stdio (default): spawns mcpServer.js as a local child process. Used
 *    whenever MCP_SERVER_URL is not set.
 *  - Streamable HTTPS (remote): connects to an already-running MCP server
 *    (started with MCP_TRANSPORT=httpStream - see mcpServer.js) over the
 *    network, when MCP_SERVER_URL is set. MCP_SERVER_AUTH_TOKEN must match
 *    that server's MCP_HTTP_AUTH_TOKEN.
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
// eslint-disable-next-line import/no-unresolved, import/extensions
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const logger = require('./logger');

const MCP_SERVER_PATH = path.join(__dirname, 'mcpServer.js');

/** @type {Promise<Client>|null} */
let clientPromise = null;

/**
 * Builds the transport to reach the MCP server with, based on whether
 * MCP_SERVER_URL is set.
 * @returns {import('@modelcontextprotocol/sdk/shared/transport.js').Transport} The transport to connect with.
 */
function buildTransport() {
  const remoteUrl = process.env.MCP_SERVER_URL;

  if (remoteUrl) {
    const headers = {};
    if (process.env.MCP_SERVER_AUTH_TOKEN) {
      headers.Authorization = `Bearer ${process.env.MCP_SERVER_AUTH_TOKEN}`;
    } else {
      logger.warn('MCP_SERVER_URL is set but MCP_SERVER_AUTH_TOKEN is not - the remote MCP server will likely reject this connection with 401.');
    }
    logger.info(`Connecting to remote MCP server at ${remoteUrl}`);
    return new StreamableHTTPClientTransport(new URL(remoteUrl), { requestInit: { headers } });
  }

  return new StdioClientTransport({
    command: process.execPath, // The currently running `node` binary
    args: [MCP_SERVER_PATH],
    env: process.env,
  });
}

/**
 * Lazily connects to the MCP server - spawning it locally over stdio, or
 * connecting to a remote instance over Streamable HTTPS, depending on
 * MCP_SERVER_URL (see buildTransport). Subsequent calls reuse the same
 * connection; a dropped connection is reconnected on the next call.
 * @returns {Promise<Client>} A connected MCP client.
 */
async function getMcpClient() {
  if (clientPromise) {
    return clientPromise;
  }

  clientPromise = (async () => {
    const transport = buildTransport();
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
