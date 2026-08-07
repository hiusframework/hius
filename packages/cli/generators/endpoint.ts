import { join } from "node:path";
import { type Acronyms, toCamelCase, toKebabCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function handlerTemplate(handlerName: string, method: HttpMethod, path: string): string {
  return `import type { HiusRequest } from "hius";

// ${method} ${path}
export async function ${handlerName}(req: HiusRequest): Promise<Response> {
  throw new Error("${handlerName} is not implemented yet");
}
`;
}

export type GeneratedEndpoint = {
  results: WriteResult[];
  handlerName: string;
  wiringSnippet: string;
};

/**
 * Generates a standalone handler rather than editing routes.ts directly —
 * text-patching someone's existing route table is exactly the kind of
 * "clever" file mutation that corrupts real code the moment its
 * assumptions don't hold. Prints the one line needed to wire it in
 * instead; the developer's routes.ts stays something they wrote.
 */
export async function generateEndpoint(
  appsDir: string,
  domain: string,
  method: HttpMethod,
  path: string,
  force = false,
  acronyms?: Acronyms,
): Promise<GeneratedEndpoint> {
  const domainDir = join(appsDir, toKebabCase(domain));
  const handlerName = toCamelCase(
    `${method.toLowerCase()}-${path.replace(/[/:]/g, "-")}` || "handler",
    acronyms,
  );
  const handlerFile = toKebabCase(handlerName);
  const handlerPath = join(domainDir, "fortress", "http", `${handlerFile}.ts`);

  const results = [
    await writeGeneratedFile(handlerPath, handlerTemplate(handlerName, method, path), force),
  ];

  const methodCall = method.toLowerCase() as Lowercase<HttpMethod>;
  const wiringSnippet = `r.${methodCall}("${path}", ${handlerName});`;

  return { results, handlerName, wiringSnippet };
}
