import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/mcp");
});

let appsDir: string;
let client: Client;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-mcp-"));

  const server = createServer(appsDir);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client.close();
  await rm(appsDir, { recursive: true, force: true });
});

async function writeFileIn(domain: string, relativePath: string, contents: string): Promise<void> {
  const fullPath = join(appsDir, domain, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  if (first?.type !== "text" || typeof first.text !== "string") {
    throw new Error("expected a text content block");
  }
  return first.text;
}

test("get_architecture reports every domain's actual and allowed dependencies", async () => {
  await writeFileIn("users", "citadel/service.ts", "export function chargeCustomer() {}\n");
  await writeFileIn(
    "users",
    "module.config.ts",
    `export default { name: "users", publicApi: [], allowedDependencies: [] };\n`,
  );
  await writeFileIn(
    "billing",
    "routes.ts",
    'import { chargeCustomer } from "../users/citadel/service";\nexport const routes = [chargeCustomer];\n',
  );
  await writeFileIn(
    "billing",
    "module.config.ts",
    `export default { name: "billing", publicApi: [], allowedDependencies: ["users"] };\n`,
  );

  const result = await client.callTool({ name: "get_architecture", arguments: {} });
  const parsed = JSON.parse(textOf(result)) as {
    domains: Array<{
      name: string;
      actualDependencies: string[];
      allowedDependencies: string[] | null;
    }>;
  };

  const billing = parsed.domains.find((d) => d.name === "billing");
  expect(billing?.actualDependencies).toEqual(["users"]);
  expect(billing?.allowedDependencies).toEqual(["users"]);
});

test("get_domain returns a context pack scoped to just that domain", async () => {
  await writeFileIn("billing", "citadel/charge.ts", "export function chargeCustomer() {}\n");
  await writeFileIn(
    "billing",
    "module.config.ts",
    `export default { name: "billing", publicApi: ["./citadel/charge"], allowedDependencies: [] };\n`,
  );

  const result = await client.callTool({ name: "get_domain", arguments: { name: "billing" } });
  const pack = JSON.parse(textOf(result)) as {
    name: string;
    exports: string[];
    publicApi: string[];
  };

  expect(pack.name).toBe("billing");
  expect(pack.exports).toEqual(["chargeCustomer"]);
  expect(pack.publicApi).toEqual(["./citadel/charge"]);
});

test("get_domain reports an error for an unknown domain instead of throwing", async () => {
  const result = await client.callTool({ name: "get_domain", arguments: { name: "ghost" } });
  expect(result.isError).toBe(true);
});

test("validate_change reports ok: true for a clean project", async () => {
  await writeFileIn(
    "billing",
    "module.config.ts",
    `export default { name: "billing", publicApi: [], allowedDependencies: [] };\n`,
  );

  const result = await client.callTool({ name: "validate_change", arguments: {} });
  const parsed = JSON.parse(textOf(result)) as { ok: boolean };

  expect(result.isError).toBeFalsy();
  expect(parsed.ok).toBe(true);
});

test("validate_change surfaces the same corrective violation messages hius validate does", async () => {
  await writeFileIn("billing", "routes.ts", "export const routes = [];\n");
  // deliberately no module.config.ts

  const result = await client.callTool({ name: "validate_change", arguments: {} });
  const parsed = JSON.parse(textOf(result)) as {
    ok: boolean;
    violations: Array<{ message: string }>;
  };

  expect(result.isError).toBe(true);
  expect(parsed.ok).toBe(false);
  expect(parsed.violations[0]?.message).toContain("no module.config found for `billing`");
});
