# Getting started

[Русский](../ru/getting-started.md)

This walks through building a small feature end to end: scaffold a domain,
add a use case and an HTTP endpoint, wire them together, and see the
boundary validator catch a mistake before it becomes a bug. Every command
below is real — copy-paste it and it'll do exactly what's shown.

## Requirements

- [Bun](https://bun.com) — the only runtime Hius targets.
- PostgreSQL, only if you want to try the encrypted-field/migration
  examples later. Everything else in this guide works without a database.

## Install the CLI

```bash
bun add -g hius @hius/cli
```

This gives you the `hius` command. Everything it does also works as a
library import (`import { validateProject } from "hius"`) if you'd rather
script it than run it interactively — the CLI is a thin wrapper, not the
only way in.

## Scaffold a domain

```bash
hius generate domain billing
```

```
✔ domains/billing/module.config.ts
✔ domains/billing/citadel/README.md
✔ domains/billing/fortress/README.md
```

That's the whole shape a Hius domain starts from:

```
domains/billing/
  module.config.ts   # what this domain exposes, what it may depend on
  citadel/            # framework-agnostic business logic
  fortress/            # framework-aware code — HTTP, adapters
```

**Citadel and Fortress** are the two halves of every domain. Citadel is
plain TypeScript that doesn't import anything from `hius` or any
framework — it's the business logic, and it stays testable and portable
because it doesn't know Hius exists. Fortress is where HTTP handlers,
database adapters, and anything else framework-aware lives. The
boundary validator (below) enforces this split; it isn't just a naming
convention.

`module.config.ts` starts out empty and unblocked:

```ts
export default {
  name: "billing",
  publicApi: [],
  allowedDependencies: [],
};
```

This is the domain's **declared intent** — what it's allowed to depend
on, and which of its own exports are public. Nothing here is inferred;
you write it by hand, and the validator checks the real code against it.

## Add a use case and an endpoint

```bash
hius generate use-case billing ChargeCustomer
hius generate endpoint billing POST /invoices
```

```
✔ domains/billing/citadel/use-cases/charge-customer.ts
✔ domains/billing/citadel/use-cases/test/charge-customer.test.ts
✔ domains/billing/fortress/http/post-invoices.ts
ℹ Wire it in: r.post("/invoices", postInvoices);
```

Notice the generator didn't touch `routes.ts` for you — it printed the
line to add instead. Hius never text-patches a file you already own;
generators either create new files or tell you the one line to paste.
Add that line to `domains/billing/routes.ts` yourself (create the file if
this is the domain's first route):

```ts
import { defineRoutes } from "hius";
import { postInvoices } from "./fortress/http/post-invoices";

export const routes = defineRoutes((r) => {
  r.post("/invoices", postInvoices);
});
```

There's no dependency injection container and no decorators anywhere in
this — `postInvoices` is a plain function, `r.post` takes it directly.
Every wiring point in Hius works this way: explicit composition, nothing
that requires you to trace a container to find out what actually gets
called.

## Let the validator catch a real mistake

Say `ChargeCustomer` needs to look up a user, so you reach for a
`users` domain from inside `billing`:

```bash
hius generate domain users
```

```ts
// domains/billing/citadel/use-cases/charge-customer.ts
import { findUser } from "../../../users/citadel/service";
```

Nothing stops you from writing that import — but `billing`'s
`module.config.ts` never said it was allowed to depend on `users`. Run
the validator:

```bash
hius validate
```

```
ERROR  [Hius] boundary violation in billing:
  depends on users, which is not in its allowed dependencies
  → add users to module.config's allowedDependencies for billing
  → or route through a public contract/event if this dependency shouldn't exist
  (module.config for billing allows: (none))
```

This is the **intent/fact model**: `module.config.ts` is what you
*declared* (intent), and `hius validate` statically extracts what the
code *actually* imports (fact) by walking the real import graph. Any
divergence is an error with a fix built into the message, not a lint
warning to ignore. Fix it by declaring the dependency:

```ts
export default {
  name: "billing",
  publicApi: [],
  allowedDependencies: ["users"],
};
```

```bash
hius validate
```

```
✔ validate: no boundary violations
```

The same check runs as `validate_change` in the [dev MCP
server](../../packages/mcp/README.md), so a coding agent gets the exact
same corrective error before a change ever reaches you.

## Events

```bash
hius generate event billing invoice.paid
```

```
✔ domains/billing/citadel/handlers/on-invoice-paid.ts
ℹ Wire it in: bus.on("invoice.paid", onInvoicePaid);
```

The generated handler carries a reminder worth taking seriously:
delivery through the outbox is at-least-once, so a handler must be
idempotent — safe to run twice on the same payload. See
[`hius`](../../packages/hius/README.md) for how the event bus and outbox
fit together.

## Contracts, MCP tools, and the RPC client

```bash
hius generate mcp-tool billing charge-customer
```

```
✔ domains/billing/citadel/contracts/charge-customer.ts
ℹ Import the contract as ChargeCustomerContract, then wire it in:
bindContract(ChargeCustomerContract, async (input) => {
  throw new Error("ChargeCustomer is not implemented yet");
});
```

A **contract** (`defineContract`, from `@hius/spec`) is a named,
versioned, Zod-typed input/output pair — the one artifact the
[Application MCP Adapter](../../packages/mcp-adapter/README.md) and the
[RPC client](../../packages/rpc/README.md) both generate from. Neither
adapter is a separate thing to hand-write per operation; both read the
same contract. `hius contract diff` compares two versions of a domain's
contracts and classifies each change as patch, minor, or major — see its
[package README](../../packages/cli/README.md) for the exact rules.

## Console and database

```bash
hius console                 # JS REPL with the app's manifest, configs, and db in scope
hius console --app billing   # scoped to one domain
hius db                      # SQL console
hius db generate             # drizzle-kit generate, via hius
hius db migrate              # drizzle-kit migrate, via hius
```

## Testing

[`@hius/test-harness`](../../packages/test-harness/README.md) gives your
own test suite the same real-dependency building blocks the framework's
own tests use: a real Postgres connection with teardown, a fixed test
encryption key, and a real HTTP server on an ephemeral port for
end-to-end request tests. None of it mocks anything — that's
deliberate; see the package README for why.

## Where to go next

- [Architecture](architecture.md) — Citadel/Fortress, the intent/fact
  model, and the adapter principle in more depth.
- Every package under `packages/` has its own README with the details
  specific to it.
