import { defineCommand } from "citty";
import { startSqlConsole } from "../console/sql-console";

// A separate command from `hius console`, not a --db flag on it — a SQL
// prompt and a JS REPL are different enough tools that they shouldn't
// share one entrypoint. Room to grow into `hius db migrate`/`hius db
// generate` etc. (the Drizzle migration workflow) later without
// disturbing this command's meaning.
export const dbCommand = defineCommand({
  meta: {
    name: "db",
    description: "SQL console for the application database",
  },
  async run() {
    if (!process.env.DATABASE_URL) {
      throw new Error("hius db requires DATABASE_URL to be set");
    }
    await startSqlConsole(process.env.DATABASE_URL, { prompt: (n) => `db:${n} > ` });
  },
});
