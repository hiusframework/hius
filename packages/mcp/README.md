# @hius/mcp

[Русский](README.ru.md)

The dev/framework MCP server — for a coding agent (Claude Code, Cursor,
etc.) developing a Hius application. Runs over the same
[`@hius/core`](../core/README.md)/[`hius`](../hius/README.md) engine as
the CLI. **Never deployed with the application** — see
[Architecture](../../docs/en/architecture.md#two-mcp-surfaces) for why
this is a separate package from [`@hius/mcp-adapter`](../mcp-adapter/README.md),
which exposes an application's own operations to external agents at
runtime instead.

## Running it

```bash
bun packages/mcp/index.ts domains   # appsDir defaults to "domains"
```

Or embed it:

```ts
import { createServer } from "@hius/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer("domains");
await server.connect(new StdioServerTransport());
```

## Tools

| Tool | Purpose |
|---|---|
| `get_architecture` | The full graph of every domain and its declared vs. actual dependencies |
| `get_domain(name)` | A context pack for one domain: public API, dependencies, files, exports — without leaking any other domain's internals |
| `validate_change` | The same engine `hius validate` runs, callable programmatically — a structured, corrective error on failure, not a raw exception |

Domain boundaries work as the agent's context boundary here on purpose:
`get_domain` never returns more than that one domain's own manifest and
config, the same discipline the boundary validator itself enforces on
real code.
