import { describe, expect, test } from "bun:test";
import { Readable, Writable } from "node:stream";
import { SQL } from "bun";
import { startSqlConsole } from "@/console/sql-console";

const hasDb = !!process.env.DATABASE_URL;

function inputFrom(lines: string[]): Readable {
  return Readable.from(lines.map((l) => `${l}\n`).join(""));
}

function nullOutput(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function captureIo() {
  const logs: unknown[] = [];
  const errors: unknown[] = [];
  return {
    io: {
      log: (...args: unknown[]) => logs.push(args.length === 1 ? args[0] : args),
      error: (...args: unknown[]) => errors.push(args.length === 1 ? args[0] : args),
    },
    logs,
    errors,
  };
}

describe.if(hasDb)("startSqlConsole (integration)", () => {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  test("\\tables lists a known table", async () => {
    const sql = new SQL(databaseUrl);
    await sql`CREATE TABLE IF NOT EXISTS hius_cli_console_fixture (id UUID PRIMARY KEY)`;
    await sql.close();

    const { io, logs } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["\\tables"]),
      output: nullOutput(),
      io,
    });

    expect(String(logs[0])).toContain("hius_cli_console_fixture");
  });

  test("\\describe lists columns for an existing table", async () => {
    const sql = new SQL(databaseUrl);
    await sql`
      CREATE TABLE IF NOT EXISTS hius_cli_console_describe_fixture (
        id UUID PRIMARY KEY,
        name TEXT
      )
    `;
    await sql.close();

    const { io, logs } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["\\describe hius_cli_console_describe_fixture"]),
      output: nullOutput(),
      io,
    });

    expect(logs.some((l) => String(l).includes("id") && String(l).includes("NOT NULL"))).toBe(true);
    expect(logs.some((l) => String(l).startsWith("name"))).toBe(true);
  });

  test("\\describe on an unknown table reports an error, doesn't throw", async () => {
    const { io, errors } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["\\describe does_not_exist"]),
      output: nullOutput(),
      io,
    });

    expect(errors).toEqual(["No such table: does_not_exist"]);
  });

  test("raw SQL passes through and returns rows", async () => {
    const { io, logs } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["SELECT 1 as x"]),
      output: nullOutput(),
      io,
    });

    expect(logs).toHaveLength(1);
    expect(Array.from(logs[0] as ArrayLike<{ x: number }>)[0]?.x).toBe(1);
  });

  test("invalid SQL logs an error without stopping the loop", async () => {
    const { io, logs, errors } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["not valid sql", "SELECT 2 as x"]),
      output: nullOutput(),
      io,
    });

    expect(errors).toHaveLength(1);
    expect(Array.from(logs[0] as ArrayLike<{ x: number }>)[0]?.x).toBe(2);
  });

  test("a multi-line query via \\-continuation runs as one statement", async () => {
    const { io, logs } = captureIo();
    await startSqlConsole(databaseUrl, {
      input: inputFrom(["SELECT 1 as x,\\", "2 as y"]),
      output: nullOutput(),
      io,
    });

    expect(logs).toHaveLength(1);
    const row = Array.from(logs[0] as ArrayLike<{ x: number; y: number }>)[0];
    expect(row).toMatchObject({ x: 1, y: 2 });
  });
});
