import { describe, expect, test } from "bun:test";
import { Readable, Writable } from "node:stream";
import { runReadlineLoop } from "@/console/readline-loop";

function inputFrom(lines: string[]): Readable {
  return Readable.from(lines.map((l) => `${l}\n`).join(""));
}

function captureOutput(): { output: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { output, chunks };
}

describe("runReadlineLoop", () => {
  test("calls the handler once per non-blank line", async () => {
    const seen: string[] = [];
    const { output } = captureOutput();

    await runReadlineLoop(
      (input) => {
        seen.push(input);
      },
      { input: inputFrom(["one", "two"]), output },
    );

    expect(seen).toEqual(["one", "two"]);
  });

  test("blank lines are skipped, not handed to the handler", async () => {
    const seen: string[] = [];
    const { output } = captureOutput();

    await runReadlineLoop(
      (input) => {
        seen.push(input);
      },
      { input: inputFrom(["one", "", "  ", "two"]), output },
    );

    expect(seen).toEqual(["one", "two"]);
  });

  test("a trailing backslash continues the input onto the next line", async () => {
    const seen: string[] = [];
    const { output } = captureOutput();

    await runReadlineLoop(
      (input) => {
        seen.push(input);
      },
      { input: inputFrom(["SELECT *\\", "FROM users"]), output },
    );

    expect(seen).toEqual(["SELECT *\nFROM users"]);
  });

  test("multiple continuations chain together", async () => {
    const seen: string[] = [];
    const { output } = captureOutput();

    await runReadlineLoop(
      (input) => {
        seen.push(input);
      },
      { input: inputFrom(["a\\", "b\\", "c"]), output },
    );

    expect(seen).toEqual(["a\nb\nc"]);
  });

  test("prompt numbering advances only on handled (non-blank) lines", async () => {
    const { output, chunks } = captureOutput();

    await runReadlineLoop(() => {}, {
      input: inputFrom(["a", "", "b"]),
      output,
      prompt: (n) => `p${n}> `,
    });

    // initial prompt p1>, blank line re-shows p2> (unchanged number),
    // then p3> once "b" is handled
    expect(chunks.join("")).toContain("p1> ");
    expect(chunks.join("")).toContain("p2> ");
    expect(chunks.join("")).toContain("p3> ");
  });

  test("uses the default numbered prompt when none is given", async () => {
    const { output, chunks } = captureOutput();

    await runReadlineLoop(() => {}, { input: inputFrom(["a"]), output });

    expect(chunks.join("")).toContain("1 > ");
    expect(chunks.join("")).toContain("2 > ");
  });

  test("an async handler is awaited before the next prompt is shown", async () => {
    const order: string[] = [];
    const { output } = captureOutput();

    await runReadlineLoop(
      async (input) => {
        order.push(`start:${input}`);
        await new Promise((r) => setTimeout(r, 5));
        order.push(`end:${input}`);
      },
      { input: inputFrom(["a", "b"]), output },
    );

    expect(order).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });
});
