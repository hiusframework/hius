import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  // Under this package rather than the OS tmpdir — get_contracts' fixtures
  // import "zod" by bare specifier to construct real schema instances, and
  // only here does node_modules resolution find the hoisted "zod" (same
  // reasoning as packages/hius/test/contracts.test.ts).
  appsDir = await mkdtemp(join(import.meta.dir, ".tmp-mcp-"));

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

test("get_contracts lists every domain's contracts with name, version, and JSON Schema", async () => {
  await writeFileIn(
    "billing",
    "citadel/contracts/charge-customer.ts",
    `import { z } from "zod";
export default {
  name: "ChargeCustomer",
  version: "1.0.0",
  description: "Charges a customer",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
};
`,
  );

  const result = await client.callTool({ name: "get_contracts", arguments: {} });
  const parsed = JSON.parse(textOf(result)) as {
    contracts: Array<{
      name: string;
      version: string;
      description: string | null;
      input: unknown;
      output: unknown;
    }>;
  };

  expect(parsed.contracts).toHaveLength(1);
  expect(parsed.contracts[0]?.name).toBe("ChargeCustomer");
  expect(parsed.contracts[0]?.version).toBe("1.0.0");
  expect(parsed.contracts[0]?.description).toBe("Charges a customer");
  expect(parsed.contracts[0]?.input).toMatchObject({
    properties: { customerId: expect.anything(), amount: expect.anything() },
  });
});

test("get_contracts returns an empty list for a project with no contracts", async () => {
  await writeFileIn("billing", "routes.ts", "export const routes = [];\n");

  const result = await client.callTool({ name: "get_contracts", arguments: {} });
  const parsed = JSON.parse(textOf(result)) as { contracts: unknown[] };

  expect(parsed.contracts).toEqual([]);
});

test("where_does_event_go finds every handler subscribed to an event name", async () => {
  await writeFileIn(
    "billing",
    "events.ts",
    `import { bus } from "../infra/bus";
import { onInvoicePaid } from "./citadel/handlers/on-invoice-paid";
bus.on("invoice.paid", onInvoicePaid);
`,
  );
  await writeFileIn(
    "notifications",
    "events.ts",
    `import { bus } from "../infra/bus";
import { sendReceipt } from "./citadel/handlers/send-receipt";
bus.on("invoice.paid", sendReceipt);
bus.on("invoice.refunded", sendReceipt);
`,
  );

  const result = await client.callTool({
    name: "where_does_event_go",
    arguments: { eventName: "invoice.paid" },
  });
  const parsed = JSON.parse(textOf(result)) as {
    subscribers: Array<{ domain: string; file: string; handler: string }>;
  };

  expect(parsed.subscribers).toHaveLength(2);
  expect(parsed.subscribers.map((s) => s.domain).sort()).toEqual(["billing", "notifications"]);
  expect(parsed.subscribers.find((s) => s.domain === "billing")?.handler).toBe("onInvoicePaid");
});

test("where_does_event_go returns an empty list for an event nothing subscribes to", async () => {
  await writeFileIn(
    "billing",
    "events.ts",
    `import { bus } from "../infra/bus";
bus.on("invoice.paid", () => {});
`,
  );

  const result = await client.callTool({
    name: "where_does_event_go",
    arguments: { eventName: "invoice.refunded" },
  });
  const parsed = JSON.parse(textOf(result)) as { subscribers: unknown[] };

  expect(parsed.subscribers).toEqual([]);
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
