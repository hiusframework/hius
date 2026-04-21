# Database Setup

## Stack

- **PostgreSQL** >= 14
- **Drizzle ORM** with the `bun-sql` adapter
- **Bun SQL** — built-in PostgreSQL client, no extra packages needed

## Environment variables

Set `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgres://user:password@localhost:5432/hius_dev
```

For tests, set it in `.env.test` (Bun loads this automatically when running `bun test`):

```
DATABASE_URL=postgres://user:password@localhost:5432/hius_test
```

`src/config/env.ts` validates `DATABASE_URL` at startup and throws immediately if it is missing.

## Client initialization

The DB client lives in `src/infra/db/client.ts`:

```ts
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema/users.ts";

export const sql = new SQL(process.env["DATABASE_URL"]!);
export const db = drizzle({ client: sql, schema });

export type Db = typeof db;
```

Bun loads `.env` automatically — no `dotenv` needed.

The `Db` type alias is exported so repositories can accept it as a constructor argument without coupling to the global `db` instance.

## Drizzle config

`drizzle.config.ts` at the project root controls migration generation and studio:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Available commands

| Command | What it does |
|---|---|
| `mise run db:generate` | Generate migration files from schema changes |
| `mise run db:migrate` | Apply pending migrations to the database |
| `mise run db:push` | Push schema directly to DB without migration files (dev only) |
| `mise run db:studio` | Open Drizzle Studio in the browser |

## Next steps

- [Schema & Migrations](04_schema_and_migrations.md)
