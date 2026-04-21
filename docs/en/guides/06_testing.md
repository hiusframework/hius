# Testing

Hius uses `bun test` as the test runner. No Jest, no Vitest.

## Running tests

```sh
# All tests
bun test

# Single file
bun test src/test/encryption.test.ts

# Watch mode
bun test --watch
```

Bun automatically loads `.env.test` when running tests — set `DATABASE_URL` and crypto keys there. See [Getting Started](01_getting_started.md) for setup.

## Test structure

```
src/test/
  users.test.ts       # UsersService unit tests (in-memory repository)
  encryption.test.ts  # Full encryption layer tests
```

## What is tested

### `encryption.test.ts`

| Test | What it verifies |
|---|---|
| encrypt → decrypt | AES-256-GCM roundtrip |
| unique ciphertext | Random IV per call |
| blind index determinism | Same input → same hash |
| blind index normalization | `Alice@Example.COM` = `alice@example.com` |
| key rotation | Decrypt with old key via keyring |
| unknown key id | Throws on missing key |
| query rewrite (searchable) | `eq("email", ...)` → `email_hash` column |
| query rewrite (plain field) | Passes through unchanged |
| query rewrite (non-searchable) | Throws |
| `and` / `or` recursion | Compound conditions rewritten correctly |

### `users.test.ts`

Uses an in-memory repository — no real DB required.

| Test | What it verifies |
|---|---|
| createUser + findByEmail | Service creates and retrieves by email |
| getByEmail (missing) | Returns `null` for unknown email |
| getById | Service retrieves by id |

## In-memory repository pattern

For unit tests that don't need a real DB, implement `UserRepository` with a plain array:

```ts
function makeInMemoryRepo(): UserRepository {
  const store: User[] = [];
  return {
    async create(user) { store.push(user); },
    async findById(id) { return store.find((u) => u.id === id) ?? null; },
    async findByEmail(email) { return store.find((u) => u.email === email) ?? null; },
  };
}
```

## Integration tests

> 🚧 Not implemented yet — tracked in [Roadmap Phase 10](../../ROADMAP.md).

Integration tests will require a real PostgreSQL database. The plan:
- Use `.env.test` with a dedicated `hius_test` database
- Run `mise run db:migrate` against the test DB before the suite
- Test the full stack: `UsersService` → `DrizzleUserRepository` → encryption → PostgreSQL
