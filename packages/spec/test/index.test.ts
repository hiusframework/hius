import { expect, test } from "bun:test";
import {
  DomainFilesSchema,
  defineModuleConfig,
  ExtractedManifestSchema,
  ModuleConfigSchema,
  PACKAGE_NAME,
} from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/spec");
});

test("ModuleConfigSchema accepts a minimal valid config and defaults publicErrors", () => {
  const parsed = ModuleConfigSchema.parse({
    name: "billing",
    publicApi: ["./citadel/contracts/InvoiceContract"],
    allowedDependencies: ["users", "shared"],
  });

  expect(parsed.publicErrors).toEqual([]);
});

test("ModuleConfigSchema rejects a config missing required fields", () => {
  expect(() => ModuleConfigSchema.parse({ name: "billing" })).toThrow();
});

test("defineModuleConfig validates at definition time and infers the return type", () => {
  const config = defineModuleConfig({
    name: "billing",
    publicApi: [],
    allowedDependencies: ["users"],
  });

  expect(config.publicErrors).toEqual([]);
});

test("defineModuleConfig throws on an invalid config, same as the schema directly", () => {
  // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
  expect(() => defineModuleConfig({ name: "billing" } as any)).toThrow();
});

test("DomainFilesSchema requires every convention bucket to be present", () => {
  expect(() => DomainFilesSchema.parse({ routes: [] })).toThrow();

  const parsed = DomainFilesSchema.parse({
    routes: ["routes.ts"],
    events: [],
    jobs: [],
    models: [],
    citadel: [],
    fortress: [],
  });
  expect(parsed.routes).toEqual(["routes.ts"]);
});

test("ExtractedManifestSchema validates a full extracted manifest", () => {
  const parsed = ExtractedManifestSchema.parse({
    domains: [
      {
        name: "billing",
        files: {
          routes: ["routes.ts"],
          events: [],
          jobs: [],
          models: [],
          citadel: [],
          fortress: [],
        },
        actualDependencies: ["users"],
        exports: ["ChargeCustomer"],
      },
    ],
    extractedAt: new Date().toISOString(),
  });

  expect(parsed.domains).toHaveLength(1);
  expect(parsed.domains[0]?.actualDependencies).toEqual(["users"]);
});

test("ExtractedManifestSchema rejects a non-ISO extractedAt", () => {
  expect(() => ExtractedManifestSchema.parse({ domains: [], extractedAt: "not-a-date" })).toThrow();
});
