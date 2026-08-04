import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllModuleConfigs, loadModuleConfig } from "@/module-config";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-module-config-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

// A fixture module.config.ts must not import "@hius/spec" by bare
// specifier: it lives under a temp directory outside the workspace, so
// there's no node_modules for Bun to walk up to and resolve it against.
// A plain object literal is what loadModuleConfig actually consumes
// anyway (it validates whatever `mod.default` turns out to be).
async function writeConfig(domain: string, contents: string): Promise<void> {
  const dir = join(appsDir, domain);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "module.config.ts"), contents);
}

test("loads and validates a module.config.ts", async () => {
  await writeConfig(
    "billing",
    `export default {
  name: "billing",
  publicApi: ["./citadel/contracts/InvoiceContract"],
  allowedDependencies: ["users"],
};
`,
  );

  const config = await loadModuleConfig(appsDir, "billing");
  expect(config?.name).toBe("billing");
  expect(config?.allowedDependencies).toEqual(["users"]);
  expect(config?.publicErrors).toEqual([]);
});

test("returns null when a domain has no module.config.ts", async () => {
  await mkdir(join(appsDir, "billing"), { recursive: true });
  const config = await loadModuleConfig(appsDir, "billing");
  expect(config).toBeNull();
});

test("throws when the config file doesn't match the schema", async () => {
  await writeConfig("billing", `export default { name: "billing" };\n`);
  expect(loadModuleConfig(appsDir, "billing")).rejects.toThrow();
});

test("loadAllModuleConfigs skips domains without a config and keeps the rest", async () => {
  await writeConfig(
    "billing",
    `export default { name: "billing", publicApi: [], allowedDependencies: [] };\n`,
  );
  await mkdir(join(appsDir, "users"), { recursive: true }); // no config

  const configs = await loadAllModuleConfigs(appsDir, ["billing", "users"]);

  expect(configs).toHaveLength(1);
  expect(configs[0]?.name).toBe("billing");
});
