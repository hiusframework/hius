import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateMcpTool } from "@/generators/mcp-tool";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-mcp-tool-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("generateMcpTool", () => {
  test("generates a contract skeleton under citadel/contracts/", async () => {
    const { contractName, contractVarName } = await generateMcpTool(
      appsDir,
      "billing",
      "charge-customer",
    );

    expect(contractName).toBe("ChargeCustomer");
    expect(contractVarName).toBe("ChargeCustomerContract");

    const file = await Bun.file(
      join(appsDir, "billing", "citadel", "contracts", "charge-customer.ts"),
    ).text();
    expect(file).toContain('name: "ChargeCustomer"');
    expect(file).toContain("defineContract");
    expect(file).toContain('version: "1.0.0"');
  });

  test("normalizes an operation name given in any casing to PascalCase for the contract name", async () => {
    const { contractName } = await generateMcpTool(appsDir, "billing", "chargeCustomer");
    expect(contractName).toBe("ChargeCustomer");
  });

  test("returns the exact bindContract(...) snippet to wire the handler in", async () => {
    const { wiringSnippet } = await generateMcpTool(appsDir, "billing", "charge-customer");

    expect(wiringSnippet).toContain("bindContract(ChargeCustomerContract, async (input) => {");
    expect(wiringSnippet).toContain("not implemented yet");
  });

  test("re-running without --force skips existing files", async () => {
    await generateMcpTool(appsDir, "billing", "charge-customer");
    const { results } = await generateMcpTool(appsDir, "billing", "charge-customer");

    expect(results.every((r) => r.skipped)).toBe(true);
  });
});
