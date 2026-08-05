import { SQL } from "bun";
import { consola } from "consola";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { drizzle } from "drizzle-orm/bun-sql";
import type { EventBus, ExtractedManifest, ModuleConfig } from "hius";
import { createEventBus, extractManifest, loadAllModuleConfigs } from "hius";

export type ConsoleContext = {
  manifest: ExtractedManifest;
  configs: ModuleConfig[];
  events: EventBus;
  // biome-ignore lint/suspicious/noExplicitAny: schema-agnostic, matches DrizzleAdapter's own typing
  db?: BunSQLDatabase<any>;
};

export type ConsoleIO = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export async function buildConsoleContext(dir: string, appName?: string): Promise<ConsoleContext> {
  const fullManifest = await extractManifest(dir);
  const manifest = appName
    ? { ...fullManifest, domains: fullManifest.domains.filter((d) => d.name === appName) }
    : fullManifest;
  const configs = await loadAllModuleConfigs(
    dir,
    manifest.domains.map((d) => d.name),
  );
  const events = createEventBus();

  const db = process.env.DATABASE_URL
    ? drizzle({ client: new SQL(process.env.DATABASE_URL) })
    : undefined;

  return { manifest, configs, events, db };
}

/**
 * A plain JS REPL preloaded with the application's context. Direct eval()
 * inherits this function's local scope, which is exactly why manifest/
 * configs/events/db are destructured into local variables rather than
 * accessed as context.manifest etc — that's what makes them available as
 * bare identifiers to whatever the user types.
 */
export async function startJsConsole(
  context: ConsoleContext,
  lines: AsyncIterable<string> = console as unknown as AsyncIterable<string>,
  io: ConsoleIO = console,
): Promise<void> {
  // biome-ignore lint/correctness/noUnusedVariables: referenced by eval() below — invisible to static analysis
  const { manifest, configs, events, db } = context;

  consola.info(
    `Hius console — manifest, configs, events${db ? ", db" : ""} available. Ctrl+D to exit.`,
  );

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      // biome-ignore lint/security/noGlobalEval: this eval IS the console — the entire point of the command
      let result = eval(trimmed);
      if (result instanceof Promise) result = await result;
      io.log(result);
    } catch (err) {
      io.error(err);
    }
  }
}
