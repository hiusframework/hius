import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateProject } from "@/validate-project";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-validate-project-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

async function writeFileIn(domain: string, relativePath: string, contents: string): Promise<void> {
  const fullPath = join(appsDir, domain, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

test("a declared, matching dependency validates clean end-to-end", async () => {
  await writeFileIn("users", "citadel/service.ts", "export function chargeCustomer() {}\n");
  await writeFileIn(
    "users",
    "module.config.ts",
    `export default { name: "users", publicApi: [], allowedDependencies: [] };\n`,
  );
  await writeFileIn(
    "billing",
    "routes.ts",
    'import { chargeCustomer } from "../users/citadel/service";\nexport const routes = [chargeCustomer];\n',
  );
  await writeFileIn(
    "billing",
    "module.config.ts",
    `export default { name: "billing", publicApi: [], allowedDependencies: ["users"] };\n`,
  );

  const result = await validateProject(appsDir);

  expect(result.ok).toBe(true);
  expect(result.violations).toEqual([]);
});

test("a real cross-domain import not declared in module.config is a violation, end-to-end", async () => {
  await writeFileIn("users", "citadel/service.ts", "export function chargeCustomer() {}\n");
  await writeFileIn(
    "users",
    "module.config.ts",
    `export default { name: "users", publicApi: [], allowedDependencies: [] };\n`,
  );
  await writeFileIn(
    "billing",
    "routes.ts",
    'import { chargeCustomer } from "../users/citadel/service";\nexport const routes = [chargeCustomer];\n',
  );
  await writeFileIn(
    "billing",
    "module.config.ts",
    // allowedDependencies deliberately omits "users", despite the real import above
    `export default { name: "billing", publicApi: [], allowedDependencies: [] };\n`,
  );

  const result = await validateProject(appsDir);

  expect(result.ok).toBe(false);
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0]?.kind).toBe("undeclared-dependency");
  expect(result.violations[0]?.message).toContain("depends on `users`");
});

test("a domain with no module.config.ts is a violation", async () => {
  await writeFileIn("billing", "routes.ts", "export const routes = [];\n");

  const result = await validateProject(appsDir);

  expect(result.ok).toBe(false);
  expect(result.violations[0]?.kind).toBe("missing-config");
});
