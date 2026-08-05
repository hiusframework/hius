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

test("requires DATABASE_URL to be set", async () => {
  delete process.env.DATABASE_URL;
  expect(runCommand(dbCommand, { rawArgs: [] })).rejects.toThrow(
    "hius db requires DATABASE_URL to be set",
  );
});
