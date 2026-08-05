# @hius/mcp-adapter

[Русский](README.ru.md)

The Application MCP Adapter — exposes a *deployed* Hius application's own
domain [contracts](../spec/README.md#contracts) as MCP tools, for
external agents calling the application at runtime. This is not the same
thing as [`@hius/mcp`](../mcp/README.md), the dev/framework MCP a coding
agent uses while *building* a Hius app — see
[Architecture](../../docs/en/architecture.md#two-mcp-surfaces) for why
they're two separate packages. This one lives in Fortress and ships with
the application.

## Usage

```ts
import { bindContract } from "@hius/spec";
import { createMcpAdapter } from "@hius/mcp-adapter";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import ChargeCustomerContract from "./billing/citadel/contracts/charge-customer";
import { chargeCustomer } from "./billing/citadel/use-cases/charge-customer";

const server = createMcpAdapter([
  bindContract(ChargeCustomerContract, async (input) => {
    const result = await chargeCustomer(input);
    return { chargeId: result.id };
  }),
]);

await server.connect(new StdioServerTransport());
```

`createMcpAdapter` registers one MCP tool per binding, named in
snake_case from the contract's PascalCase name (`ChargeCustomer` →
`charge_customer`). Input parsing and output validation against the
contract's own Zod schemas are handled by the MCP SDK itself — a handler
that throws becomes an `isError` tool result automatically, nothing here
needs its own try/catch. A field the contract doesn't declare never
reaches the caller: Zod strips unrecognized object keys by default, so
returning more than the contract promises doesn't leak it.

`bindContract` comes from [`@hius/spec`](../spec/README.md) — the same
pairing [`@hius/rpc`](../rpc/README.md) uses, since both adapters
generate from the exact same contracts.

## Generating a new tool

```bash
hius generate mcp-tool billing ChargeCustomer
```

Scaffolds the contract skeleton and prints the exact `bindContract(...)`
snippet to add — see the [`@hius/cli` README](../cli/README.md).
