import type { ValidationResult } from "@hius/core";
import { validate } from "@hius/core";
import { extractManifest } from "./extraction";
import { loadAllModuleConfigs } from "./module-config";

/**
 * The end-to-end path behind `hius validate`: discover domains, extract
 * their actual dependencies via static analysis, load every domain's
 * hand-written module.config, and compare intent against fact.
 */
export async function validateProject(appsDir: string): Promise<ValidationResult> {
  const manifest = await extractManifest(appsDir);
  const configs = await loadAllModuleConfigs(
    appsDir,
    manifest.domains.map((d) => d.name),
  );

  return validate(configs, manifest);
}
