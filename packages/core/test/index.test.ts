import { expect, test } from "bun:test";
import type { DomainFiles, ExtractedManifest, ModuleConfig } from "@hius/spec";
import { PACKAGE_NAME, validate } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/core");
});

const emptyFiles: DomainFiles = {
  routes: [],
  events: [],
  jobs: [],
  models: [],
  citadel: [],
  fortress: [],
};

function manifest(domains: ExtractedManifest["domains"]): ExtractedManifest {
  return { domains, extractedAt: new Date().toISOString() };
}

function domain(
  overrides: Partial<ExtractedManifest["domains"][number]> & { name: string },
): ExtractedManifest["domains"][number] {
  return { files: emptyFiles, actualDependencies: [], exports: [], ...overrides };
}

function config(overrides: Partial<ModuleConfig> & { name: string }): ModuleConfig {
  return { publicApi: [], allowedDependencies: [], publicErrors: [], ...overrides };
}

test("valid setup produces no violations", () => {
  const result = validate(
    [config({ name: "billing", allowedDependencies: ["users"] }), config({ name: "users" })],
    manifest([
      domain({ name: "billing", actualDependencies: ["users"] }),
      domain({ name: "users" }),
    ]),
  );

  expect(result).toEqual({ ok: true, violations: [] });
});

test("undeclared dependency is a violation with a corrective message", () => {
  const result = validate(
    [config({ name: "billing", allowedDependencies: ["users"] })],
    manifest([domain({ name: "billing", actualDependencies: ["users", "payments"] })]),
  );

  expect(result.ok).toBe(false);
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0]?.kind).toBe("undeclared-dependency");
  expect(result.violations[0]?.message).toContain("depends on `payments`");
  expect(result.violations[0]?.message).toContain("allowedDependencies for `billing`");
});

test("a domain present in the manifest without a module.config is a violation", () => {
  const result = validate([], manifest([domain({ name: "billing" })]));

  expect(result.ok).toBe(false);
  expect(result.violations[0]?.kind).toBe("missing-config");
});

test("shared is implicitly allowed without being listed in allowedDependencies", () => {
  const result = validate(
    [config({ name: "billing" }), config({ name: "shared" })],
    manifest([
      domain({ name: "billing", actualDependencies: ["shared"] }),
      domain({ name: "shared" }),
    ]),
  );

  expect(result.ok).toBe(true);
});

test("shared cannot depend on a domain", () => {
  const result = validate(
    [config({ name: "billing" }), config({ name: "shared" })],
    manifest([
      domain({ name: "billing" }),
      domain({ name: "shared", actualDependencies: ["billing"] }),
    ]),
  );

  expect(result.ok).toBe(false);
  expect(result.violations[0]?.kind).toBe("shared-depends-on-domain");
});

test("shared cannot export domain-specific code", () => {
  const result = validate(
    [config({ name: "billing" }), config({ name: "shared" })],
    manifest([
      domain({ name: "billing" }),
      domain({ name: "shared", exports: ["BillingInvoiceFormatter"] }),
    ]),
  );

  expect(result.ok).toBe(false);
  expect(result.violations[0]?.kind).toBe("shared-domain-specific-export");
  expect(result.violations[0]?.message).toContain("BillingInvoiceFormatter");
});

test("circular dependency between two domains is detected", () => {
  const result = validate(
    [
      config({ name: "billing", allowedDependencies: ["users"] }),
      config({ name: "users", allowedDependencies: ["billing"] }),
    ],
    manifest([
      domain({ name: "billing", actualDependencies: ["users"] }),
      domain({ name: "users", actualDependencies: ["billing"] }),
    ]),
  );

  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.kind === "circular-dependency")).toBe(true);
});
