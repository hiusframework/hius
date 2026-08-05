import { join } from "node:path";
import { toKebabCase, toPascalCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

function contractTemplate(contractName: string): string {
  return `import { defineContract } from "@hius/spec";
import { z } from "zod";

// Exposed as an MCP tool by the application's MCP adapter (@hius/mcp-adapter)
// and, from the same source, usable by the RPC/Contract-Client adapter — the
// input/output shapes below are the actual boundary an external caller sees,
// not an implementation detail.
export default defineContract({
  name: "${contractName}",
  version: "1.0.0",
  input: z.object({
    // TODO: describe this operation's input
  }),
  output: z.object({
    // TODO: describe this operation's output
  }),
});
`;
}

export type GeneratedMcpTool = {
  results: WriteResult[];
  contractName: string;
  contractVarName: string;
  wiringSnippet: string;
};

/**
 * Generates a contract skeleton under citadel/contracts/ rather than
 * registering the tool directly — same reasoning as generateEndpoint/
 * generateEvent: the app's MCP adapter composition (which binds contracts
 * to handlers via bindContract()) is a file the developer owns, so this
 * prints the snippet needed to wire it in instead of editing it.
 */
export async function generateMcpTool(
  appsDir: string,
  domain: string,
  operationName: string,
  force = false,
): Promise<GeneratedMcpTool> {
  const domainDir = join(appsDir, toKebabCase(domain));
  const contractName = toPascalCase(operationName);
  const contractFile = toKebabCase(operationName);
  const contractPath = join(domainDir, "citadel", "contracts", `${contractFile}.ts`);
  const contractVarName = `${contractName}Contract`;

  const results = [await writeGeneratedFile(contractPath, contractTemplate(contractName), force)];

  const wiringSnippet = `bindContract(${contractVarName}, async (input) => {
  throw new Error("${contractName} is not implemented yet");
});`;

  return { results, contractName, contractVarName, wiringSnippet };
}
