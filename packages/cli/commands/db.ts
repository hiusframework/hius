import { defineCommand } from "citty";
import { startSqlConsole } from "../console/sql-console";
import { runDrizzleKit } from "../db/drizzle-kit";

// A separate command from `hius console`, not a --db flag on it — a SQL
// prompt and a JS REPL are different enough tools that they shouldn't
// share one entrypoint.
//
// `hius db` bare (no subcommand) still opens the SQL console — that has
// to go through `default: "console"` below rather than a `run` on this
// top-level command directly: citty runs a command's own `run` *in
// addition to* whichever subcommand it dispatches to, not instead of it,
// so a `run` here would open the console on every `hius db migrate` too.
const consoleSubCommand = defineCommand({
  meta: { name: "console", description: "SQL console for the application database" },
  async run() {
    if (!process.env.DATABASE_URL) {
      throw new Error("hius db requires DATABASE_URL to be set");
    }
    await startSqlConsole(process.env.DATABASE_URL, { prompt: (n) => `db:${n} > ` });
  },
});

// generate/migrate/studio forward every raw arg to drizzle-kit verbatim,
// rather than declaring citty args for them — drizzle-kit has its own
// flags (--name, --config, ...) that this shouldn't have to keep in
// sync with; the point of these subcommands is discoverability under
// `hius db`, not a reimplementation of drizzle-kit's CLI surface.
const generateSubCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate a migration from schema changes (drizzle-kit generate)",
  },
  async run({ rawArgs }) {
    await runDrizzleKit(["generate", ...rawArgs]);
  },
});

const migrateSubCommand = defineCommand({
  meta: { name: "migrate", description: "Apply pending migrations (drizzle-kit migrate)" },
  async run({ rawArgs }) {
    await runDrizzleKit(["migrate", ...rawArgs]);
  },
});

const studioSubCommand = defineCommand({
  meta: { name: "studio", description: "Open Drizzle Studio (drizzle-kit studio)" },
  async run({ rawArgs }) {
    await runDrizzleKit(["studio", ...rawArgs]);
  },
});

export const dbCommand = defineCommand({
  meta: {
    name: "db",
    description: "SQL console and Drizzle migration workflow for the application database",
  },
  subCommands: {
    console: consoleSubCommand,
    generate: generateSubCommand,
    migrate: migrateSubCommand,
    studio: studioSubCommand,
  },
  default: "console",
});
