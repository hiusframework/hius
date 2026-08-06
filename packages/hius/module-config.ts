import { resolve } from "node:path";
import type { ModuleConfig } from "@hius/spec";
import { ModuleConfigSchema } from "@hius/spec";

/**
 * Loads and validates `domains/<domain>/module.config.ts` — the hand-written
 * declaration of intent. Returns null if the domain has no config file at
 * all (a missing config is a validator violation, not a loader error —
 * see `@hius/core`'s "missing-config" check).
 */
export async function loadModuleConfig(
  appsDir: string,
  domainName: string,
): Promise<ModuleConfig | null> {
  // Bun.file() and dynamic import() resolve a bare relative string
  // differently: Bun.file() resolves it against cwd like every other fs
  // call, but import() treats anything not starting with "/"/"./"/"../"
  // as a bare package specifier and searches node_modules for it — so
  // the CLI's default `--dir domains` (relative, no "./") would pass the
  // Bun.file() existence check and then fail to import with a
  // "Cannot find module" error blaming node_modules. Resolving to an
  // absolute path upfront makes both calls agree.
  const path = `${resolve(appsDir)}/${domainName}/module.config.ts`;
  if (!(await Bun.file(path).exists())) return null;

  const mod = await import(path);
  return ModuleConfigSchema.parse(mod.default);
}

export async function loadAllModuleConfigs(
  appsDir: string,
  domainNames: string[],
): Promise<ModuleConfig[]> {
  const configs = await Promise.all(domainNames.map((name) => loadModuleConfig(appsDir, name)));
  return configs.filter((config): config is ModuleConfig => config !== null);
}
