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

Only `createLocalTransport` — a direct in-process call, for when
Fortress and Citadel run in the same process — is implemented today. A
transport that proxies across a deployed Fortress/Citadel contour
boundary is a second `RpcTransport` implementation to add once that wire
protocol is settled; `client.call(...)` looks identical either way.
