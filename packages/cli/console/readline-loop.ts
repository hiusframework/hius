import readline from "node:readline";
import type { Readable, Writable } from "node:stream";

// Receives the 1-based number of the line about to be read and returns the
// prompt string to show for it. Callers (commands/console.ts,
// commands/db.ts) can customize it — e.g. to include the scoped domain
// name or distinguish the JS console from the SQL one.
export type ConsolePrompt = (lineNumber: number) => string;
export const defaultPrompt: ConsolePrompt = (n) => `${n} > `;

export type LineHandler = (input: string) => Promise<void> | void;

export type ReadlineLoopOptions = {
  input?: Readable;
  output?: Writable;
  prompt?: ConsolePrompt;
  historySize?: number;
};

/**
 * Shared input loop for hius console and hius db: history via the
 * up/down arrows and Home/End line-editing come from node:readline's own
 * terminal mode (auto-enabled when `input` is a real TTY) — nothing here
 * implements them. Shift+Enter isn't reliably distinguishable from plain
 * Enter across terminals (most send the same byte sequence for both), so
 * a trailing `\` is the supported way to continue a line onto the next
 * one, not a documented Shift+Enter binding.
 */
export async function runReadlineLoop(
  handleLine: LineHandler,
  options: ReadlineLoopOptions = {},
): Promise<void> {
  const {
    input = process.stdin,
    output = process.stdout,
    prompt = defaultPrompt,
    historySize = 1000,
  } = options;

  const rl = readline.createInterface({
    input,
    output,
    historySize,
    terminal: Boolean((input as { isTTY?: boolean }).isTTY),
  });

  let lineNumber = 1;
  let continuation = "";

  rl.setPrompt(prompt(lineNumber));
  rl.prompt();

  for await (const rawLine of rl) {
    if (rawLine.endsWith("\\")) {
      continuation += `${rawLine.slice(0, -1)}\n`;
      rl.setPrompt("... ");
      rl.prompt();
      continue;
    }

    const full = (continuation + rawLine).trim();
    continuation = "";

    if (full) {
      await handleLine(full);
      lineNumber++;
    }

    rl.setPrompt(prompt(lineNumber));
    rl.prompt();
  }

  rl.close();
}
