# Architecture

[Русский](../ru/architecture.md)

This explains the ideas behind Hius, not just the commands — useful once
you've been through [Getting started](getting-started.md) and want to know
why things are shaped the way they are.

## Citadel and Fortress

Every domain splits into two halves:

- **Citadel** — framework-agnostic business logic. Plain TypeScript, no
  imports from `hius` or any adapter package. This is what makes a
  domain's core logic testable without spinning up HTTP, a database, or
  the framework at all, and portable if you ever needed it to be.
- **Fortress** — framework-aware code: HTTP handlers, database adapters,
  anything that touches the outside world.

This isn't a naming convention you're trusted to follow — the boundary
validator statically checks it. A `citadel/` file importing from `hius`
or reaching into another domain's internals is a build error with a
corrective message, the same way an undeclared cross-domain dependency
is (see [Getting started](getting-started.md#let-the-validator-catch-a-real-mistake)
for that example end to end).

The split also maps directly onto deployment: Fortress and Citadel can
run as one process or as two separately deployed contours, without
changing a line of domain code. In the two-contour case, Citadel never
receives inbound network traffic at all — `citadel_egress: none` is an
enforced network policy, not just documentation.

## Intent and fact

Every domain has two representations of its boundaries, and Hius keeps
them deliberately separate:

- **Intent** — `apps/<domain>/module.config.ts`, hand-written. What this
  domain exposes (`publicApi`), what it's allowed to depend on
  (`allowedDependencies`), which of its errors may cross the boundary
  (`publicErrors`).
- **Fact** — extracted by static analysis (ts-morph) of the actual file
  tree: what the domain's code *actually* imports, what it *actually*
  exports.

`hius validate` (and `@hius/core`'s `validate()` underneath it) compares
the two. Divergence is always an error, and the manifest — the
extracted fact — is never considered wrong; only the code or the config
can be. This is a deliberate asymmetry: a static analyzer can't be
argued with about what a file actually imports.

`@hius/core` is the package that owns this comparison, and it has a
hard constraint of its own: it only ever sees the manifest, never the
runtime that produced it. That's what keeps the validator, the
dependency graph, and `hius contract diff` reusable outside of a running
Hius process — a CI job can validate a manifest without executing any
application code.

## Explicit composition

There's no dependency injection container anywhere in Hius, and no
decorators. A route handler is a plain function; wiring it in is
`r.post("/invoices", postInvoices)`, not a class registration
somewhere else. This is intentional: with a container, understanding
what actually runs for a given request means tracing through the
container's resolution logic. With explicit composition, it means
reading the file that does the wiring — the wiring *is* the
documentation.

The same principle applies to the HTTP layer's `RouteBuilder`, the
event bus's `bus.on(event, handler)`, and the RPC adapter's
`bindContract(contract, handler)`: every one of them takes plain
functions and plain data, nothing that requires reflection or
metadata to unwind.

## Contracts

A **contract** (`packages/spec`'s `defineContract`) is a named,
versioned, Zod-typed input/output pair, conventionally exported from
`citadel/contracts/*.ts`. It's the one artifact three different things
generate from:

- The [RPC / Contract-Client Adapter](../../packages/rpc/README.md) —
  a typed client for calling domain operations from any web framework.
- The [Application MCP Adapter](../../packages/mcp-adapter/README.md) —
  exposes the same operations as MCP tools for external agents calling
  a *deployed* application.
- `hius contract diff` — classifies a change between two versions of a
  domain's contracts as `patch` (a new optional field — compatible),
  `minor` (a new operation), or `major` (anything that removes or
  narrows something a caller could have relied on).

None of these three hand-roll their own idea of a domain's public
shape. A field a contract doesn't declare never reaches a caller
through either adapter — Zod's default behavior of stripping
unrecognized object keys is what enforces that in practice, not a
separate serialization allowlist someone has to maintain.

### Adapter-first

This is a general pattern in Hius, not just a contract-specific one:
every external integration goes through an adapter at Hius's own
abstraction boundary, rather than a framework-specific concept binding
directly to a third-party library. The ORM integration is a
`DrizzleAdapter`, not Drizzle calls scattered through domain code; the
deploy backend is swappable; the ORM and the deploy mechanism both
exist as one concrete implementation today with the seam already there
for a second. `@hius/mcp-adapter` and `@hius/rpc` are two more
instances of the same shape: both read contracts, both expose them
through a swappable transport, neither hard-codes the other's
existence.

## Two MCP surfaces

Hius has two MCP servers, and they answer different questions for
different consumers:

- **[`@hius/mcp`](../../packages/mcp/README.md)** — the dev/framework
  MCP. A coding agent developing a Hius application talks to this: "what
  domains exist," "what's this domain's public API," "does this change
  pass validation." It runs over `@hius/core` and is never deployed with
  the application itself.
- **[`@hius/mcp-adapter`](../../packages/mcp-adapter/README.md)** — the
  Application MCP Adapter. An external agent calling a *deployed* Hius
  application talks to this instead — it exposes the application's own
  domain contracts as MCP tools, lives in Fortress, and ships with the
  application.

Conflating these would mean shipping framework-development tooling to
production, or exposing an application's operational surface to a
coding agent that has no business calling it — hence two packages, not
one with a mode flag.

## Encryption Layer and Query AST

Sensitive fields (a user's email, say) are stored encrypted, with a
separate blind-index hash column for equality lookups — you can query
`WHERE email = ?` without the database ever seeing plaintext or a
reversible ciphertext index. Key rotation is a first-class case: a
`KeyProvider` can hold multiple keys, encryption always uses the active
one, and a lookup checks *every* known key's hash so a rotated field is
still findable without a backfill blocking the rotation.

The **Query AST** (`eq`/`and`/`or` from `hius`) is what makes this
transparent to a repository: you write `eq("email", value)`, and
`rewriteQuery` — knowing which fields are encrypted via a
`FieldRegistry` — rewrites it into the right condition against the
hash column, expanding to an `or` across every candidate key when
rotation is in effect. A repository never manually decides "is this
field encrypted, which column do I actually filter on."

## Events, outbox, and delivery guarantees

`createEventBus()` is the in-process dispatch mechanism — `bus.on`,
`bus.off`, and an `emit` that awaits every handler concurrently. The
**outbox** (`writeOutboxEvent`/`relayOutboxEvents`) is separate and
durable: an event gets written to a Postgres table in the same
transaction as the state change that caused it, and a relay process
reads undispatched rows and dispatches them through the bus, marking
each dispatched only on success.

This combination is what makes delivery at-least-once rather than
best-effort: a crash between "state changed" and "event dispatched" is
recoverable, because the row is still sitting there undispatched. The
cost is that every handler must be idempotent — a retried row will call
it again with the same payload. `hius generate event` bakes that
reminder into the generated handler's own comment, not just here.
