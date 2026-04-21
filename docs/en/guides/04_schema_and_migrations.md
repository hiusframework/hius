# Schema & Migrations

## Schema definition

Schemas live in `src/infra/db/schema/`. Each file defines one or more Drizzle tables using `pgTable`.

### Users table

`src/infra/db/schema/users.ts`:

```ts
import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:              uuid("id").primaryKey(),
  email_encrypted: text("email_encrypted").notNull(),
  email_hash:      text("email_hash").notNull().unique(),
  email_det:       text("email_det"),
  name:            text("name"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at:      timestamp("deleted_at", { withTimezone: true }),
});
```

**Field conventions for encrypted data:**

| Field | Purpose |
|---|---|
| `email_encrypted` | AES-256-GCM ciphertext — the actual value |
| `email_hash` | HMAC-SHA256 blind index — used for `WHERE email = ?` queries |
| `email_det` | Optional deterministic ciphertext — reserved for exact-match workflows where duplicate leakage is acceptable |

`deleted_at` implements soft deletes — repositories must filter `WHERE deleted_at IS NULL`.

## Adding a new schema file

1. Create `src/infra/db/schema/your_model.ts`
2. Export the table and its inferred types (`$inferSelect`, `$inferInsert`)
3. Re-export from `src/infra/db/client.ts` schema import — `drizzle.config.ts` picks up all files via `./src/infra/db/schema/*.ts`

## Generating migrations

After changing a schema file, generate a migration:

```sh
mise run db:generate
```

Drizzle compares the current schema against the last migration snapshot and produces a SQL file in `drizzle/`.

## Applying migrations

```sh
mise run db:migrate
```

Applies all pending migration files in order. Safe to run multiple times — already-applied migrations are skipped.

## Dev shortcut: push without migration files

```sh
mise run db:push
```

Directly syncs the schema to the DB without creating migration files. Use only in development — never against a shared or production database.

## Inspecting the database

```sh
mise run db:studio
```

Opens Drizzle Studio in the browser — a visual table browser with read/write access.
