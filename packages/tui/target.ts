import type { ConsoleContext, ConsoleIO } from "@hius/cli/console";
import { buildConsoleContext, evalJs, evalSql } from "@hius/cli/console";
import { SQL } from "bun";

// v1 (D16, concept_docs/hius-decisions-log.md) — LocalTarget only. A
// RemoteTarget (SSH to a staging/production host) is the same interface,
// deferred until packages/deploy exists to give it something to connect
// to — this shape exists precisely so that addition doesn't require
// rewriting the panes/commands built against Target.

export type LogLine = {
  stream: "stdout" | "stderr" | "info";
  text: string;
  at: Date;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type EvalResult = {
  output: string;
  isError: boolean;
};

export interface Target {
  readonly name: string;
  isRunning(): boolean;
  start(command: string[]): void;
  stop(): void;
  run(command: string[]): Promise<CommandResult>;
  onLog(handler: (line: LogLine) => void): () => void;
  evalConsole(input: string): Promise<EvalResult>;
  evalDb(input: string): Promise<EvalResult>;
  dispose(): Promise<void>;
}

export type LocalTargetOptions = {
  name: string;
  dir?: string;
  databaseUrl?: string;
};

function captureIo(): { io: ConsoleIO; take: () => { output: string; isError: boolean } } {
  const lines: string[] = [];
  let isError = false;
  const io: ConsoleIO = {
    log: (...args) => {
      lines.push(args.map((a) => (typeof a === "string" ? a : Bun.inspect(a))).join(" "));
    },
    error: (...args) => {
      isError = true;
      lines.push(
        args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : Bun.inspect(a))).join(" "),
      );
    },
  };
  return { io, take: () => ({ output: lines.join("\n"), isError }) };
}

/**
 * A local environment — a child process this same machine can spawn
 * directly, and a console/db eval context backed by evalJs/evalSql from
 * @hius/cli/console (the same engine `hius console`/`hius db` run, not a
 * shelled-out subprocess or a second implementation).
 */
export function createLocalTarget(options: LocalTargetOptions): Target {
  const { name, dir = "domains", databaseUrl = process.env.DATABASE_URL } = options;

  let proc: ReturnType<typeof Bun.spawn> | null = null;
  const logHandlers = new Set<(line: LogLine) => void>();
  const emit = (line: LogLine) => {
    for (const handler of logHandlers) handler(line);
  };

  let consoleContext: ConsoleContext | null = null;
  const getConsoleContext = async (): Promise<ConsoleContext> => {
    consoleContext ??= await buildConsoleContext(dir);
    return consoleContext;
  };

  let sql: SQL | null = null;
  const getSql = (): SQL => {
    if (!databaseUrl) {
      throw new Error(`[Hius/TUI] target "${name}" has no DATABASE_URL — db pane is unavailable`);
    }
    sql ??= new SQL(databaseUrl);
    return sql;
  };

  async function streamOutput(stream: ReadableStream<Uint8Array>, kind: "stdout" | "stderr") {
    for await (const chunk of stream) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split("\n")) {
        if (line.length > 0) emit({ stream: kind, text: line, at: new Date() });
      }
    }
  }

  return {
    name,

    isRunning: () => proc !== null && proc.exitCode === null,

    start(command) {
      if (proc && proc.exitCode === null) {
        emit({ stream: "info", text: "already running — stop it first", at: new Date() });
        return;
      }
      proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
      emit({
        stream: "info",
        text: `started: ${command.join(" ")} (pid ${proc.pid})`,
        at: new Date(),
      });
      if (proc.stdout instanceof ReadableStream) streamOutput(proc.stdout, "stdout");
      if (proc.stderr instanceof ReadableStream) streamOutput(proc.stderr, "stderr");
    },

    stop() {
      if (!proc || proc.exitCode !== null) {
        emit({ stream: "info", text: "not running", at: new Date() });
        return;
      }
      proc.kill();
      emit({ stream: "info", text: "stopped", at: new Date() });
    },

    async run(command) {
      const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      return { stdout, stderr, exitCode };
    },

    onLog(handler) {
      logHandlers.add(handler);
      return () => logHandlers.delete(handler);
    },

    async evalConsole(input) {
      const context = await getConsoleContext();
      const { io, take } = captureIo();
      await evalJs(input, context, io);
      return take();
    },

    async evalDb(input) {
      const { io, take } = captureIo();
      await evalSql(getSql(), input, io);
      return take();
    },

    async dispose() {
      if (proc && proc.exitCode === null) proc.kill();
      if (sql) await sql.close();
    },
  };
}
