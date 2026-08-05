import { afterEach, expect, test } from "bun:test";
import { defineContract } from "@hius/spec";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { bindContract, createMcpAdapter, PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/mcp-adapter");
});

const ChargeCustomer = defineContract({
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
});

const RefundCustomer = defineContract({
  name: "RefundCustomer",
  version: "1.0.0",
  input: z.object({ chargeId: z.string() }),
  output: z.object({ refundId: z.string() }),
});

let client: Client;

async function connect(server: ReturnType<typeof createMcpAdapter>): Promise<void> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
}

afterEach(async () => {
  await client?.close();
});

test("exposes one tool per binding, named in snake_case from the contract's PascalCase name", async () => {
  await connect(
    createMcpAdapter([
      bindContract(ChargeCustomer, async () => ({ chargeId: "ch_1" })),
      bindContract(RefundCustomer, async () => ({ refundId: "re_1" })),
    ]),
  );

  const { tools } = await client.listTools();

  expect(tools.map((t) => t.name).sort()).toEqual(["charge_customer", "refund_customer"]);
});

test("calling a tool parses input, runs the handler, and returns structured output", async () => {
  await connect(
    createMcpAdapter([
      bindContract(ChargeCustomer, async (input) => {
        expect(input).toEqual({ customerId: "cust_1", amount: 100 });
        return { chargeId: "ch_1" };
      }),
    ]),
  );

  const result = await client.callTool({
    name: "charge_customer",
    arguments: { customerId: "cust_1", amount: 100 },
  });

  expect(result.isError).toBeFalsy();
  expect(result.structuredContent).toEqual({ chargeId: "ch_1" });
});

test("input that violates the contract's schema is rejected before the handler runs", async () => {
  let handlerRan = false;
  await connect(
    createMcpAdapter([
      bindContract(ChargeCustomer, async () => {
        handlerRan = true;
        return { chargeId: "ch_1" };
      }),
    ]),
  );

  const result = await client.callTool({
    name: "charge_customer",
    arguments: { customerId: "cust_1" }, // missing required `amount`
  });

  expect(result.isError).toBe(true);
  expect(handlerRan).toBe(false);
});

test("a handler that throws is reported as an isError tool result, not an unhandled rejection", async () => {
  await connect(
    createMcpAdapter([
      bindContract(ChargeCustomer, async () => {
        throw new Error("payment gateway unreachable");
      }),
    ]),
  );

  const result = await client.callTool({
    name: "charge_customer",
    arguments: { customerId: "cust_1", amount: 100 },
  });

  expect(result.isError).toBe(true);
  const content = result.content as Array<{ type: string; text?: string }>;
  expect(content[0]?.text).toContain("payment gateway unreachable");
});

test("output that doesn't match the contract's output schema is rejected", async () => {
  await connect(
    createMcpAdapter([
      // biome-ignore lint/suspicious/noExplicitAny: deliberately wrong shape to exercise output validation
      bindContract(ChargeCustomer, async () => ({ wrongField: "oops" }) as any),
    ]),
  );

  const result = await client.callTool({
    name: "charge_customer",
    arguments: { customerId: "cust_1", amount: 100 },
  });

  expect(result.isError).toBe(true);
});

test("two contracts that collide on the same tool name fail fast at adapter construction", () => {
  const DuplicateName = defineContract({
    name: "charge_customer", // already snake_case, collides with ChargeCustomer's converted name
    version: "1.0.0",
    input: z.object({}),
    output: z.object({}),
  });

  expect(() =>
    createMcpAdapter([
      bindContract(ChargeCustomer, async () => ({ chargeId: "ch_1" })),
      bindContract(DuplicateName, async () => ({})),
    ]),
  ).toThrow("already registered");
});
