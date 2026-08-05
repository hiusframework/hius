import { expect, test } from "bun:test";
import { defineContract } from "@hius/spec";
import { z } from "zod";
import { diffContracts } from "@/index";

function chargeCustomer(overrides: {
  input?: Parameters<typeof z.object>[0];
  output?: Parameters<typeof z.object>[0];
}) {
  return defineContract({
    name: "ChargeCustomer",
    version: "1.0.0",
    input: z.object({ customerId: z.string(), ...overrides.input }),
    output: z.object({ chargeId: z.string(), ...overrides.output }),
  });
}

test("identical contracts produce no changes and a null severity", () => {
  const contract = chargeCustomer({});
  const result = diffContracts([contract], [contract]);

  expect(result).toEqual({ severity: null, changes: [] });
});

test("a brand new operation is a minor change", () => {
  const before = [chargeCustomer({})];
  const after = [
    chargeCustomer({}),
    defineContract({
      name: "RefundCustomer",
      version: "1.0.0",
      input: z.object({ chargeId: z.string() }),
      output: z.object({ refundId: z.string() }),
    }),
  ];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("minor");
  expect(result.changes).toEqual([
    {
      contractName: "RefundCustomer",
      severity: "minor",
      message: "[Hius] new operation `RefundCustomer`",
    },
  ]);
});

test("a removed operation is a major change", () => {
  const before = [chargeCustomer({})];
  const after: ReturnType<typeof chargeCustomer>[] = [];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("major");
  expect(result.changes[0]?.message).toContain("removed");
});

test("a new optional input field is a patch change", () => {
  const before = [chargeCustomer({})];
  const after = [chargeCustomer({ input: { note: z.string().optional() } })];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("patch");
  expect(result.changes[0]?.message).toContain("gained new optional field");
});

test("a new required input field is a major change", () => {
  const before = [chargeCustomer({})];
  const after = [chargeCustomer({ input: { amount: z.number() } })];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("major");
  expect(result.changes[0]?.message).toContain("gained new required field");
});

test("removing a field is major, whether from input or output", () => {
  const before = [chargeCustomer({ input: { amount: z.number() } })];
  const after = [chargeCustomer({})];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("major");
  expect(result.changes[0]?.message).toContain("removed field");
});

test("a field becoming required is major (narrowing), becoming optional is patch (widening)", () => {
  const optionalVersion = [chargeCustomer({ input: { note: z.string().optional() } })];
  const requiredVersion = [chargeCustomer({ input: { note: z.string() } })];

  expect(diffContracts(optionalVersion, requiredVersion).severity).toBe("major");
  expect(diffContracts(requiredVersion, optionalVersion).severity).toBe("patch");
});

test("changing a field's type is major", () => {
  const before = [chargeCustomer({})];
  const after = [chargeCustomer({ output: { chargeId: z.number() } })];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("major");
  expect(result.changes.some((c) => c.message.includes("changed type"))).toBe(true);
});

test("severity is the highest across all changes, not the last one computed", () => {
  const before = [chargeCustomer({})];
  const after = [
    chargeCustomer({ input: { note: z.string().optional() } }), // patch
    defineContract({
      name: "RefundCustomer",
      version: "1.0.0",
      input: z.object({}),
      output: z.object({}),
    }), // minor
  ];

  const result = diffContracts(before, after);

  expect(result.severity).toBe("minor");
});
