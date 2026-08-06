import { join } from "node:path";
import { toCamelCase, toKebabCase, toPascalCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

function useCaseTemplate(name: string): string {
  const factory = `create${toPascalCase(name)}`;
  return `// Explicit composition — dependencies are passed in, not resolved
// through a container. Replace the empty deps/args below with what this
// use case actually needs.
export const ${factory} = (/* deps */) =>
  async (/* args */) => {
    throw new Error("${factory} is not implemented yet");
  };
`;
}

function useCaseTestTemplate(name: string, domain: string): string {
  const factory = `create${toPascalCase(name)}`;
  const file = toKebabCase(name);
  return `import { describe, expect, test } from "bun:test";
import { ${factory} } from "../${file}";

describe("${factory}", () => {
  test("TODO: replace with a real expectation for ${domain}/${file}", async () => {
    const ${toCamelCase(name)} = ${factory}();
    expect(${toCamelCase(name)}).toBeDefined();
  });
});
`;
}

/**
 * Generates a use case skeleton under citadel/use-cases/ — framework-
 * agnostic by convention (see generateDomain's citadel README), so this
 * template has no import from hius in it.
 */
export async function generateUseCase(
  appsDir: string,
  domain: string,
  name: string,
  force = false,
): Promise<WriteResult[]> {
  const domainDir = join(appsDir, toKebabCase(domain));
  const file = toKebabCase(name);
  const useCasesDir = join(domainDir, "citadel", "use-cases");

  return Promise.all([
    writeGeneratedFile(join(useCasesDir, `${file}.ts`), useCaseTemplate(name), force),
    writeGeneratedFile(
      join(useCasesDir, "test", `${file}.test.ts`),
      useCaseTestTemplate(name, domain),
      force,
    ),
  ]);
}
