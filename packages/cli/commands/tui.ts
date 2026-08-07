import { existsSync, readFileSync } from "node:fs";
import { defineCommand } from "citty";

// Bare-minimum KEY=VALUE parser — not full dotenv-spec compliance
// (quoting, multiline values, variable expansion), just enough to pull
// DATABASE_URL out of a candidate env file. Deliberately not the
// `dotenv` package: Bun already loads `.env` into `process.env` once at
// process startup for the running process's own environment, but `hius
// tui` needs *multiple* environments' values live in one process at
// once (D16's dev/test tabs) — reading a second file's values into
// process.env would leak them into whichever environment reads
// `process.env` next, defeating the whole point of keeping them
// separate.
function readDatabaseUrl(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key?.trim() === "DATABASE_URL") {
      return rest
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

export const tuiCommand = defineCommand({
  meta: {
    name: "tui",
    description:
      "Multi-environment TUI dashboard — console, db, logs, and commands per environment (D16, v1: dev/test only)",
  },
  args: {
    dir: {
      type: "string",
      description: "Path to the domains/ directory",
      default: "domains",
    },
  },
  async run({ args }) {
    // Dynamically imported — @opentui/core is @hius/tui's dependency,
    // not @hius/cli's, so a project that never runs `hius tui` never
    // pulls it in (D16: packages/tui is optional).
    const { runTui } = await import("@hius/tui");

    await runTui({
      environments: {
        dev: { dir: args.dir, databaseUrl: readDatabaseUrl(".env") ?? process.env.DATABASE_URL },
        test: { dir: args.dir, databaseUrl: readDatabaseUrl(".env.test") },
      },
    });
  },
});
