// Public subpath (`@hius/cli/console`) for the pieces `@hius/tui`'s
// embedded console panes reuse — the same eval engines `hius console`/
// `hius db` run, one line at a time, rather than a shelled-out subprocess
// or a second implementation. Everything else under console/ (the
// readline loop, the REPL banners) is CLI-specific terminal I/O the TUI
// doesn't need.
export type { ConsoleContext, ConsoleIO } from "./js-console";
export { buildConsoleContext, defaultConsoleIo, evalJs } from "./js-console";
export { evalSql } from "./sql-console";
