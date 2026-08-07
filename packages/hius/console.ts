import type { ExtractedManifest, ModuleConfig } from "@hius/spec";
import { SQL } from "bun";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { drizzle } from "drizzle-orm/bun-sql";
import { createEventBus, type EventBus } from "./events/bus";
import { extractManifest } from "./extraction";
import { loadAllModuleConfigs } from "./module-config";

// The REPL evaluation core — shared by @hius/cli's `hius console`/`hius
// db` (readline-loop-driven) and @hius/tui's embedded console/db panes
// (OpenTUI-input-driven). Lives here, not in either package, because
// both are equally legitimate consumers — putting it in one and making
// the other depend on it would be a one-directional dependency between
// two sibling packages for no architectural reason, and @hius/tui
// already depends on @hius/cli's generator/console layer for nothing
// else. Line-reading/REPL-loop mechanics (history, prompts, terminal
// I/O) stay in each consumer — this is only "evaluate one line, given a
// context".

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

export const defaultConsoleIo: ConsoleIO = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
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
 * Evaluates one line against the application's context. Direct eval()
 * inherits this function's local scope, which is exactly why
 * manifest/configs/events/db are destructured into local variables
 * rather than accessed as context.manifest etc — that's what makes them
 * available as bare identifiers to whatever the caller evaluates.
 */
export async function evalJs(input: string, context: ConsoleContext, io: ConsoleIO): Promise<void> {
  // biome-ignore lint/correctness/noUnusedVariables: referenced by eval() below — invisible to static analysis
  const { manifest, configs, events, db } = context;
  try {
    // biome-ignore lint/security/noGlobalEval: this eval IS the console — the entire point of the command
    let result = eval(input);
    if (result instanceof Promise) result = await result;
    io.log(result);
  } catch (err) {
    io.error(err);
  }
}

/**
 * Evaluates one line against the database — \tables and \describe
 * <table> as meta-commands, anything else runs as raw SQL.
 */
export async function evalSql(sql: SQL, input: string, io: ConsoleIO): Promise<void> {
  try {
    if (input === "\\tables") {
      const rows = (await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
      `) as Array<{ table_name: string }>;
      io.log(rows.map((r) => r.table_name).join(", "));
      return;
    }

    if (input.startsWith("\\describe ")) {
      const table = input.slice("\\describe ".length).trim();
      const rows = (await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position
      `) as Array<{ column_name: string; data_type: string; is_nullable: string }>;

      if (rows.length === 0) {
        io.error(`No such table: ${table}`);
        return;
      }
      for (const row of rows) {
        io.log(
          `${row.column_name}\t${row.data_type}${row.is_nullable === "YES" ? "" : "\tNOT NULL"}`,
        );
      }
      return;
    }

    io.log(await sql.unsafe(input));
  } catch (err) {
    io.error(err);
  }
}
