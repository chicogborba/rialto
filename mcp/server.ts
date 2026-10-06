import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSwitchyardTools } from "../lib/mcp/register";
import { localCtx } from "../lib/mcp/tools";

// Local development server over stdio, talking straight to the local database as the built-in demo agent.
// For real use, connect to the hosted endpoint instead: see /connect. stdout is the protocol channel: never console.log here.

const server = new McpServer({ name: "switchyard", version: "0.2.0" });
registerSwitchyardTools(server, localCtx());

server.connect(new StdioServerTransport()).catch((e: unknown) => {
  console.error("[switchyard-mcp] failed to start", e);
  process.exit(1);
});
