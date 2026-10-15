#!/usr/bin/env node
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { EvaluateSchema } from "./schemas.js";
import { SystemOneClient, SystemOneError } from "./client.js";

const cfg = getConfig();
const client = new SystemOneClient(cfg);
const server = new McpServer({ name: "system-one-mcp", version: "0.1.0" });

server.tool("systemone_evaluate", "Answer typed choice/score/noul questions with a System One model (jev/nimble/kev/tev/laya).", EvaluateSchema.shape, async (args) => {
  try {
    const input = EvaluateSchema.parse(args);
    const res = await client.evaluate(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
  } catch (e: any) {
    const msg = e instanceof SystemOneError ? `SystemOne HTTP ${e.status}: ${e.body}` : (e?.message ?? String(e));
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
});

server.tool("systemone_list_models", "List available System One models on the configured backend.", {}, async () => {
  try {
    const res = await client.listModels();
    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
  } catch (e: any) {
    return { content: [{ type: "text" as const, text: `Error: ${e?.message ?? e}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
