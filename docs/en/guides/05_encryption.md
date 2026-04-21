# Encryption

Hius uses an explicit, ORM-agnostic encryption layer. No magic getters, no ORM hooks — encryption happens only through explicit API calls.

## Architecture

```
Repository
  ↓
Query Builder (AST)       ← eq("email", "x@y.com")
  ↓
Query Rewrite Engine      ← → WHERE email_hash = hmac("x@y.com")
  ↓
ORM Adapter (Drizzle)
  ↓
Database
```

All components live in `src/infra/encryption/`.

## Key management

Keys are read from environment variables via `KeyProvider`:

```ts
import { createEnvKeyProvider } from "@/infra/encryption";

const provider = createEnvKeyProvider();
// reads ENCRYPTION_KEY, HMAC_KEY, KEY_ID from process.env
// optionally reads KEYRING_JSON for historical keys used during decrypt
```

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | Base64-encoded 32-byte AES key |
| `HMAC_KEY` | Base64-encoded 32-byte HMAC key |
| `KEY_ID` | String identifier for the active key version |
| `KEYRING_JSON` | Optional JSON array of historical `{ keyId, encryptionKey, hmacKey }` bundles for key rotation |

`KEYRING_JSON` is easiest to manage in a `.env` file. Embedding raw JSON directly in shell commands or CI variables is easy to misquote, so keep a copy-pasteable example in your secrets manager or checked-in `.env.example`.

Example:

```env
KEYRING_JSON=[{"keyId":"v1-2026-04-21","encryptionKey":"q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s=","hmacKey":"u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7s="}]
```

For tests, use `createStaticKeyProvider(bundle)` with fixed keys.

## Encryption

`CryptoEngine` wraps AES-256-GCM with a versioned payload format:

```
v1:<keyId>:<base64(iv|ciphertext|tag)>
```

```ts
import { createCryptoEngine, createEnvKeyProvider } from "@/infra/encryption";

const crypto = createCryptoEngine(createEnvKeyProvider());

const payload = crypto.encrypt("alice@example.com");
const plain   = crypto.decrypt(payload); // "alice@example.com"
```

Each `encrypt()` call uses a fresh random IV — the same plaintext produces a different ciphertext every time.

`decrypt()` reads the embedded `keyId` from the payload and asks the provider for the matching key, so old ciphertext can remain readable after rotation as long as the old key stays in the keyring.

## Blind index

A blind index is an HMAC of the plaintext, used to search encrypted fields without decrypting them.

```ts
import { createBlindIndex, createEnvKeyProvider } from "@/infra/encryption";

const index = createBlindIndex(createEnvKeyProvider());

index.compute("Alice@Example.COM"); // normalized: lowercase + trim before hashing
index.compute("alice@example.com"); // same result
```

The input is normalized (lowercase + trim) before hashing so that `Alice@Example.COM` and `alice@example.com` resolve to the same hash.

## Field registry

The registry maps logical field names (what the domain sees) to physical DB columns:

```ts
import { createFieldRegistry } from "@/infra/encryption";

const registry = createFieldRegistry();

registry.register("users", {
  email: {
    encrypted: true,
    searchable: true,
    field: "email_encrypted",   // ciphertext column
    hashField: "email_hash",    // blind index column
  },
});
```

## Query rewrite

`rewriteQuery` transforms logical queries into physical DB queries:

```ts
import { eq, rewriteQuery } from "@/infra/encryption";

const query    = eq("email", "alice@example.com");
const rewritten = rewriteQuery(query, "users", registry, blindIndex);
// → { type: "eq", column: "email_hash", value: "a3f9..." }
```

**Rules:**
- `eq` on a searchable encrypted field → rewrites to `hashField = blindIndex(value)`
- `eq` on a non-searchable encrypted field → **throws** (would require full table scan)
- `eq` on a plain field → passes through unchanged
- `and` / `or` → recurse

## Drizzle adapter

`DrizzleAdapter` executes a rewritten query against a Drizzle table:

```ts
import { DrizzleAdapter, eq, rewriteQuery } from "@/infra/encryption";
import { db } from "@/infra/db/client";
import { users } from "@/infra/db/schema/users";

const adapter = new DrizzleAdapter(db);

const rewritten = rewriteQuery(eq("email", "alice@example.com"), "users", registry, index);
const row = await adapter.findOne(users, rewritten);
```

## Repository integration

`DrizzleUserRepository` accepts `CryptoEngine` and `BlindIndex` as separate constructor arguments — they are distinct responsibilities and may use different keys in the future.

```ts
import { createCryptoEngine, createBlindIndex, createEnvKeyProvider } from "@/infra/encryption";
import { DrizzleUserRepository } from "@/infra/db/repositories/user.repository";
import { db } from "@/infra/db/client";

const provider = createEnvKeyProvider();
const repo = new DrizzleUserRepository(
  db,
  createCryptoEngine(provider),
  createBlindIndex(provider),
);
```

The repository handles all encrypt/decrypt/hash calls internally. The domain layer (`UsersService`) receives and passes plain `User` objects — it never touches crypto directly.

## Backfill migration

When migrating existing plaintext data to encrypted columns:

```ts
import { backfillRows } from "@/infra/encryption";

await backfillRows(
  plaintextRows,   // [{ id, plaintext }]
  crypto,
  blindIndex,
  async (results) => {
    // results: [{ id, encrypted, hash }]
    // write back to DB in batches
  },
);
```

## Limitations

- **No partial search** — blind index supports equality only. `LIKE`, prefix, or full-text search on encrypted fields is not possible.
- **Equality leakage** — two rows with the same email produce the same hash. An attacker with DB access can confirm whether two users share an email, even without the HMAC key.
- **Historical keys must stay available** — removing an old key from the provider makes all payloads encrypted with that key unreadable.
- **Normalization is fixed** — `blindIndex` always applies lowercase + trim. Changing normalization after data is written breaks existing lookups.
