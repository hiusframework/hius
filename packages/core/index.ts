import type { Contract, ExtractedManifest, ModuleConfig } from "@hius/spec";
import { z } from "zod";

// Must never import from `hius` (the runtime) — this package works only
// against the extracted manifest, never the runtime that produced it.
export const PACKAGE_NAME = "@hius/core" as const;

const SHARED_DOMAIN = "shared";

export type ViolationKind =
  | "missing-config"
  | "undeclared-dependency"
  | "circular-dependency"
  | "shared-depends-on-domain"
  | "shared-domain-specific-export";

export type Violation = {
  kind: ViolationKind;
  domain: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  violations: Violation[];
};

/**
 * Compares declared intent (module.config, hand-written) against the
 * extracted fact (static analysis of the actual file tree). Divergence is
 * a violation — the manifest is never wrong, only the code or the config.
 */
export function validate(configs: ModuleConfig[], manifest: ExtractedManifest): ValidationResult {
  const configByName = new Map(configs.map((c) => [c.name, c]));
  const violations: Violation[] = [];

  for (const domain of manifest.domains) {
    const config = configByName.get(domain.name);

    if (!config) {
      violations.push({
        kind: "missing-config",
        domain: domain.name,
        message: `[Hius] no module.config found for \`${domain.name}\` — every domain needs one declaring its public API and allowed dependencies.`,
      });
      continue;
    }

    if (domain.name === SHARED_DOMAIN) {
      violations.push(...validateSharedDomain(domain, manifest));
      continue;
    }

    const allowed = new Set([...config.allowedDependencies, SHARED_DOMAIN]);
    for (const dependency of domain.actualDependencies) {
      if (!allowed.has(dependency)) {
        violations.push({
          kind: "undeclared-dependency",
          domain: domain.name,
          message: formatUndeclaredDependencyMessage(domain.name, dependency, config),
        });
      }
    }
  }

  violations.push(...findCircularDependencies(manifest));

  return { ok: violations.length === 0, violations };
}

function validateSharedDomain(
  shared: ExtractedManifest["domains"][number],
  manifest: ExtractedManifest,
): Violation[] {
  const violations: Violation[] = [];

  if (shared.actualDependencies.length > 0) {
    violations.push({
      kind: "shared-depends-on-domain",
      domain: SHARED_DOMAIN,
      message: `[Hius] \`shared\` cannot depend on domains — found dependency on ${shared.actualDependencies
        .map((d) => `\`${d}\``)
        .join(
          ", ",
        )}. Shared is a leaf: every domain may depend on it, it may depend on nothing domain-specific.`,
    });
  }

  const otherDomainNames = manifest.domains
    .map((d) => d.name)
    .filter((name) => name !== SHARED_DOMAIN);
  for (const exportName of shared.exports) {
    const referencedDomain = otherDomainNames.find((name) =>
      exportName.toLowerCase().includes(name.toLowerCase()),
    );
    if (referencedDomain) {
      violations.push({
        kind: "shared-domain-specific-export",
        domain: SHARED_DOMAIN,
        message: `[Hius] \`shared\` must not contain domain-specific code — export \`${exportName}\` references domain \`${referencedDomain}\`. Move it into that domain, or generalize it into a domain-agnostic type/utility.`,
      });
    }
  }

  return violations;
}

function formatUndeclaredDependencyMessage(
  domainName: string,
  dependency: string,
  config: ModuleConfig,
): string {
  const allowedList =
    config.allowedDependencies.length > 0 ? config.allowedDependencies.join(", ") : "(none)";
  return [
    `[Hius] boundary violation in \`${domainName}\`:`,
    `  depends on \`${dependency}\`, which is not in its allowed dependencies`,
    `  → add \`${dependency}\` to module.config's allowedDependencies for \`${domainName}\``,
    "  → or route through a public contract/event if this dependency shouldn't exist",
    `  (module.config for \`${domainName}\` allows: ${allowedList})`,
  ].join("\n");
}

function findCircularDependencies(manifest: ExtractedManifest): Violation[] {
  const edges = new Map(manifest.domains.map((d) => [d.name, d.actualDependencies]));
  const visited = new Set<string>();
  const stack = new Set<string>();
  const violations: Violation[] = [];

  function visit(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      violations.push({
        kind: "circular-dependency",
        domain: node,
        message: `[Hius] circular dependency: ${cycle.join(" → ")}`,
      });
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    for (const dependency of edges.get(node) ?? []) {
      if (edges.has(dependency)) {
        visit(dependency, [...path, node]);
      }
    }
    stack.delete(node);
  }

  for (const domain of manifest.domains) {
    visit(domain.name, []);
  }

  return violations;
}

