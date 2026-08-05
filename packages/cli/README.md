# @hius/cli

[Русский](README.ru.md)

The `hius` command. Every command here is a thin wrapper over
[`hius`](../hius/README.md) (the runtime) and [`@hius/core`](../core/README.md)
— nothing in this package does its own validation or extraction logic, it
just gives them a CLI surface plus styled output ([consola](https://github.com/unjs/consola)).

For a full walkthrough, see [Getting started](../../docs/en/getting-started.md).
This README is a reference for each command.

## `hius validate`

```bash
hius validate [--dir apps]
```

Compares every domain's `module.config.ts` against its actual import
graph. Exits non-zero with every violation's corrective message printed
if anything doesn't match.

## `hius console` / `hius console --app <domain>`

A JS REPL (`node:readline`-based — real history, Home/End, `\` or
Shift+Enter for a multi-line continuation) with the app's manifest,
module configs, event bus, and database connection already in scope.
`--app <domain>` scopes it to one domain's context pack instead of the
whole app.

## `hius db`

```bash
hius db                # SQL console (bare — same as `hius db console`)
hius db generate [...] # drizzle-kit generate, args forwarded verbatim
hius db migrate [...]  # drizzle-kit migrate, args forwarded verbatim
hius db studio [...]   # drizzle-kit studio, args forwarded verbatim
```

`generate`/`migrate`/`studio` are thin pass-throughs to `drizzle-kit`
(`bunx drizzle-kit <subcommand> ...`) — drizzle-kit already owns config
resolution, the database connection, and any interactive prompts;
reimplementing that would just be a second, worse copy of it. They exist
under `hius db` for discoverability, nothing more.

## `hius generate <subcommand>`

Every generator either creates new files or prints the one line you need
to paste into a file you already own — none of them text-patch an
existing file.

| Subcommand | Example | Creates |
|---|---|---|
| `app <name>` | `hius generate app billing` | `module.config.ts`, `citadel/README.md`, `fortress/README.md` |
| `use-case <domain> <name>` | `hius generate use-case billing ChargeCustomer` | A citadel use case + test |
| `endpoint <domain> <method> <path>` | `hius generate endpoint billing POST /invoices` | A fortress HTTP handler + the `r.post(...)` line to add |
| `event <domain> <name>` | `hius generate event billing invoice.paid` | A citadel event handler + the `bus.on(...)` line to add |
| `mcp-tool <domain> <operation>` | `hius generate mcp-tool billing ChargeCustomer` | A contract skeleton + the `bindContract(...)` line to add |
| `model <domain> <Name> field:type ...` | `hius generate model billing Invoice amount:money status:string` | A Drizzle schema + test |

Every subcommand accepts `--dir <path>` (default `apps`) and `--force`
(overwrite instead of skipping existing files).

## `hius contract diff`

```bash
hius contract diff --dir apps --against <baseline apps/ dir>
```

Loads every domain's contracts from both directories and runs
[`@hius/core`](../core/README.md)'s `diffContracts()`, printing each
change with its severity. Exits non-zero only on a `major` (breaking)
change — `patch`/`minor` are informational. Comparing two directories
rather than two git refs keeps the command itself simple; a CI job sets
up the baseline checkout (a worktree, a second clone) and points
`--against` at it.
