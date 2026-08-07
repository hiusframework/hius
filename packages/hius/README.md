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

const result = await validateProject("domains");
```

`discoverDomains` scans `domains/*` for the file/directory conventions
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

const billingContracts = await loadContracts("domains", "billing", ["citadel/contracts/charge-customer.ts"]);
const everyContract = await loadAllContracts("domains");
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

`bootstrapHttp`'s `tls` option is a straight passthrough to `Bun.serve`'s
own — set `requestCert: true` plus a `ca` to require and verify a client
certificate (mTLS), the Citadel-side half of the Fortress↔Citadel
transport requirement (see [`@hius/rpc`](../rpc/README.md#mtls) for the
Fortress-side client half).

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

### Migrating a plaintext field to encrypted

```ts
import { dualWrite, backfillRows, verifyBackfill, dualRead, rollbackRows } from "hius";

// stage 1 (dual-write) — every insert/update from here on:
const { plaintext, encrypted, hash } = dualWrite(input.email, crypto, blindIndex);
await db.insert(users).values({ email: plaintext, email_encrypted: encrypted, email_hash: hash });

// stage 2 (backfill) — a one-off batch job over pre-existing rows:
await backfillRows(existingRows, crypto, blindIndex, async (results) => { /* UPDATE ... */ });

// stage 3 (verify) — before trusting reads to the encrypted column:
const problems = verifyBackfill(rows, crypto).filter((r) => !r.ok);

// stage 4 (dual-read) — every read from here on:
const email = dualRead(row, crypto); // prefers row.email_encrypted, falls back to row.email

// stage 5 (cutover) — writes stop touching the plaintext column entirely.
// stage 6 — a followup schema migration drops it.
```

No hidden runtime flag tracks which stage a migration is in — each stage
is a separate code deploy, the same explicit-composition principle as
everywhere else in Hius: a repository calls a different function from
this file at each step. Rolling back from stages 1–4 is free (redeploy
the previous stage's code — plaintext was never stopped being written).
Rolling back from cutover needs `rollbackRows`, the mirror image of
`backfillRows`: it decrypts the rows written after cutover — the ones
with no plaintext to fall back to — back into plaintext, which is always
possible as long as the key that encrypted them still exists.

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

Each carries a stable `code` (`"NOT_FOUND"`, `"CONFLICT"`, etc.) alongside
its human-readable `.message` — the HTTP router includes both in the
error response body, and so does `@hius/rpc`'s HTTP transport. A `code`
is what an app should build a translated, user-facing message from
(`code` → catalog lookup); `.message` stays English and is meant for
logs and debugging, not for display, the same way `ValidationError`'s
`issues` carry Zod's own stable `code`/`path` per field rather than a
flattened English sentence. Hius doesn't ship a translation catalog or
resolve which locale to use it in — see `resolveLocale` below for the
one small piece of that it does provide.

### Locale resolution

```ts
import { resolveLocale } from "hius/http";

const locale = resolveLocale(req.raw.headers.get("accept-language"), ["en", "ru"], "en");
```

A pure function — parses `Accept-Language`, matches by quality, and
falls back from a regional variant to its base language before falling
back to your default (`ru-RU` → `ru` → `en`), the same fallback chain
Rails' `config.i18n.fallbacks` implements. Nothing is set globally: call
it in a pipe and stash the result on the request's own context with
`req.withCtx({ locale })`, the same explicit, per-request pattern
everything else in Hius uses — there's no ambient "current locale" to
leak between requests, unlike a naive `I18n.locale =` assignment.
