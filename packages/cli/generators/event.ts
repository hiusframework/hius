import { join } from "node:path";
import { type Acronyms, toCamelCase, toKebabCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

function handlerTemplate(handlerName: string, eventName: string): string {
  return `// Handles "${eventName}". Delivery is at-least-once (the outbox
// relay retries a row until every handler for it succeeds) — this
// handler must be idempotent: running it twice on the same payload
// must be safe.
export async function ${handlerName}(payload: unknown): Promise<void> {
  throw new Error("${handlerName} is not implemented yet");
}
`;
}

export type GeneratedEvent = {
  results: WriteResult[];
  handlerName: string;
  wiringSnippet: string;
};

/**
 * Generates a standalone handler under citadel/handlers/ rather than
 * editing events.ts directly — same reasoning as generateEndpoint: text-
 * patching an existing file the developer already owns risks corrupting
 * it the moment its assumptions don't hold. Prints the bus.on(...) line
 * needed to wire it in instead.
 */
export async function generateEvent(
  appsDir: string,
  domain: string,
  eventName: string,
  force = false,
  acronyms?: Acronyms,
): Promise<GeneratedEvent> {
  const domainDir = join(appsDir, toKebabCase(domain));
  const handlerName = toCamelCase(`on-${eventName}`, acronyms);
  const handlerFile = toKebabCase(handlerName);
  const handlerPath = join(domainDir, "citadel", "handlers", `${handlerFile}.ts`);

  const results = [
    await writeGeneratedFile(handlerPath, handlerTemplate(handlerName, eventName), force),
  ];

  const wiringSnippet = `bus.on("${eventName}", ${handlerName});`;

  return { results, handlerName, wiringSnippet };
}