// Contract semver diff: patch (compatible extension), minor (new
// operation), major (breaking — removal/narrowing of a field, or a type
// change). A field/operation being removed or narrowed is always major;
// widening (a new optional field, a required field turned optional) is
// always patch. "minor" only ever describes a whole new operation, never
// a field-level change within an existing one — narrower than that isn't
// meaningful at the field level.

export type ContractChangeSeverity = "patch" | "minor" | "major";

export type ContractChange = {
  contractName: string;
  severity: ContractChangeSeverity;
  message: string;
};

export type ContractDiffResult = {
  // null when before/after produced no changes at all.
  severity: ContractChangeSeverity | null;
  changes: ContractChange[];
};

const SEVERITY_RANK: Record<ContractChangeSeverity, number> = { patch: 0, minor: 1, major: 2 };

type FieldChange = { severity: ContractChangeSeverity; message: string };

type ObjectShape = { properties: Record<string, unknown>; required: Set<string> };

function objectShapeOf(schema: z.ZodType): ObjectShape | null {
  const jsonSchema = z.toJSONSchema(schema) as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (jsonSchema.type !== "object" || !jsonSchema.properties) return null;
  return { properties: jsonSchema.properties, required: new Set(jsonSchema.required ?? []) };
}

function diffSchema(before: z.ZodType, after: z.ZodType, label: string): FieldChange[] {
  const beforeShape = objectShapeOf(before);
  const afterShape = objectShapeOf(after);

  if (!beforeShape || !afterShape) {
    // Not both plain objects (e.g. a primitive or union payload) — fall
    // back to comparing the schemas as a whole.
    const changed =
      JSON.stringify(z.toJSONSchema(before)) !== JSON.stringify(z.toJSONSchema(after));
    return changed ? [{ severity: "major", message: `${label} shape changed` }] : [];
  }

  const changes: FieldChange[] = [];

  for (const field of Object.keys(afterShape.properties)) {
    if (!(field in beforeShape.properties)) {
      const required = afterShape.required.has(field);
      changes.push({
        severity: required ? "major" : "patch",
        message: required
          ? `${label} gained new required field \`${field}\` (breaking)`
          : `${label} gained new optional field \`${field}\``,
      });
      continue;
    }

    const wasRequired = beforeShape.required.has(field);
    const isRequired = afterShape.required.has(field);
    if (!wasRequired && isRequired) {
      changes.push({
        severity: "major",
        message: `${label} field \`${field}\` became required (narrowing)`,
      });
    } else if (wasRequired && !isRequired) {
      changes.push({
        severity: "patch",
        message: `${label} field \`${field}\` became optional (widening)`,
      });
    }

    if (
      JSON.stringify(beforeShape.properties[field]) !== JSON.stringify(afterShape.properties[field])
    ) {
      changes.push({ severity: "major", message: `${label} field \`${field}\` changed type` });
    }
  }

  for (const field of Object.keys(beforeShape.properties)) {
    if (!(field in afterShape.properties)) {
      changes.push({ severity: "major", message: `${label} removed field \`${field}\`` });
    }
  }

  return changes;
}

/**
 * Compares two versions of a domain's contract set, matched by contract
 * name, and classifies every change per §6.2's semver rules. This is what
 * `hius contract diff` and the CI merge gate are built on — it only reads
 * the Zod schemas' JSON Schema shape, never anything about how a contract
 * is implemented.
 */
export function diffContracts(before: Contract[], after: Contract[]): ContractDiffResult {
  const beforeByName = new Map(before.map((c) => [c.name, c]));
  const afterByName = new Map(after.map((c) => [c.name, c]));
  const changes: ContractChange[] = [];

  for (const contract of after) {
    if (!beforeByName.has(contract.name)) {
      changes.push({
        contractName: contract.name,
        severity: "minor",
        message: `[Hius] new operation \`${contract.name}\``,
      });
    }
  }

  for (const contract of before) {
    if (!afterByName.has(contract.name)) {
      changes.push({
        contractName: contract.name,
        severity: "major",
        message: `[Hius] operation \`${contract.name}\` removed`,
      });
    }
  }

  for (const afterContract of after) {
    const beforeContract = beforeByName.get(afterContract.name);
    if (!beforeContract) continue;

    for (const change of diffSchema(beforeContract.input, afterContract.input, "input")) {
      changes.push({ contractName: afterContract.name, ...change });
    }
    for (const change of diffSchema(beforeContract.output, afterContract.output, "output")) {
      changes.push({ contractName: afterContract.name, ...change });
    }
  }

  const severity = changes.reduce<ContractChangeSeverity | null>((max, change) => {
    if (max === null || SEVERITY_RANK[change.severity] > SEVERITY_RANK[max]) return change.severity;
    return max;
  }, null);

  return { severity, changes };
}
