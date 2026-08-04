import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractManifest } from "@/extraction";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-extraction-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

async function writeDomainFile(
  domain: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const fullPath = join(appsDir, domain, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

test("a domain with no cross-domain imports has no dependencies", async () => {
  await writeDomainFile("users", "citadel/service.ts", "export function createUser() {}\n");

  const manifest = await extractManifest(appsDir);
  const users = manifest.domains.find((d) => d.name === "users");

  expect(users?.actualDependencies).toEqual([]);
  expect(users?.exports).toEqual(["createUser"]);
});

test("a relative import into another domain's directory is detected as a dependency", async () => {
  await writeDomainFile("users", "citadel/service.ts", "export function chargeCustomer() {}\n");
  await writeDomainFile(
    "billing",
    "routes.ts",
    'import { chargeCustomer } from "../users/citadel/service";\nexport const routes = [chargeCustomer];\n',
  );

  const manifest = await extractManifest(appsDir);
  const billing = manifest.domains.find((d) => d.name === "billing");

  expect(billing?.actualDependencies).toEqual(["users"]);
});

test("an import within the same domain is not counted as a dependency on itself", async () => {
  await writeDomainFile("billing", "citadel/charge.ts", "export function charge() {}\n");
  await writeDomainFile(
    "billing",
    "routes.ts",
    'import { charge } from "./citadel/charge";\nexport const routes = [charge];\n',
  );

  const manifest = await extractManifest(appsDir);
  const billing = manifest.domains.find((d) => d.name === "billing");

  expect(billing?.actualDependencies).toEqual([]);
});

test("dependencies are deduplicated across multiple files and imports", async () => {
  await writeDomainFile(
    "users",
    "citadel/service.ts",
    "export function a() {}\nexport function b() {}\n",
  );
  await writeDomainFile(
    "billing",
    "routes.ts",
    'import { a } from "../users/citadel/service";\nexport const x = a;\n',
  );
  await writeDomainFile(
    "billing",
    "events.ts",
    'import { b } from "../users/citadel/service";\nexport const y = b;\n',
  );

  const manifest = await extractManifest(appsDir);
  const billing = manifest.domains.find((d) => d.name === "billing");

  expect(billing?.actualDependencies).toEqual(["users"]);
});

test("an import of an external package is not treated as a domain dependency", async () => {
  await writeDomainFile(
    "billing",
    "routes.ts",
    'import { z } from "zod";\nexport const schema = z.object({});\n',
  );

  const manifest = await extractManifest(appsDir);
  const billing = manifest.domains.find((d) => d.name === "billing");

  expect(billing?.actualDependencies).toEqual([]);
});

test("an empty apps directory extracts to an empty domain list", async () => {
  const manifest = await extractManifest(appsDir);
  expect(manifest.domains).toEqual([]);
});
