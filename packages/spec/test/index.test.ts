import { expect, test } from "bun:test";
import { z } from "zod";
import {
  bindContract,
  DomainFilesSchema,
  defineContract,
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
    contracts: [],
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
          contracts: [],
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

test("defineContract validates at definition time and infers input/output types", () => {
  const contract = defineContract({
    name: "ChargeCustomer",
    version: "1.0.0",
    input: z.object({ customerId: z.string(), amount: z.number() }),
    output: z.object({ chargeId: z.string() }),
  });

  expect(contract.name).toBe("ChargeCustomer");
  const parsedInput = contract.input.parse({ customerId: "c_1", amount: 100 });
  expect(parsedInput).toEqual({ customerId: "c_1", amount: 100 });
});

test("defineContract rejects an empty name", () => {
  expect(() =>
    defineContract({
      name: "",
      version: "1.0.0",
      input: z.object({}),
      output: z.object({}),
    }),
  ).toThrow("name must not be empty");
});

test("defineContract rejects a non-semver version", () => {
  expect(() =>
    defineContract({
      name: "ChargeCustomer",
      version: "v1",
      input: z.object({}),
      output: z.object({}),
    }),
  ).toThrow("not valid semver");
});

test("defineContract accepts pre-release and build-metadata semver", () => {
  expect(() =>
    defineContract({
      name: "ChargeCustomer",
      version: "1.0.0-beta.1+build.5",
      input: z.object({}),
      output: z.object({}),
    }),
  ).not.toThrow();
});

test("bindContract pairs a contract with its handler, inferring the handler's input/output types", async () => {
  const contract = defineContract({
    name: "ChargeCustomer",
    version: "1.0.0",
    input: z.object({ customerId: z.string() }),
    output: z.object({ chargeId: z.string() }),
  });

  const binding = bindContract(contract, async (input) => ({
    chargeId: `ch_${input.customerId}`,
  }));

  expect(binding.contract).toBe(contract);
  await expect(binding.handler({ customerId: "cust_1" })).resolves.toEqual({
    chargeId: "ch_cust_1",
  });
});
