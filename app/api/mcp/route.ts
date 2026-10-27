import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { appetite } from "@/lib/agent/appetite";
import { buyerFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { errorResponse, internalBase } from "@/lib/http";
import { instructionsFor } from "@/lib/mcp/instructions";
import { registerRialtoTools } from "@/lib/mcp/register";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hosted MCP endpoint (streamable HTTP, stateless). A buyer connects Claude Code / Codex with
 * `Authorization: Bearer rl_buyer_…`; every tool call then runs against THEIR wallet.
 */


async function serve(req: Request): Promise<Response> {
  let ctx;
  try {
    ctx = await buyerFromRequest(req, { requireKey: true });
  } catch (e) {
    return errorResponse(e);
  }
  const level = (await prisma.agent.findUnique({ where: { id: ctx.agentId }, select: { appetite: true } }))?.appetite;
  const server = new McpServer({ name: "rialto", version: "0.3.0" }, { instructions: instructionsFor(level) });
  registerRialtoTools(server, { agentId: ctx.agentId, baseUrl: internalBase(req), preset: appetite(level).preset });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
