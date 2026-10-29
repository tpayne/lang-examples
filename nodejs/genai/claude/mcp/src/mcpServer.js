/**
 * MCP server exposing every external integration (GitHub, Azure DevOps,
 * Kubernetes, Docker Hub, databases, DOSA/MOT history, Google Maps, system
 * info/SSH, ...) as MCP tools.
 *
 * This is the direct replacement for the old `functions.js` registry:
 * instead of the chatbot registering JavaScript functions directly into an
 * in-process map, the same functions (unchanged, still in gitFunctions.js,
 * k8s.js, etc.) are wrapped as tools on a FastMCP server. chatbot.js talks
 * to this process exclusively over the Model Context Protocol - see
 * mcpClient.js.
 *
 * Supports two transports, selected via MCP_TRANSPORT:
 *  - stdio (default) - spawned locally as a child process by mcpClient.js.
 *  - httpStream - MCP's Streamable HTTP transport, served over HTTPS only
 *    (never plain HTTP) for remote deployments. See README.md for the full
 *    set of MCP_HTTP_... / MCP_HTTPS_... environment variables this reads.
 *
 * Run standalone for manual testing:
 *   node src/mcpServer.js
 */
// The stdio MCP transport uses stdout exclusively for JSON-RPC messages, so
// nothing else in this process may write to it. dotenv prints a startup
// banner on every `dotenv.config()` call (including ones made deep inside
// required modules like dosaFunctions.js/mappingFunctions.js) unless this
// env var is set - set it before anything else loads.
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const winston = require('winston');
const { FastMCP } = require('fastmcp');
const { z } = require('zod');

const { getToolDefinitions } = require('./mcpToolDefinitions');
const { buildZodShape } = require('./jsonSchemaToZod');
const logger = require('./logger');

dotenv.config();

// logger.js's Console transport (shared with chatbot.js, where stdout
// logging is fine) defaults to writing there too, which would also corrupt
// the protocol stream - every log line would be parsed as a malformed
// JSON-RPC message. Redirect it to stderr for this process only;
// chatbot.js's own logging is unaffected since it runs in a separate
// process. `stderrLevels` must be a { levelName: true } set, not an array
// - see winston's Console transport source (_stringArrayToSet).
const allLevelsAsStderr = Object.fromEntries(Object.keys(logger.levels).map((level) => [level, true]));
logger.transports.forEach((transport) => {
  if (transport instanceof winston.transports.Console) {
    // eslint-disable-next-line no-param-reassign
    transport.stderrLevels = allLevelsAsStderr;
  }
});

/**
 * Authenticates an incoming request on the httpStream (Streamable HTTPS)
 * transport. Never invoked under stdio - there is no HTTP request to
 * authenticate there, since the server is a local child process only its
 * own parent (mcpClient.js) can talk to.
 *
 * These tools can run arbitrary SSH, Kubernetes, and database operations,
 * so a bearer token is mandatory once the server is reachable over the
 * network - there is no "open" mode for httpStream.
 * @param {import('http').IncomingMessage} request The incoming HTTP request.
 * @returns {Promise<Record<string, unknown>>} Opaque session auth data.
 */
async function authenticate(request) {
  const expectedToken = process.env.MCP_HTTP_AUTH_TOKEN;
  const [scheme, token] = (request.headers.authorization || '').split(' ');

  if (!expectedToken || scheme !== 'Bearer' || token !== expectedToken) {
    logger.warn(`Rejected unauthenticated MCP httpStream request from ${request.socket.remoteAddress}`);
    throw new Response(null, { status: 401, statusText: 'Unauthorized' });
  }

  return { authenticated: true };
}

/**
 * Builds the `httpStream` start() options for MCP's Streamable HTTP
 * transport, served over HTTPS only. Throws if MCP_HTTP_AUTH_TOKEN isn't
 * set, or if the TLS certificate/key can't be read - this transport must
 * never start up listening in the clear or without authentication.
 * @returns {object} Options to pass as `httpStream` to server.start().
 */
