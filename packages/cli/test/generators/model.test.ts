import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateModel, parseFieldSpecs, UnsupportedFieldTypeError } from "@/generators/model";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-model-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("parseFieldSpecs", () => {
  test("parses name:type pairs", () => {
    expect(parseFieldSpecs(["amount:money", "status:string"])).toEqual([
      { name: "amount", type: "money" },
      { name: "status", type: "string" },
    ]);
  });

  test("throws on a malformed spec", () => {
    expect(() => parseFieldSpecs(["amount"])).toThrow('Invalid field spec "amount"');
  });
});

describe("generateModel", () => {
  test("generates a Drizzle schema with the standard id/timestamp columns plus the given fields", async () => {
    await generateModel(appsDir, "billing", "Invoice", [
      "amount:money",
      "status:string",
      "customer:belongs_to",
    ]);

    const file = await Bun.file(join(appsDir, "billing", "models", "invoice.ts")).text();

    expect(file).toContain('pgTable("billing_invoices"');
    expect(file).toContain('amount: numeric("amount")');
    expect(file).toContain('status: text("status")');
    expect(file).toContain('customer: uuid("customer_id")'); // belongs_to -> FK column
    expect(file).toContain("id: uuid(");
    expect(file).toContain("created_at:");
    expect(file).toContain("export type Invoice =");
    expect(file).toContain("export type NewInvoice =");
  });

  test("generates a matching schema test file", async () => {
    await generateModel(appsDir, "billing", "Invoice", ["amount:money"]);

    const test = await Bun.file(
      join(appsDir, "billing", "models", "test", "invoice.test.ts"),
    ).text();
    expect(test).toContain('import { invoices } from "../invoice"');
  });

  test("rejects an unsupported field type before writing anything", async () => {
    expect(generateModel(appsDir, "billing", "Invoice", ["weird:jsonb"])).rejects.toThrow(
      UnsupportedFieldTypeError,
    );
    expect(await Bun.file(join(appsDir, "billing", "models", "invoice.ts")).exists()).toBe(false);
  });

  test("re-running without --force skips existing files", async () => {
    await generateModel(appsDir, "billing", "Invoice", ["amount:money"]);
    const results = await generateModel(appsDir, "billing", "Invoice", ["amount:money"]);

    expect(results.every((r) => r.skipped)).toBe(true);
  });
});
