import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRialtoTools } from "../lib/mcp/register";
import { localCtx } from "../lib/mcp/tools";

// Local development server over stdio, talking straight to the local database as the built-in demo agent.
// For real use, connect to the hosted endpoint instead: see the Agents tab of your dashboard (/dashboard/agents). stdout is the protocol channel: never console.log here.

const server = new McpServer({ name: "rialto", version: "0.2.0" });
registerRialtoTools(server, localCtx());

server.connect(new StdioServerTransport()).catch((e: unknown) => {
  console.error("[rialto-mcp] failed to start", e);
  process.exit(1);
});
