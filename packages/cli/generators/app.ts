import { join } from "node:path";
import { toKebabCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

function moduleConfigTemplate(name: string): string {
  return `export default {
  name: "${name}",
  publicApi: [],
  allowedDependencies: [],
};
`;
}

function citadelReadme(name: string): string {
  return `# ${name}/citadel

Framework-agnostic business logic for the "${name}" domain — no imports
from \`hius\` or any other framework package. Use cases go in
\`use-cases/\`, one file per operation.
`;
}

function fortressReadme(name: string): string {
  return `# ${name}/fortress

Framework-aware code for the "${name}" domain — HTTP controllers,
adapters, anything that knows about \`hius\`. Calls into \`../citadel\`
for the actual business logic.
`;
}

/**
 * Scaffolds a new domain: module.config.ts (required — a domain without
 * one is a boundary violation, not just an incomplete scaffold) plus
 * citadel/ and fortress/ placeholders explaining what belongs in each.
 */
export async function generateApp(
  appsDir: string,
  name: string,
  force = false,
): Promise<WriteResult[]> {
  const domain = toKebabCase(name);
  const dir = join(appsDir, domain);

  return Promise.all([
    writeGeneratedFile(join(dir, "module.config.ts"), moduleConfigTemplate(domain), force),
    writeGeneratedFile(join(dir, "citadel", "README.md"), citadelReadme(domain), force),
    writeGeneratedFile(join(dir, "fortress", "README.md"), fortressReadme(domain), force),
  ]);
}
