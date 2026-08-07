import { SQL } from "bun";
import { consola } from "consola";
import type { ConsoleIO } from "./js-console";
import { defaultConsoleIo } from "./js-console";
import { type ReadlineLoopOptions, runReadlineLoop } from "./readline-loop";

/**
 * Evaluates one line against the database — \tables and \describe
 * <table> as meta-commands, anything else runs as raw SQL. Reusable core
 * both `startSqlConsole`'s readline loop and `@hius/tui`'s embedded
 * console pane call, one line at a time.
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

/**
 * A SQL console. Separate from the JS console (js-console.ts) — a SQL
 * prompt shouldn't also try to be a JS REPL. Line input (history,
 * Home/End, \-continuation for a long query) is handled by
 * readline-loop.ts, shared with the JS console.
 */
export async function startSqlConsole(
  databaseUrl: string,
  options: ReadlineLoopOptions & { io?: ConsoleIO } = {},
): Promise<void> {
  const { io = defaultConsoleIo, ...loopOptions } = options;
  const sql = new SQL(databaseUrl);
  consola.info("Hius SQL console — \\tables, \\describe <table>, or raw SQL. Ctrl+D to exit.");

  try {
    await runReadlineLoop((input) => evalSql(sql, input, io), loopOptions);
  } finally {
    await sql.close();
  }
}
