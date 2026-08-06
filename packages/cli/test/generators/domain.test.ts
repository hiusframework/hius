import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDomain } from "@/generators/domain";

let domainsDir: string;

beforeEach(async () => {
  domainsDir = await mkdtemp(join(tmpdir(), "hius-generate-domain-"));
});

afterEach(async () => {
  await rm(domainsDir, { recursive: true, force: true });
});

describe("generateDomain", () => {
  test("creates a module.config.ts declaring the domain, empty and unblocked", async () => {
    await generateDomain(domainsDir, "billing");

    const config = await Bun.file(join(domainsDir, "billing", "module.config.ts")).text();
    expect(config).toContain('name: "billing"');
    expect(config).toContain("publicApi: []");
    expect(config).toContain("allowedDependencies: []");
  });

  test("normalizes the domain name to kebab-case for the directory", async () => {
    await generateDomain(domainsDir, "BillingAccounts");

    expect(await Bun.file(join(domainsDir, "billing-accounts", "module.config.ts")).exists()).toBe(
      true,
    );
  });

  test("creates citadel/ and fortress/ placeholders explaining the boundary", async () => {
    await generateDomain(domainsDir, "billing");

    const citadel = await Bun.file(join(domainsDir, "billing", "citadel", "README.md")).text();
    const fortress = await Bun.file(join(domainsDir, "billing", "fortress", "README.md")).text();

    expect(citadel).toContain("no imports");
    expect(citadel).toContain("from `hius`");
    expect(fortress).toContain("Framework-aware");
  });

  test("re-running without --force skips existing files", async () => {
    await generateDomain(domainsDir, "billing");
    const results = await generateDomain(domainsDir, "billing");

    expect(results.every((r) => r.skipped)).toBe(true);
  });
});
