# @hius/tui

[Русский](README.ru.md)

A multi-environment terminal dashboard — `hius tui` (from
[`@hius/cli`](../cli/README.md)). Zellij-style, not tmux/k9s-style
(D16, decided in the framework's planning docs): one tab per
environment, three panes visible at once inside each tab (console, db,
logs), a floating command palette, and an always-visible quick-input
line. Optional — a project that never runs `hius tui` never pulls in
this package's dependency on [`@opentui/core`](https://github.com/anomalyco/opentui).

## v1 scope: local environments only

`dev` and `test` — both run as child processes on this machine, with a
console/db context built the same way `hius console`/`hius db` build
theirs. Switching to a `staging`/`production` environment that lives on
a remote host needs an SSH-based `Target` implementation this package
doesn't have yet — nothing here is designed to make that addition
require a rewrite (`Target` is already the seam), but it isn't built.

## Keybindings

| Key | Does |
|---|---|
| `←` / `→` (tab bar focused) | Switch environment |
| `Tab` | Cycle focus: tab bar → console → db → quick input → tab bar |
| `Ctrl+K` | Open the command palette (fuzzy-searched) |
| `Escape` | Close the palette |
| `Enter` (console/db pane) | Evaluate the line |
| `Enter` (quick input) | Run `<command id> [args...]` |

No `Ctrl+J` toggle for the quick input line, on purpose — Ctrl+J
(`0x0A`) is the same byte as a line feed in a plain terminal, so it
can't reliably be told apart from Enter. The quick input line is just
always part of the layout instead (closer to the input bar this was
modeled on anyway).

## Commands and plugins

```ts
import { definePlugin } from "@hius/tui";

const myPlugin = definePlugin({
  name: "demo",
  commands: [
    {
      id: "hello",
      label: "Say hello",
      description: "Prints a greeting to the logs pane",
      run: (ctx) => ctx.target.run(["echo", "hello from a plugin"]),
    },
  ],
});
```

Registered commands show up namespaced (`demo:hello`) in both the quick
input line and the command palette — one `CommandRegistry`, two ways to
reach it: type the id directly, or open the palette (`Ctrl+K`) and
fuzzy-search the label/description. A command's `run` receives the
current `Target` (the active environment's console/db/process handle)
and `switchEnvironment` — the same primitives the built-in
`server:start`/`server:stop`/`run`/`env` commands use.

## Running it

```bash
hius tui [--dir domains]
```

Reads `DATABASE_URL` for `dev` from `.env` (or the current process
environment), and for `test` from `.env.test` — read directly rather
than relying on Bun's own single-file env loading, which can't hold two
environments' values live in one process at the same time.
