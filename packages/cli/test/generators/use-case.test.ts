import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAcronyms } from "@/generators/naming";
import { generateUseCase } from "@/generators/use-case";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-use-case-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("generateUseCase", () => {
  test("generates a factory function named after the use case", async () => {
    await generateUseCase(appsDir, "billing", "charge-customer");

    const file = await Bun.file(
      join(appsDir, "billing", "citadel", "use-cases", "charge-customer.ts"),
    ).text();

    expect(file).toContain("export const createChargeCustomer");
    expect(file).not.toContain('from "hius"');
  });

  test("generates a matching test file importing the factory", async () => {
    await generateUseCase(appsDir, "billing", "charge-customer");

    const test = await Bun.file(
      join(appsDir, "billing", "citadel", "use-cases", "test", "charge-customer.test.ts"),
    ).text();

    expect(test).toContain('import { createChargeCustomer } from "../charge-customer"');
  });

  test("accepts a camelCase name and normalizes the filename", async () => {
    await generateUseCase(appsDir, "billing", "chargeCustomer");

    expect(
      await Bun.file(
        join(appsDir, "billing", "citadel", "use-cases", "charge-customer.ts"),
      ).exists(),
    ).toBe(true);
  });

  test("without a registered acronym, HR degrades to a plain capitalized word", async () => {
    await generateUseCase(appsDir, "hr", "sync-hr-portal");

    const file = await Bun.file(
      join(appsDir, "hr", "citadel", "use-cases", "sync-hr-portal.ts"),
    ).text();

    expect(file).toContain("export const createSyncHrPortal");
  });

  test("a registered acronym keeps its exact casing in the generated factory name", async () => {
    await generateUseCase(appsDir, "hr", "sync-hr-portal", false, createAcronyms(["HR"]));

    const file = await Bun.file(
      join(appsDir, "hr", "citadel", "use-cases", "sync-hr-portal.ts"),
    ).text();
    const test = await Bun.file(
      join(appsDir, "hr", "citadel", "use-cases", "test", "sync-hr-portal.test.ts"),
    ).text();

    expect(file).toContain("export const createSyncHRPortal");
    expect(test).toContain('import { createSyncHRPortal } from "../sync-hr-portal"');
  });
});
