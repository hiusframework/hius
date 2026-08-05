# @hius/test-harness

[Русский](README.ru.md)

Real-dependency test helpers for a Hius application's own test suite —
the same building blocks the framework's own tests use, generalized so
you don't have to hand-roll them per test file. Nothing here mocks
anything: a real Postgres connection, a real HTTP server, real
(deterministic, test-only) encryption keys.

## `hasDb`

```ts
import { hasDb } from "@hius/test-harness";

describe.if(hasDb)("integration tests", () => {
  // ...
});
```

`true` when `DATABASE_URL` is set (e.g. from `.env.test`, which Bun
loads automatically on `bun test`). Gate integration tests on it rather
than skipping silently in a misconfigured environment.

> **Careful with `describe.if()`:** the describe callback body runs even
> when the condition is false — only the tests/hooks inside actually get
> skipped. Call `createTestDatabase()` inside `beforeAll()`, not directly
> in the describe body, or its "DATABASE_URL is unset" error will fire
> regardless of the `hasDb` guard.

## `createTestDatabase()`

```ts
const { sql, db, teardown } = createTestDatabase();
// ... use sql/db ...
await teardown();
```

Opens a real connection to `DATABASE_URL` and wraps it with Drizzle
(`drizzle-orm/bun-sql`, no schema binding — `db.select().from(table)`
works against any table without one). Throws immediately if
`DATABASE_URL` isn't set, so check `hasDb` first (see the callout above
for where to call it from).

## `createTestKeyProvider()` / `testKeyBundle`

```ts
const provider = createTestKeyProvider();
const crypto = createCryptoEngine(provider);
```

A fixed, deterministic 32-byte test key bundle wrapped in a
`KeyProvider` — never use it outside tests. `testKeyBundle` is the raw
bundle, exported separately for tests composing their own provider (key
rotation tests need a *second*, distinct bundle alongside this one via
`createStaticKeyProvider(testKeyBundle, [otherKey])`).

## `createTestServer(routes)`

```ts
const server = createTestServer(routes);
const res = await server.fetch("/invoices", { method: "POST", body: "..." });
server.close();
```

Boots a real HTTP server on an OS-assigned free port (safe for tests
running in parallel) and returns a `fetch` scoped to it — an actual
request/response round trip through the real router, not a handler
called in-process, so status codes, headers, and serialization are all
exercised the way a real client would see them.
