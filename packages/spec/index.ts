import { z } from "zod";

export const PACKAGE_NAME = "@hius/spec" as const;

// Two-part intent/fact model:
//  - ModuleConfigSchema is the hand-written declaration of intent, one per
//    domain (`apps/<domain>/module.config.ts`): what this domain exposes,
//    what it's allowed to depend on, which of its errors may cross the
//    boundary.
//  - ExtractedManifestSchema is the fact, produced by static analysis of
//    the actual file tree. The validator compares the two; divergence is
//    a build error.
//
// This package must stay a leaf: no imports from the runtime or from the
// validator that consumes these shapes.

export const ModuleConfigSchema = z.object({
  name: z.string(),
  publicApi: z.array(z.string()),
  allowedDependencies: z.array(z.string()),
  publicErrors: z.array(z.string()).default([]),
});
export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;

// Authoring helper for `apps/<domain>/module.config.ts` — validates at
// definition time (fails fast on a typo'd field) and gives the object
// literal full type inference without an explicit annotation.
export function defineModuleConfig(config: z.input<typeof ModuleConfigSchema>): ModuleConfig {
  return ModuleConfigSchema.parse(config);
}

export const DomainFilesSchema = z.object({
  routes: z.array(z.string()),
  events: z.array(z.string()),
  jobs: z.array(z.string()),
  models: z.array(z.string()),
  citadel: z.array(z.string()),
  fortress: z.array(z.string()),
});
export type DomainFiles = z.infer<typeof DomainFilesSchema>;

export const ExtractedDomainSchema = z.object({
  name: z.string(),
  files: DomainFilesSchema,
  actualDependencies: z.array(z.string()),
  exports: z.array(z.string()),
});
export type ExtractedDomain = z.infer<typeof ExtractedDomainSchema>;

export const ExtractedManifestSchema = z.object({
  domains: z.array(ExtractedDomainSchema),
  extractedAt: z.string().datetime(),
});
export type ExtractedManifest = z.infer<typeof ExtractedManifestSchema>;
