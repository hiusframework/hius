---
name: hius
description: Conventions for working in a Hius application — file-system discovery, module.config, explicit composition, boundary validation. Load before adding or modifying a domain.
---

# Hius conventions

Hius has no hidden magic: every rule below is either enforced by `hius validate` (or the MCP tool `validate_change`) or directly visible in the file tree. When in doubt, run validation rather than guessing — a boundary violation comes back as a specific, corrective message naming the offending import and how to fix it, not a vague error.

## Where things go (file-system discovery)

A domain is a directory under `domains/`. Files are discovered by name/location, not by registration — `apps/` is a different, sibling directory for deployable applications (a web frontend, an API entrypoint), not domains; `discoverDomains` never looks inside it.

```
domains/<domain>/
  module.config.ts   # required — see below
  index.ts            # optional lazy-loading manifest, rarely needed
  routes.ts           # HTTP routes
  events.ts           # event handlers
  jobs.ts              # background jobs
  models/               # Drizzle schemas
  citadel/               # framework-agnostic business logic — no imports from hius/http, hius/db, etc.
  fortress/               # framework-aware code — HTTP controllers, adapters, web rendering
```

Citadel/fortress is a real boundary, not a suggestion: citadel code should be understandable and testable with zero knowledge of the framework around it. If a citadel file needs to import from `hius`, that's a sign the logic belongs in fortress instead.

## `module.config.ts` — required per domain

Every domain needs one. It declares intent; `hius validate` compares it against the manifest extracted from actual imports (fact) and flags any divergence:

```ts
export default {
  name: "billing",
  publicApi: ["./citadel/contracts/InvoiceContract"],
  allowedDependencies: ["users"], // "shared" is always implicitly allowed, don't list it
  publicErrors: ["InsufficientFundsError"], // optional, defaults to []
};
```

A domain present in the file tree without a `module.config.ts` is itself a violation — not an oversight to fix later.

## No DI container — explicit composition

Dependencies are passed as plain function parameters, not resolved through a container:

```ts
// citadel/use-cases/charge-customer.ts
export const createChargeCustomer = (repo: BillingRepo, gateway: PaymentGateway) =>
  async (customerId: string, amount: Money) => { /* ... */ };
```

No decorators, no `@Injectable`, no class-based controllers. An HTTP handler is a plain function bound to its dependencies at the call site, then handed directly to the route builder — see below.

## HTTP routes

```ts
import { defineRoutes } from "hius";

export default defineRoutes((r) => {
  r.get("/invoices/:id", showInvoice);
  r.post("/invoices", createInvoice);
  r.resources("customers", { index: listCustomers, show: showCustomer }); // partial is fine — only listed actions get routes
});
```

Handlers are `(req: HiusRequest) => Promise<Response>`. Throw a domain error from `hius` (`NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `UnprocessableError`) and the router maps it to the right HTTP status automatically — don't catch and translate these yourself.

## Repository writes that can race

Wrap any write guarded by a unique constraint in `withUniqueConstraintMapping` — an app-level "does this already exist?" check can never be race-safe on its own (two concurrent requests can both pass the check before either writes):

```ts
import { withUniqueConstraintMapping } from "hius";

await withUniqueConstraintMapping(
  () => db.insert(users).values({ ...row }),
  "email already taken",
);
```

## Encrypted, searchable fields

Register the field once, then query through the Query AST — never hand-roll a query against the hash column:

```ts
registry.register("users", {
  email: { encrypted: true, searchable: true, field: "email_encrypted", hashField: "email_hash" },
});

const condition = rewriteQuery(eq("email", input), "users", registry, blindIndex);
await adapter.findOne(usersTable, condition);
```

## Events — publish durably, subscribe in-process

Publishing an event is a durable write (the outbox), not a direct call to the bus — that's what makes delivery survive a crash between "save the change" and "notify subscribers":

```ts
import { writeOutboxEvent, createEventBus } from "hius";

// in the same transaction as the business change:
await writeOutboxEvent(tx, "invoice.paid", { invoiceId, amount });

// elsewhere, subscribing:
bus.on("invoice.paid", async (payload) => { /* must be idempotent — at-least-once delivery */ });
```

Event handlers must be idempotent: a crash between a handler succeeding and the outbox row being marked dispatched redelivers that row on the next relay pass.

## Generator commands

Every generator either creates new files or prints the one line you need to
paste into a file you already own — never text-patches an existing file:

```bash
hius generate domain <name>
hius generate use-case <domain> <name>
hius generate endpoint <domain> <METHOD> <path>
hius generate event <domain> <name>
hius generate mcp-tool <domain> <operation>
hius generate model <domain> <Name> field:type ...
```

Every subcommand accepts `--dir <path>` (default `domains`) and `--force`;
every subcommand except `domain` also accepts `--acronym <words>` for names
that should keep their own exact casing (`HR`, `API`, …) instead of only a
capitalized first letter. Run `hius generate <command> --help` for a
subcommand's exact arguments rather than guessing at flag names.

## Before considering a change done

Run `hius validate` (or call the MCP tool `validate_change`) — it's the same engine either way, one core with two interfaces. A clean result means every domain's `module.config.ts` matches its actual imports; nothing else is implied. Use `get_architecture` for the full dependency graph and `get_domain(name)` for a single domain's context pack (public API, dependencies, files, exports) before making changes that cross a boundary, rather than inferring structure from grep.
