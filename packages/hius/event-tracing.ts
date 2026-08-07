import { resolve } from "node:path";
import { Node, Project } from "ts-morph";
import { discoverDomains } from "./discovery";
import { domainFiles } from "./extraction";

export type EventSubscriber = {
  domain: string;
  file: string;
  handler: string;
};

function findSubscribers(
  sourceFile: ReturnType<Project["getSourceFile"]>,
  eventName: string,
  domain: string,
  relFile: string,
): EventSubscriber[] {
  if (!sourceFile) return [];
  const subscribers: EventSubscriber[] = [];

  // Matches `<anything>.on("event.name", handler)` — deliberately not
  // anchored to a variable literally named `bus` (an import alias could
  // rename it) or to a specific EventBus type (that would need full type
  // checking, not just AST walking). The convention itself — subscribing
  // via `.on(stringLiteral, handler)` — is what's traced; false positives
  // from an unrelated `.on(...)` call would need the exact same shape to
  // occur, which nothing else in a Hius domain does today.
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== "on") return;

    const [nameArg, handlerArg] = node.getArguments();
    if (!nameArg || !handlerArg || !Node.isStringLiteral(nameArg)) return;
    if (nameArg.getLiteralValue() !== eventName) return;

    subscribers.push({ domain, file: relFile, handler: handlerArg.getText() });
  });

  return subscribers;
}

/**
 * Traces which handlers subscribe to a given event name, across every
 * domain's files — the MCP counterpart to reading `events.ts` by hand to
 * answer "who receives this when it's published?" Static AST matching on
 * the `.on("event.name", handler)` shape (see {@link findSubscribers}),
 * not a runtime trace — an event that's never published still shows its
 * subscribers, and a typo'd event name correctly shows none.
 */
export async function whereDoesEventGo(
  appsDir: string,
  eventName: string,
): Promise<EventSubscriber[]> {
  const absAppsDir = resolve(appsDir);
  const discovered = await discoverDomains(absAppsDir);

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  if (discovered.length > 0) {
    project.addSourceFilesAtPaths(`${absAppsDir}/**/*.ts`);
  }

  const subscribers: EventSubscriber[] = [];
  for (const domain of discovered) {
    for (const relFile of domainFiles(domain)) {
      const sourceFile = project.getSourceFile(`${absAppsDir}/${domain.name}/${relFile}`);
      subscribers.push(...findSubscribers(sourceFile, eventName, domain.name, relFile));
    }
  }

  return subscribers;
}
