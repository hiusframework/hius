import { SQL } from "bun";
import { consola } from "consola";
import type { ConsoleIO } from "hius/console";
import { defaultConsoleIo, evalSql } from "hius/console";
import { type ReadlineLoopOptions, runReadlineLoop } from "./readline-loop";

export { evalSql } from "hius/console";

/**
 * A SQL console. Separate from the JS console (js-console.ts) — a SQL
 * prompt shouldn't also try to be a JS REPL. Line input (history,
 * Home/End, \-continuation for a long query) is handled by
 * readline-loop.ts, shared with the JS console. evalSql (hius/console)
 * is the reusable per-line evaluation core this loops over.
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
