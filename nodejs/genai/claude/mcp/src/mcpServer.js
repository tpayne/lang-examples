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
 * Run standalone for manual testing:
 *   node src/mcpServer.js
 */
// The stdio MCP transport uses stdout exclusively for JSON-RPC messages, so
// nothing else in this process may write to it. dotenv prints a startup
// banner on every `dotenv.config()` call (including ones made deep inside
// required modules like dosaFunctions.js/mappingFunctions.js) unless this
// env var is set - set it before anything else loads.
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';

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
  });

  const toolDefinitions = getToolDefinitions();
  toolDefinitions.forEach((toolDef) => registerTool(server, toolDef));
  logger.info(`MCP server configured with ${toolDefinitions.length} tool(s)`);

  return server;
}

if (require.main === module) {
  const server = createServer();
  server.start({ transportType: 'stdio' });
}

module.exports = { createServer };
