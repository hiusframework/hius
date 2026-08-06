# Hius

[Русский](README.ru.md)

Modular, domain-driven TypeScript/Bun framework — machine-readable architecture
as a first-class artifact, AI-native by construction. Bun workspaces monorepo.

New here? Start with [**Getting started**](docs/en/getting-started.md) — a
real, runnable walkthrough from scaffolding a domain to the boundary
validator catching a mistake. [**Architecture**](docs/en/architecture.md)
covers the ideas behind it in more depth.

## Packages

| Package | Purpose |
|---|---|
| [`@hius/spec`](packages/spec/README.md) | Zod schemas for the manifest model (intent/fact) and the Contract Specification |
| [`@hius/core`](packages/core/README.md) | Validator, dependency graph, contract diff — sees only the manifest |
| [`hius`](packages/hius/README.md) | Runtime: discovery, explicit composition, events/outbox, ts-morph extraction, Query AST, Encryption Layer, HTTP |
| [`@hius/shared`](packages/shared/README.md) | Common value-object types/utilities, no business logic (placeholder — not yet populated) |
| [`@hius/cli`](packages/cli/README.md) | The `hius` command — validate, console, db, generate, contract diff |
| [`@hius/mcp`](packages/mcp/README.md) | Dev/framework MCP server — same core as the CLI, for a coding agent developing a Hius app |
| [`@hius/mcp-adapter`](packages/mcp-adapter/README.md) | Application MCP Adapter — exposes a deployed app's own contracts as MCP tools |
| [`@hius/rpc`](packages/rpc/README.md) | Framework-agnostic typed contract-client |
| [`@hius/test-harness`](packages/test-harness/README.md) | Real-dependency test helpers (Postgres, HTTP, encryption keys) for your own test suite |

## Developing Hius itself

```bash
bun install
bun test
bunx tsc --noEmit
bunx biome check packages/ domains/ apps/
mise run hooks:install   # wires Lefthook pre-commit hooks
```

See [CLAUDE.md](CLAUDE.md) for this repository's own conventions
(documentation language, commit style).
