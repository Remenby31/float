#!/usr/bin/env node
/**
 * Float MCP Server — single-tool CLI-like interface for task management.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FloatAPI } from "./api.js";
import { executeCommand } from "./commands.js";

const apiUrl =
  process.env.FLOAT_API_URL || "https://float.remenby.fr/api";
const email = process.env.FLOAT_EMAIL;
const password = process.env.FLOAT_PASSWORD;

if (!email || !password) {
  console.error(
    "FLOAT_EMAIL and FLOAT_PASSWORD environment variables are required"
  );
  process.exit(1);
}

const api = new FloatAPI(apiUrl, email, password);

const server = new McpServer({
  name: "float",
  version: "0.1.0",
});

server.tool(
  "float",
  `Task manager CLI. Commands:
  projects              List projects grouped by family
  tasks <project>       Tasks for a project (fuzzy match)
  pending               All pending tasks
  add <project> <title> Create a task
  done <id>             Check task
  undone <id>           Uncheck task
  due <id> <date>       Set due date/time (today 18h, ce soir, in 2 hours)
  weight <id> <level>   Set priority (low/medium/high/critical)
  label <id> [action]   Labels: add <name>, rm <name>
  note <id> [action]    View/edit notes (append/replace/set/clear)
  move <id> <project>   Move task
  rm <id>               Delete task`,
  { command: z.string().describe("Command to execute (e.g. 'projects', 'add Général Fix bug')") },
  async ({ command }) => {
    try {
      const result = await executeCommand(api, command);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
