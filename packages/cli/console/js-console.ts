import { consola } from "consola";
import type { ConsoleContext, ConsoleIO } from "hius/console";
import { defaultConsoleIo, evalJs } from "hius/console";
import { type ReadlineLoopOptions, runReadlineLoop } from "./readline-loop";

export type { ConsoleContext, ConsoleIO } from "hius/console";
export { buildConsoleContext, defaultConsoleIo, evalJs } from "hius/console";

/**
 * A plain JS REPL preloaded with the application's context. Line input
 * (history, Home/End, \-continuation) is handled by readline-loop.ts,
 * shared with the SQL console. evalJs (hius/console) is the reusable
 * per-line evaluation core this loops over — the same one @hius/tui's
 * embedded console pane calls directly, one line at a time.
 */
export async function startJsConsole(
  context: ConsoleContext,
  options: ReadlineLoopOptions & { io?: ConsoleIO } = {},
): Promise<void> {
  const { io = defaultConsoleIo, ...loopOptions } = options;
  const { db } = context;

  consola.info(
    `Hius console — manifest, configs, events${db ? ", db" : ""} available. Ctrl+D to exit.`,
  );

  await runReadlineLoop((input) => evalJs(input, context, io), loopOptions);
}
