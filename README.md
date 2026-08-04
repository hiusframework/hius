# Hius

Modular, domain-driven TypeScript/Bun framework — machine-readable architecture
as a first-class artifact, AI-native by construction. Bun workspaces monorepo.

## Packages

| Package | Purpose |
|---|---|
| `@hius/spec` | Zod schemas for the manifest model (intent/fact) |
| `@hius/core` | Validator, graph, contract diff — sees only the manifest |
| `hius` | Runtime: discovery, explicit composition, events, ts-morph extraction, Query AST, Encryption Layer |
| `@hius/shared` | Common value-object types/utilities, no business logic |
| `@hius/cli` | `hius` CLI — thin wrapper over `@hius/core` + `hius` |
| `@hius/mcp` | MCP server — same core as the CLI, second interface |
| `@hius/rpc` | Framework-agnostic typed contract-client |

## Getting started

```bash
bun install
bun test
bunx tsc --noEmit
bunx biome check packages/ apps/
mise run hooks:install   # wires Lefthook pre-commit hooks
```
