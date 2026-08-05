import { expect, test } from "bun:test";
import { bindContract, defineContract } from "@hius/spec";
import { z } from "zod";
import { createLocalTransport, createRpcClient, PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/rpc");
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

test("calling a bound contract runs its handler and returns the parsed output", async () => {
  const transport = createLocalTransport([
    bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
  ]);
  const client = createRpcClient(transport);

  const result = await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });

  expect(result).toEqual({ chargeId: "ch_cust_1" });
});

test("input that violates the contract's input schema is rejected before the handler runs", async () => {
  let handlerRan = false;
  const transport = createLocalTransport([
    bindContract(ChargeCustomer, async () => {
      handlerRan = true;
      return { chargeId: "ch_1" };
    }),
  ]);
  const client = createRpcClient(transport);

  // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input to exercise validation
  expect(client.call(ChargeCustomer, { customerId: "cust_1" } as any)).rejects.toThrow();
  expect(handlerRan).toBe(false);
});

test("fields on the handler's result that aren't in the output schema never reach the caller", async () => {
  const transport = createLocalTransport([
    bindContract(
      ChargeCustomer,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately over-wide return to exercise output stripping
      async () => ({ chargeId: "ch_1", internalLedgerId: "secret-internal-id" }) as any,
    ),
  ]);
  const client = createRpcClient(transport);

  const result = await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });

  expect(result).toEqual({ chargeId: "ch_1" });
  expect(result).not.toHaveProperty("internalLedgerId");
});

test("calling a contract with no bound handler throws a clear error", async () => {
  const transport = createLocalTransport([]);
  const client = createRpcClient(transport);

  expect(client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 })).rejects.toThrow(
    'No handler bound for contract "ChargeCustomer"',
  );
});

test("a single transport serves multiple contracts independently", async () => {
  const transport = createLocalTransport([
    bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
    bindContract(RefundCustomer, async (input) => ({ refundId: `re_${input.chargeId}` })),
  ]);
  const client = createRpcClient(transport);

  const charge = await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });
  const refund = await client.call(RefundCustomer, { chargeId: charge.chargeId });

  expect(refund).toEqual({ refundId: "re_ch_cust_1" });
});

test("a handler that throws propagates the rejection to the caller", async () => {
  const transport = createLocalTransport([
    bindContract(ChargeCustomer, async () => {
      throw new Error("payment gateway unreachable");
    }),
  ]);
  const client = createRpcClient(transport);

  expect(client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 })).rejects.toThrow(
    "payment gateway unreachable",
  );
});
