import type { ExtractedManifest, ModuleConfig } from "@hius/spec";

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
