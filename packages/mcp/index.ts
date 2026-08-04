#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { extractManifest, loadAllModuleConfigs, validateProject } from "hius";
import { z } from "zod";

export const PACKAGE_NAME = "@hius/mcp" as const;

// Dev/Framework MCP — for a coding agent developing a Hius app, over the
// same core as `hius validate`/`hius explain`. Never deployed with the
// app itself; see @hius/mcp-adapter (a different, not-yet-built package)
// for exposing an application's own domain operations to external agents
// at runtime.
export function createServer(appsDir: string): McpServer {
  const server = new McpServer({ name: "hius", version: "0.0.1" });

  server.registerTool(
    "get_architecture",
    {
      description: "Full graph of every domain and its declared vs. actual dependencies",
    },
    async () => {
      const manifest = await extractManifest(appsDir);
      const configs = await loadAllModuleConfigs(
        appsDir,
        manifest.domains.map((d) => d.name),
      );
      const configByName = new Map(configs.map((c) => [c.name, c]));

      const domains = manifest.domains.map((domain) => ({
        name: domain.name,
        actualDependencies: domain.actualDependencies,
        allowedDependencies: configByName.get(domain.name)?.allowedDependencies ?? null,
      }));

      return { content: [{ type: "text", text: JSON.stringify({ domains }, null, 2) }] };
    },
  );

  server.registerTool(
    "get_domain",
    {
      description:
        "Context pack for one domain: public API, dependencies, files, exports — without the internals of any other domain",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const manifest = await extractManifest(appsDir);
      const domain = manifest.domains.find((d) => d.name === name);
      if (!domain) {
        return { content: [{ type: "text", text: `No such domain: ${name}` }], isError: true };
      }

      const [config] = await loadAllModuleConfigs(appsDir, [name]);
      const pack = {
        name: domain.name,
        files: domain.files,
        actualDependencies: domain.actualDependencies,
        exports: domain.exports,
        publicApi: config?.publicApi ?? null,
        allowedDependencies: config?.allowedDependencies ?? null,
        publicErrors: config?.publicErrors ?? null,
      };

      return { content: [{ type: "text", text: JSON.stringify(pack, null, 2) }] };
    },
  );

  server.registerTool(
    "validate_change",
    {
      description:
        "Runs the same boundary validator as `hius validate` — structured, corrective violations",
    },
    async () => {
      const result = await validateProject(appsDir);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    },
  );

  return server;
}

if (import.meta.main) {
  const appsDir = process.argv[2] ?? "apps";
  const server = createServer(appsDir);
  await server.connect(new StdioServerTransport());
}
