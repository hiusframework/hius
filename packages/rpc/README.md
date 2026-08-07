# @hius/rpc

[Русский](README.ru.md)

The RPC / Contract-Client Adapter — a framework-agnostic typed client for
calling domain operations from any web framework, generated from the
same [contracts](../spec/README.md#contracts) as
[`@hius/mcp-adapter`](../mcp-adapter/README.md). Same source, different
purpose: that one exposes contracts as MCP tools for external agents,
this one gives application code a typed client to call them directly.

## Usage

```ts
import { bindContract } from "@hius/spec";
import { createLocalTransport, createRpcClient } from "@hius/rpc";
import ChargeCustomerContract from "./billing/citadel/contracts/charge-customer";
import { chargeCustomer } from "./billing/citadel/use-cases/charge-customer";

const transport = createLocalTransport([
  bindContract(ChargeCustomerContract, async (input) => {
    const result = await chargeCustomer(input);
    return { chargeId: result.id };
  }),
]);
const client = createRpcClient(transport);

const result = await client.call(ChargeCustomerContract, {
  customerId: "cust_1",
  amount: 100,
});
```

`client.call(contract, input)` takes the actual contract object, not a
string name — input and output are inferred exactly from that one
contract's schemas at the call site, no method-per-contract code
generation involved. Both the input parse (before the handler runs) and
the output parse (after) double as the contract boundary: a handler
returning extra internal fields never reaches the caller, since Zod
strips fields the schema doesn't declare.

## Transports

`RpcTransport` is the one seam meant to be swapped:

```ts
export type RpcTransport = {
  call<Input extends z.ZodType, Output extends z.ZodType>(
    contract: Contract<Input, Output>,
    input: z.infer<Input>,
  ): Promise<z.infer<Output>>;
};
```

Two implementations today — `client.call(...)` looks identical either
way:

- **`createLocalTransport(bindings)`** — a direct in-process call, for
  when the caller shares a process with the bindings (Fortress and
  Citadel running as one monolith, for instance).
- **`createHttpTransport(baseUrl, options?)`** (client) +
  **`createHttpRpcServer(bindings)`** (server) — a real network call,
  for when it doesn't: a separately deployed frontend, or Fortress and
  Citadel split into their own contours. Encodes with
  [CBOR](https://cbor.io) by default (smaller and faster to parse than
  JSON, still schemaless — no `.proto`-style IDL, no generated stubs),
  with plain JSON available on both ends (`{ codec: jsonCodec }` on the
  client, or just set `Content-Type: application/json` — the server
  detects it per request) so a call can be inspected with plain curl
  while debugging. `createHttpRpcServer` returns route descriptors to
  merge into the app's own `defineRoutes` — an RPC endpoint is just more
  routes on the same Fortress HTTP surface, not a separate server.

  `OPTIONS /rpc` answers "what can I call here": every bound contract's
  name, version, description, and JSON-Schema input/output shape — a
  minimal, built-in discovery endpoint, useful for anything that wants
  to introspect the API without a hand-maintained list (an external
  client, a debugging tool, or a future codegen step).

A transport that proxies through gRPC or another cross-language wire
format is a third `RpcTransport` implementation to add if that becomes
a real need — nothing about `Contract` or `bindContract` would change
for it, the same way adding the HTTP transport didn't change either.

## Errors

`createHttpTransport` rejects with `RpcError` on a non-2xx response —
`status`, and, when the server sent them, the same `code` and (for a
validation failure) structured `issues` [Hius's domain errors and
`ValidationError`](../hius/README.md#error-mapping) already carry, not
just a flattened English message:

```ts
import { RpcError } from "@hius/rpc";

try {
  await client.call(ChargeCustomerContract, input);
} catch (error) {
  if (error instanceof RpcError && error.code === "VALIDATION_FAILED") {
    // error.issues: [{ path: ["amount"], code: "too_small", message: "..." }]
  }
}
```

A domain error thrown inside a `bindContract`-bound handler (a
`ConflictError` from a use case, say) is mapped to the matching HTTP
status and carries its `code` across the wire the same way the plain
HTTP router already does — it never gets flattened into an opaque 500
the way a genuinely unmapped error correctly still does.
