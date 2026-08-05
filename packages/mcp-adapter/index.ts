import type { ContractBinding } from "@hius/spec";
import { bindContract } from "@hius/spec";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const PACKAGE_NAME = "@hius/mcp-adapter" as const;

// The Application MCP Adapter — exposes a deployed app's own domain
// contracts as MCP tools for external agents to call. Distinct from
// `@hius/mcp` (the dev/framework MCP, which a coding agent uses to work
// on the Hius app itself and which never ships with it): this one lives
// in Fortress and ships with the application, alongside the HTTP and RPC
// adapters, all generated from the same contracts.

// bindContract/ContractBinding live in @hius/spec — the RPC adapter binds
// contracts to handlers the same way, so the pairing isn't MCP-specific.
// Re-exported here so existing imports from this package keep working.
export type { ContractBinding };
export { bindContract };

// MCP tool names are conventionally snake_case (see `@hius/mcp`'s
// get_architecture/get_domain/validate_change) — contract names are
// PascalCase operation names (ChargeCustomer), so this converts one to
// the other rather than exposing the naming mismatch to callers.
function toToolName(contractName: string): string {
  return contractName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase();
}

export type McpAdapterOptions = {
  name?: string;
  version?: string;
};

/**
 * Builds the MCP server for an application's contracts. Input is parsed
 * and output validated against the contract's schemas by the MCP SDK
 * itself before/after the handler runs — this only wires the contract to
 * the handler and shapes the result the SDK expects. A handler that
 * throws is turned into an `isError` tool result by the SDK's own
 * request handling, not by anything here.
 */
export function createMcpAdapter(
  bindings: ContractBinding[],
  options: McpAdapterOptions = {},
): McpServer {
  const server = new McpServer({
    name: options.name ?? "hius-app",
    version: options.version ?? "0.0.1",
  });

  for (const { contract, handler } of bindings) {
    server.registerTool(
      toToolName(contract.name),
      {
        description: contract.description ?? `${contract.name} (v${contract.version})`,
        inputSchema: contract.input,
        outputSchema: contract.output,
      },
      async (input) => {
        const output = await handler(input);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          // The array of bindings is deliberately heterogeneous (each
          // contract has its own Input/Output), so TS widens `output` to
          // the base Contract's inference here — the SDK re-validates it
          // against the contract's actual output schema at runtime.
          structuredContent: output as Record<string, unknown>,
        };
      },
    );
  }

  return server;
}
