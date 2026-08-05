import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateApp } from "@/generators/app";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-app-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("generateApp", () => {
  test("creates a module.config.ts declaring the domain, empty and unblocked", async () => {
    await generateApp(appsDir, "billing");

    const config = await Bun.file(join(appsDir, "billing", "module.config.ts")).text();
    expect(config).toContain('name: "billing"');
    expect(config).toContain("publicApi: []");
    expect(config).toContain("allowedDependencies: []");
  });

  test("normalizes the domain name to kebab-case for the directory", async () => {
    await generateApp(appsDir, "BillingAccounts");

    expect(await Bun.file(join(appsDir, "billing-accounts", "module.config.ts")).exists()).toBe(
      true,
    );
  });

  test("creates citadel/ and fortress/ placeholders explaining the boundary", async () => {
    await generateApp(appsDir, "billing");

    const citadel = await Bun.file(join(appsDir, "billing", "citadel", "README.md")).text();
    const fortress = await Bun.file(join(appsDir, "billing", "fortress", "README.md")).text();

    expect(citadel).toContain("no imports");
    expect(citadel).toContain("from `hius`");
    expect(fortress).toContain("Framework-aware");
  });

  test("re-running without --force skips existing files", async () => {
    await generateApp(appsDir, "billing");
    const results = await generateApp(appsDir, "billing");

    expect(results.every((r) => r.skipped)).toBe(true);
  });
});
