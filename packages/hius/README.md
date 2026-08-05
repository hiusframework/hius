# hius

[Русский](README.ru.md)

The runtime: discovery, static extraction, explicit composition for HTTP,
the event bus and outbox, the Query AST, and the Encryption Layer. This is
what `@hius/cli` and `@hius/mcp` are both thin wrappers over — everything
here is usable directly as a library, no CLI required.

See [Architecture](../../docs/en/architecture.md) for the concepts;
this README is a map of what's actually in the package.

## Discovery and extraction

```ts
import { discoverDomains, extractManifest, loadAllModuleConfigs, validateProject } from "hius";

const result = await validateProject("apps");
```

`discoverDomains` scans `apps/*` for the file/directory conventions
(`routes.ts`, `events.ts`, `jobs.ts`, `models/`, `citadel/`, `fortress/`,
`citadel/contracts/`). `extractManifest` runs ts-morph over the real
import graph to produce the fact half of the
[intent/fact model](../../docs/en/architecture.md#intent-and-fact).
`validateProject` composes extraction, config loading, and
[`@hius/core`](../core/README.md)'s `validate()` into the one call
`hius validate` runs.

## Contracts

```ts
import { loadContracts, loadAllContracts } from "hius";

const billingContracts = await loadContracts("apps", "billing", ["citadel/contracts/charge-customer.ts"]);
const everyContract = await loadAllContracts("apps");
```

Loads `citadel/contracts/*.ts` files (one `defineContract()` call,
default-exported, per file) — what `hius contract diff` and the
[Application MCP Adapter](../mcp-adapter/README.md)'s generation both
read.

## HTTP — explicit composition, no container

```ts
import { defineRoutes, bootstrapHttp } from "hius";

const routes = defineRoutes((r) => {
  r.get("/health", async () => new Response("ok"));
  r.scope("/invoices", (r) => {
    r.post("/", createInvoice);
    r.get("/:id", showInvoice);
  });
  r.resources("/customers", { index: listCustomers, show: showCustomer });
});

const server = bootstrapHttp(routes, { port: 3000 });
```

Route handlers are plain `(req: HiusRequest) => Promise<Response>`
functions — no decorators, no DI container to register a controller
class with. `permit`/`permitQuery` validate request bodies and query
params against a schema; `pipe`s compose cross-cutting concerns (auth,
logging) explicitly per-route or per-scope.

## Events and the outbox

```ts
import { createEventBus, writeOutboxEvent, relayOutboxEvents } from "hius";

const bus = createEventBus();
bus.on("invoice.paid", async (payload) => { /* ... */ });

// inside the same transaction as the state change that caused it:
await writeOutboxEvent(db, "invoice.paid", { invoiceId });

// a relay process, on an interval or triggered externally:
await relayOutboxEvents(db, bus);
```

`createEventBus` is in-process dispatch. The outbox
(`hius_outbox_events`) is what makes delivery durable and at-least-once
— see [Architecture](../../docs/en/architecture.md#events-outbox-and-delivery-guarantees)
for why that means every handler must be idempotent.

## Query AST and the Encryption Layer

```ts
import {
  createStaticKeyProvider, createCryptoEngine, createBlindIndex, createFieldRegistry,
  DrizzleAdapter, eq, and, rewriteQuery,
} from "hius";

const registry = createFieldRegistry();
registry.register("users", {
  email: { encrypted: true, searchable: true, field: "email_encrypted", hashField: "email_hash" },
});

const condition = rewriteQuery(eq("email", "alice@example.com"), "users", registry, blindIndex);
const row = await adapter.findOne(usersTable, condition);
```

A repository writes `eq("email", value)` without knowing which fields
are actually encrypted — `rewriteQuery` consults the `FieldRegistry` and
rewrites the condition into the right predicate against the hash column,
expanding to an `or` across every candidate key when key rotation is in
effect. `KeyProvider` (`createStaticKeyProvider` for tests,
`createEnvKeyProvider` for real deployments) can hold multiple keys at
once for exactly that reason.

## Error mapping

```ts
import { withUniqueConstraintMapping, ConflictError } from "hius";

await withUniqueConstraintMapping(() => db.insert(users).values(newUser));
// throws ConflictError instead of a raw Postgres unique-violation error
```

`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`,
`UnprocessableError` are the vocabulary a domain's `publicErrors` (in its
`module.config.ts`) is meant to be drawn from — deliberate, named errors
that may cross the domain boundary, not raw driver exceptions leaking
through.
