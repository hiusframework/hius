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
  // A subset of citadel/ — files under citadel/contracts/, called out on
  // their own because contracts are what the RPC and MCP adapters (and
  // hius contract diff) are generated from, not just more citadel code.
  contracts: z.array(z.string()),
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

// A domain operation's boundary shape: one named, versioned input/output
// pair. This is what `citadel/contracts/*.ts` files export, and what the
// RPC adapter, the Application MCP Adapter, and `hius contract diff` all
// read instead of reaching into a domain's internals.
//
// version is a plain semver string the author bumps by hand — there's no
// inference from the shape alone (adding a field could be a widening or a
// breaking rename depending on intent, which the diff can flag but not
// decide).
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

export type Contract<Input extends z.ZodType = z.ZodType, Output extends z.ZodType = z.ZodType> = {
  name: string;
  version: string;
  input: Input;
  output: Output;
  description?: string;
};

// Authoring helper for `citadel/contracts/*.ts` — same fail-fast-on-typo
// role as defineModuleConfig, plus full inference of the input/output
// schema types (a plain object literal typed as `Contract` would widen
// input/output to the z.ZodType base and lose that).
export function defineContract<Input extends z.ZodType, Output extends z.ZodType>(contract: {
  name: string;
  version: string;
  input: Input;
  output: Output;
  description?: string;
}): Contract<Input, Output> {
  if (contract.name.trim().length === 0) {
    throw new Error("defineContract: name must not be empty");
  }
  if (!SEMVER_PATTERN.test(contract.version)) {
    throw new Error(
      `defineContract "${contract.name}": version "${contract.version}" is not valid semver (expected e.g. "1.0.0")`,
    );
  }
  if (!(contract.input instanceof z.ZodType)) {
    throw new Error(`defineContract "${contract.name}": input must be a Zod schema`);
  }
  if (!(contract.output instanceof z.ZodType)) {
    throw new Error(`defineContract "${contract.name}": output must be a Zod schema`);
  }
  return contract;
}
