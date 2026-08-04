import type { ModuleConfig } from "@hius/spec";
import { ModuleConfigSchema } from "@hius/spec";

/**
 * Loads and validates `apps/<domain>/module.config.ts` — the hand-written
 * declaration of intent. Returns null if the domain has no config file at
 * all (a missing config is a validator violation, not a loader error —
 * see `@hius/core`'s "missing-config" check).
 */
export async function loadModuleConfig(
  appsDir: string,
  domainName: string,
): Promise<ModuleConfig | null> {
  const path = `${appsDir}/${domainName}/module.config.ts`;
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
