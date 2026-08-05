import { join } from "node:path";
import type { DomainFiles } from "@hius/spec";

export type DiscoveredDomain = {
  name: string;
  files: DomainFiles;
  hasManifest: boolean;
};

const FILE_CONVENTIONS: Record<keyof DomainFiles, string> = {
  routes: "routes.ts",
  events: "events.ts",
  jobs: "jobs.ts",
  models: "models/**/*.ts",
  citadel: "citadel/**/*.ts",
  fortress: "fortress/**/*.ts",
  // Subset of citadel/, scanned separately so contract files are
  // discoverable on their own without re-deriving them from citadel.
  contracts: "citadel/contracts/**/*.ts",
};

async function globFiles(cwd: string, pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const matches: string[] = [];
  try {
    for await (const match of glob.scan({ cwd })) {
      matches.push(match);
    }
  } catch {
    return [];
  }
  return matches.sort();
}

async function listSubdirectories(dir: string): Promise<string[]> {
  const glob = new Bun.Glob("*/");
  const names: string[] = [];
  try {
    for await (const match of glob.scan({ cwd: dir, onlyFiles: false })) {
      names.push(match.replace(/\/$/, ""));
    }
  } catch {
    return [];
  }
  return names;
}

/**
 * Scans a single domain directory for the file/directory conventions:
 * `routes.ts`, `events.ts`, `jobs.ts`, `models/`, `citadel/`, `fortress/`,
 * plus the optional `index.ts` registration manifest. Pure file-system
 * convention matching — no import-graph analysis (that's a separate,
 * ts-morph-based extraction step).
 */
export async function discoverDomain(domainDir: string, name: string): Promise<DiscoveredDomain> {
  const [routes, events, jobs, models, citadel, fortress, contracts, manifestFiles] =
    await Promise.all([
      globFiles(domainDir, FILE_CONVENTIONS.routes),
      globFiles(domainDir, FILE_CONVENTIONS.events),
      globFiles(domainDir, FILE_CONVENTIONS.jobs),
      globFiles(domainDir, FILE_CONVENTIONS.models),
      globFiles(domainDir, FILE_CONVENTIONS.citadel),
      globFiles(domainDir, FILE_CONVENTIONS.fortress),
      globFiles(domainDir, FILE_CONVENTIONS.contracts),
      globFiles(domainDir, "index.ts"),
    ]);

  return {
    name,
    files: { routes, events, jobs, models, citadel, fortress, contracts },
    hasManifest: manifestFiles.length > 0,
  };
}

/**
 * Scans `<appsDir>/*` for domain directories and applies
 * {@link discoverDomain} to each. A missing `appsDir` is not an error —
 * a brand-new project has no domains yet.
 */
export async function discoverDomains(appsDir: string): Promise<DiscoveredDomain[]> {
  const domainNames = await listSubdirectories(appsDir);
  const domains = await Promise.all(
    domainNames.map((name) => discoverDomain(join(appsDir, name), name)),
  );

  return domains.sort((a, b) => a.name.localeCompare(b.name));
}
