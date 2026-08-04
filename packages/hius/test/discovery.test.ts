import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverDomains } from "@/discovery";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-discovery-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

async function writeDomainFile(domain: string, relativePath: string): Promise<void> {
  const fullPath = join(appsDir, domain, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, "// fixture\n");
}

test("a missing apps directory yields no domains, not an error", async () => {
  const domains = await discoverDomains(join(appsDir, "does-not-exist"));
  expect(domains).toEqual([]);
});

test("an apps directory with no domain subdirectories yields no domains", async () => {
  const domains = await discoverDomains(appsDir);
  expect(domains).toEqual([]);
});

test("finds routes.ts/events.ts/jobs.ts by convention, leaves the rest empty", async () => {
  await writeDomainFile("billing", "routes.ts");
  await writeDomainFile("billing", "events.ts");

  const [billing] = await discoverDomains(appsDir);

  expect(billing?.name).toBe("billing");
  expect(billing?.files.routes).toEqual(["routes.ts"]);
  expect(billing?.files.events).toEqual(["events.ts"]);
  expect(billing?.files.jobs).toEqual([]);
  expect(billing?.files.models).toEqual([]);
});

test("collects nested files under models/, citadel/, and fortress/", async () => {
  await writeDomainFile("billing", "models/invoice.ts");
  await writeDomainFile("billing", "citadel/use-cases/charge-customer.ts");
  await writeDomainFile("billing", "fortress/http/billing.controller.ts");

  const [billing] = await discoverDomains(appsDir);

  expect(billing?.files.models).toEqual(["models/invoice.ts"]);
  expect(billing?.files.citadel).toEqual(["citadel/use-cases/charge-customer.ts"]);
  expect(billing?.files.fortress).toEqual(["fortress/http/billing.controller.ts"]);
});

test("detects the optional index.ts registration manifest", async () => {
  await writeDomainFile("billing", "routes.ts");
  await writeDomainFile("users", "routes.ts");
  await writeDomainFile("users", "index.ts");

  const domains = await discoverDomains(appsDir);
  const billing = domains.find((d) => d.name === "billing");
  const users = domains.find((d) => d.name === "users");

  expect(billing?.hasManifest).toBe(false);
  expect(users?.hasManifest).toBe(true);
});

test("returns domains sorted by name regardless of file-system order", async () => {
  await writeDomainFile("users", "routes.ts");
  await writeDomainFile("billing", "routes.ts");
  await writeDomainFile("notifications", "routes.ts");

  const domains = await discoverDomains(appsDir);

  expect(domains.map((d) => d.name)).toEqual(["billing", "notifications", "users"]);
});
