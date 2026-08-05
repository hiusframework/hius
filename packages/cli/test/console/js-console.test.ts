import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { buildConsoleContext, startJsConsole } from "@/console/js-console";

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

const emptyContext = {
  manifest: { domains: [], extractedAt: "" },
  configs: [],
  events: undefined as never,
};

describe("startJsConsole", () => {
  test("evaluates plain expressions and logs the result", async () => {
    const { io, logs } = captureIo();
    await startJsConsole(emptyContext, { input: inputFrom(["1 + 1"]), output: nullOutput(), io });
    expect(logs).toEqual([2]);
  });

  test("a throwing expression logs to error, doesn't stop the loop", async () => {
    const { io, logs, errors } = captureIo();
    await startJsConsole(emptyContext, {
      input: inputFrom(["throw new Error('boom')", "2 + 2"]),
      output: nullOutput(),
      io,
    });
    expect(errors).toHaveLength(1);
    expect(logs).toEqual([4]);
  });

  test("awaits a Promise result before logging it", async () => {
    const { io, logs } = captureIo();
    await startJsConsole(emptyContext, {
      input: inputFrom(["Promise.resolve(42)"]),
      output: nullOutput(),
      io,
    });
    expect(logs).toEqual([42]);
  });

  test("manifest, configs, and events are in scope as bare identifiers", async () => {
    const { io, logs } = captureIo();
    const manifest = { domains: [{ name: "billing" }], extractedAt: "now" } as never;
    await startJsConsole(
      { manifest, configs: [{ name: "billing" }] as never, events: { on: () => {} } as never },
      {
        input: inputFrom(["manifest.domains.length", "configs[0].name", "typeof events.on"]),
        output: nullOutput(),
        io,
      },
    );
    expect(logs).toEqual([1, "billing", "function"]);
  });

  test("a custom prompt is used when given", async () => {
    const chunks: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    await startJsConsole(emptyContext, {
      input: inputFrom(["1"]),
      output,
      prompt: (n) => `billing:${n} > `,
    });

    expect(chunks.join("")).toContain("billing:1 > ");
  });
});

describe("buildConsoleContext", () => {
  let appsDir: string;
  let previousDatabaseUrl: string | undefined;

  beforeEach(async () => {
    appsDir = await mkdtemp(join(tmpdir(), "hius-cli-console-"));
    previousDatabaseUrl = process.env.DATABASE_URL;
  });

  afterEach(async () => {
    await rm(appsDir, { recursive: true, force: true });
    process.env.DATABASE_URL = previousDatabaseUrl;
  });

  async function writeFileIn(
    domain: string,
    relativePath: string,
    contents: string,
  ): Promise<void> {
    const fullPath = join(appsDir, domain, relativePath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, contents);
  }

  test("builds a context with the full manifest when no app is given", async () => {
    await writeFileIn("billing", "routes.ts", "export const routes = [];\n");
    await writeFileIn("users", "routes.ts", "export const routes = [];\n");

    const context = await buildConsoleContext(appsDir);

    expect(context.manifest.domains.map((d) => d.name).sort()).toEqual(["billing", "users"]);
    expect(typeof context.events.on).toBe("function");
  });

  test("--app scopes the manifest to a single domain", async () => {
    await writeFileIn("billing", "routes.ts", "export const routes = [];\n");
    await writeFileIn("users", "routes.ts", "export const routes = [];\n");

    const context = await buildConsoleContext(appsDir, "billing");

    expect(context.manifest.domains.map((d) => d.name)).toEqual(["billing"]);
  });

  test("db is undefined without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const context = await buildConsoleContext(appsDir);
    expect(context.db).toBeUndefined();
  });

  test("db is present when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/hius_test";
    const context = await buildConsoleContext(appsDir);
    expect(context.db).toBeDefined();
  });
});