function resolveHttpStreamOptions() {
  if (!process.env.MCP_HTTP_AUTH_TOKEN) {
    throw new Error(
      'MCP_HTTP_AUTH_TOKEN must be set before starting the MCP server with '
      + 'MCP_TRANSPORT=httpStream - these tools can run arbitrary SSH/Kubernetes/'
      + 'database operations and must never be reachable over the network without authentication.',
    );
  }

  const certsDir = process.env.MCP_HTTPS_CERTS_DIR || '/app/certs';
  const certPath = process.env.MCP_HTTPS_CERT_PATH || path.join(certsDir, 'server.crt');
  const keyPath = process.env.MCP_HTTPS_KEY_PATH || path.join(certsDir, 'server.key');
  const caPath = process.env.MCP_HTTPS_CA_PATH;

  // FastMCP's httpStream transport (via mcp-proxy) reads these paths
  // itself - it wants file *paths* here, not file contents. Just check
  // they're readable up front so a bad path fails fast with a clear error
  // instead of a cryptic one from deep inside mcp-proxy.
  try {
    fs.accessSync(certPath, fs.constants.R_OK);
    fs.accessSync(keyPath, fs.constants.R_OK);
    if (caPath) fs.accessSync(caPath, fs.constants.R_OK);
  } catch (err) {
    throw new Error(
      'Could not read the TLS certificate/key for the MCP httpStream transport '
      + `(cert: ${certPath}, key: ${keyPath}): ${err.message}. This server only supports `
      + 'Streamable HTTPS for remote use, never plain HTTP - set MCP_HTTPS_CERT_PATH and '
      + 'MCP_HTTPS_KEY_PATH (or MCP_HTTPS_CERTS_DIR) to a valid certificate/key pair.',
    );
  }

  return {
    port: Number(process.env.MCP_HTTP_PORT) || 8181,
    host: process.env.MCP_HTTP_HOST || '0.0.0.0',
    endpoint: process.env.MCP_HTTP_ENDPOINT || '/mcp',
    sslCert: certPath,
    sslKey: keyPath,
    sslCa: caPath,
  };
}

/**
 * Builds the options to pass to `server.start()`, based on MCP_TRANSPORT.
 * @returns {{transportType: 'stdio'} | {transportType: 'httpStream', httpStream: object}} The resolved start() options.
 */
function resolveStartOptions() {
  const transport = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();
  if (transport === 'httpstream' || transport === 'http') {
    return { transportType: 'httpStream', httpStream: resolveHttpStreamOptions() };
  }
  return { transportType: 'stdio' };
}

/**
 * Registers a single tool definition (see mcpToolDefinitions.js) on the
 * given FastMCP server instance.
 * @param {import('fastmcp').FastMCP} server The FastMCP server to register the tool on.
 * @param {import('./mcpToolDefinitions').ToolDefinition} toolDef The tool definition to register.
 * @returns {void}
 */
function registerTool(server, toolDef) {
  const {
    name, func, params, description, parametersSchema, required, needSession,
  } = toolDef;

  const shape = buildZodShape(parametersSchema, required);
  if (needSession) {
    // Not shown to the model: chatbot.js strips this from the tool
    // definitions it hands to Claude, then injects the real value itself
    // when it calls the tool. This is the MCP equivalent of the old
    // `argValues.unshift(sessionId)` in functions.js::callFunctionByName.
    shape.sessionId = z.string().optional().describe(
      'Internal chatbot session identifier, injected automatically by the chatbot. Never set this yourself.',
    );
  }

  server.addTool({
    name,
    description,
    parameters: z.object(shape),
    execute: async (args) => {
      const { sessionId, ...rest } = args;
      const argValues = params.map((paramName) => rest[paramName]);
      if (needSession) {
        argValues.unshift(sessionId);
      }

      logger.info(`MCP tool invoked: ${name}`, { arguments: rest });
      /* eslint-disable prefer-spread */
      const result = await func.apply(null, argValues);
      /* eslint-enable prefer-spread */
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      logger.info(`MCP tool completed: ${name}`);
      return text;
    },
  });
}

/**
 * Builds a fresh FastMCP server instance with every available tool
 * registered. Exported mainly so tests/tooling can construct a server
 * without starting its transport.
 * @returns {import('fastmcp').FastMCP} The configured FastMCP server.
 */
function createServer() {
  const server = new FastMCP({
    name: 'chatbot-tools',
    version: '1.0.0',
    // Only ever invoked for the httpStream transport - see authenticate().
    authenticate,
  });

  const toolDefinitions = getToolDefinitions();
  toolDefinitions.forEach((toolDef) => registerTool(server, toolDef));
  logger.info(`MCP server configured with ${toolDefinitions.length} tool(s)`);

  return server;
}

if (require.main === module) {
  const server = createServer();

  let startOptions;
  try {
    startOptions = resolveStartOptions();
  } catch (err) {
    logger.error(`Failed to configure MCP server transport: ${err.message}`);
    process.exit(1);
  }

  server.start(startOptions);

  if (startOptions.transportType === 'httpStream') {
    const { host, port, endpoint } = startOptions.httpStream;
    logger.info(`MCP server listening for Streamable HTTPS connections on https://${host}:${port}${endpoint}`);
  }
}

module.exports = { createServer, resolveStartOptions };
