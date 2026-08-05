import { defineCommand } from "citty";
import { buildConsoleContext, startJsConsole } from "../console/js-console";
import { startSqlConsole } from "../console/sql-console";

export const consoleCommand = defineCommand({
  meta: {
    name: "console",
    description: "REPL with full application context",
  },
  args: {
    dir: {
      type: "string",
      description: "Path to the apps/ directory",
      default: "apps",
    },
    app: {
      type: "string",
      description: "Scope the context to a single domain",
    },
    db: {
      type: "boolean",
      description: "SQL console instead of the JS REPL",
    },
  },
  async run({ args }) {
    if (args.db) {
      if (!process.env.DATABASE_URL) {
        throw new Error("hius console --db requires DATABASE_URL to be set");
      }
      await startSqlConsole(process.env.DATABASE_URL);
      return;
    }

    const context = await buildConsoleContext(args.dir, args.app);
    await startJsConsole(context);
  },
});
