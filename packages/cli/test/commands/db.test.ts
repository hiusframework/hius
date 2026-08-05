import { afterEach, beforeEach, expect, test } from "bun:test";
import { runCommand } from "citty";
import { dbCommand } from "@/commands/db";

let previousDatabaseUrl: string | undefined;

beforeEach(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
});

afterEach(() => {
  process.env.DATABASE_URL = previousDatabaseUrl;
});

test("bare `hius db` (no subcommand) defaults to the SQL console", async () => {
  delete process.env.DATABASE_URL;
  expect(runCommand(dbCommand, { rawArgs: [] })).rejects.toThrow(
    "hius db requires DATABASE_URL to be set",
  );
});

test("the db command has no `run` of its own — subcommand dispatch is exclusive, not additive", () => {
  // citty runs a command's own `run` *in addition to* whichever subcommand
  // it dispatches to, not instead of it — if `dbCommand` ever grew a `run`
  // again, `hius db migrate` would also open the SQL console afterwards.
  // `default: "console"` is what makes bare `hius db` open the console
  // instead, without that hazard.
  expect(dbCommand.run).toBeUndefined();
  expect(dbCommand.default).toBe("console");
});
