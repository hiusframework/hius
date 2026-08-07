import { resolve } from "node:path";
import type { ExtractedDomain, ExtractedManifest } from "@hius/spec";
import { Project } from "ts-morph";
import type { DiscoveredDomain } from "./discovery";
import { discoverDomains } from "./discovery";

/**
 * Every file belonging to a domain, deduped and flattened across the
 * discovery categories — shared between {@link extractManifest} and
 * `whereDoesEventGo` (event-tracing.ts), which both need to walk the same
 * file set for a different purpose (import graph vs. `.on(...)` calls).
 */
export function domainFiles(domain: DiscoveredDomain): string[] {
  // contracts is a subset of citadel (citadel/contracts/**) — dedupe
  // through a Set so those files aren't scanned twice.
  return [
    ...new Set([
      ...domain.files.routes,
      ...domain.files.events,
      ...domain.files.jobs,
      ...domain.files.models,
      ...domain.files.citadel,
      ...domain.files.fortress,
      ...domain.files.contracts,
    ]),
  ];
}

// ts-morph normalizes every path it hands back to an absolute,
// forward-slash form regardless of platform — comparing it against a
// node:path-joined string (which uses the OS separator) would silently
// break on Windows. Do the prefix check as plain strings instead.
function domainOfPath(absPath: string, appsDir: string, domainNames: Set<string>): string | null {
  const prefix = appsDir.endsWith("/") ? appsDir : `${appsDir}/`;
  if (!absPath.startsWith(prefix)) return null;
  const first = absPath.slice(prefix.length).split("/")[0];
  return first && domainNames.has(first) ? first : null;
}

/**
 * Extracts the manifest fact from the actual file tree: for each domain
 * discovered by file-system convention, which other domains it actually
 * imports from, and what it exports. This is the static-analysis half of
 * the intent/fact model — `@hius/core`'s validator compares this against
 * the hand-written module.config.
 */
export async function extractManifest(appsDir: string): Promise<ExtractedManifest> {
  const absAppsDir = resolve(appsDir);
  const discovered = await discoverDomains(absAppsDir);
  const domainNames = new Set(discovered.map((d) => d.name));

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  if (discovered.length > 0) {
    project.addSourceFilesAtPaths(`${absAppsDir}/**/*.ts`);
  }

  const domains: ExtractedDomain[] = discovered.map((domain) => {
    const dependencies = new Set<string>();
    const exportNames = new Set<string>();

    for (const relFile of domainFiles(domain)) {
      const sourceFile = project.getSourceFile(`${absAppsDir}/${domain.name}/${relFile}`);
      if (!sourceFile) continue;

      for (const importDecl of sourceFile.getImportDeclarations()) {
        const target = importDecl.getModuleSpecifierSourceFile();
        if (!target) continue; // external package import — not a domain dependency

        const targetDomain = domainOfPath(target.getFilePath(), absAppsDir, domainNames);
        if (targetDomain && targetDomain !== domain.name) {
          dependencies.add(targetDomain);
        }
      }

      for (const name of sourceFile.getExportedDeclarations().keys()) {
        exportNames.add(name);
      }
    }

    return {
      name: domain.name,
      files: domain.files,
      actualDependencies: [...dependencies].sort(),
      exports: [...exportNames].sort(),
    };
  });

  return { domains, extractedAt: new Date().toISOString() };
}
