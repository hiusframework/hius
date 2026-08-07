import { afterEach, describe, expect, test } from "bun:test";
import { hasDb } from "@hius/test-harness";
import { createLocalTarget, type LogLine, type Target } from "@/target";

let target: Target | undefined;

afterEach(async () => {
  await target?.dispose();
  target = undefined;
});

describe("createLocalTarget", () => {
  test("evalConsole evaluates plain JS against the app's context", async () => {
    target = createLocalTarget({ name: "test", dir: "does-not-exist" });
    const result = await target.evalConsole("1 + 1");
    expect(result.output).toBe("2");
    expect(result.isError).toBe(false);
  });

  test("evalConsole reports a thrown error without throwing itself", async () => {
    target = createLocalTarget({ name: "test", dir: "does-not-exist" });
    const result = await target.evalConsole("throw new Error('boom')");
    expect(result.isError).toBe(true);
    expect(result.output).toContain("boom");
  });

  test("isRunning is false before start and true after", () => {
    target = createLocalTarget({ name: "test" });
    expect(target.isRunning()).toBe(false);
    target.start(["sleep", "5"]);
    expect(target.isRunning()).toBe(true);
    target.stop();
  });

  test("start streams stdout to onLog subscribers", async () => {
    target = createLocalTarget({ name: "test" });
    const lines: LogLine[] = [];
    const unsubscribe = target.onLog((line) => lines.push(line));

    target.start(["bun", "-e", "console.log('hello from child')"]);

    await Bun.sleep(200);
    unsubscribe();

    expect(lines.some((l) => l.stream === "stdout" && l.text.includes("hello from child"))).toBe(
      true,
    );
  });

  test("run executes a one-shot command and captures its output", async () => {
    target = createLocalTarget({ name: "test" });
    const result = await target.run(["bun", "-e", "console.log('one-shot')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("one-shot");
  });

  test("onLog returns an unsubscribe function", async () => {
    target = createLocalTarget({ name: "test" });
    const lines: LogLine[] = [];
    const unsubscribe = target.onLog((line) => lines.push(line));
    unsubscribe();

    target.start(["bun", "-e", "console.log('should not be seen')"]);
    await Bun.sleep(200);

    expect(lines).toEqual([]);
  });

  test("stop on a target that isn't running emits an info line instead of throwing", () => {
    target = createLocalTarget({ name: "test" });
    const lines: LogLine[] = [];
    target.onLog((line) => lines.push(line));

    target.stop();

    expect(lines).toEqual([{ stream: "info", text: "not running", at: expect.any(Date) }]);
  });

  test("evalDb without a DATABASE_URL throws a clear error", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";
    try {
      target = createLocalTarget({ name: "test" });
      expect(target.evalDb("select 1")).rejects.toThrow("DATABASE_URL");
    } finally {
      if (previous) process.env.DATABASE_URL = previous;
    }
  });

  describe.if(hasDb)("evalDb with a real database", () => {
    test("runs a query against DATABASE_URL", async () => {
      target = createLocalTarget({ name: "test", databaseUrl: process.env.DATABASE_URL });
      const result = await target.evalDb("select 1 as n");
      expect(result.isError).toBe(false);
      expect(result.output).toContain("n");
    });
  });
});
