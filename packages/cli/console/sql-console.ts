import { SQL } from "bun";
import { consola } from "consola";
import type { ConsoleIO } from "./js-console";

/**
 * A SQL console: \tables and \describe <table> as meta-commands, anything
 * else runs as raw SQL. Separate from the JS console (js-console.ts) — a
 * SQL prompt shouldn't also try to be a JS REPL.
 */
export async function startSqlConsole(
  databaseUrl: string,
  lines: AsyncIterable<string> = console as unknown as AsyncIterable<string>,
  io: ConsoleIO = console,
): Promise<void> {
  const sql = new SQL(databaseUrl);
  consola.info("Hius SQL console — \\tables, \\describe <table>, or raw SQL. Ctrl+D to exit.");

  try {
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        if (trimmed === "\\tables") {
          const rows = (await sql`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name
          `) as Array<{ table_name: string }>;
          io.log(rows.map((r) => r.table_name).join(", "));
          continue;
        }

        if (trimmed.startsWith("\\describe ")) {
          const table = trimmed.slice("\\describe ".length).trim();
          const rows = (await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${table}
            ORDER BY ordinal_position
          `) as Array<{ column_name: string; data_type: string; is_nullable: string }>;

          if (rows.length === 0) {
            io.error(`No such table: ${table}`);
            continue;
          }
          for (const row of rows) {
            io.log(
              `${row.column_name}\t${row.data_type}${row.is_nullable === "YES" ? "" : "\tNOT NULL"}`,
            );
          }
          continue;
        }

        io.log(await sql.unsafe(trimmed));
      } catch (err) {
        io.error(err);
      }
    }
  } finally {
    await sql.close();
  }
}
