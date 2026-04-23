# Getting Started with Hius

This guide covers everything you need to get a Hius application up and running.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 14

## Installation

```sh
git clone <repo>
cd hius
bun install
```

## Environment Variables

Copy the example env file and fill in the values:

```sh
cp .env.example .env
```

Required variables:

| Variable                          | Description                              |
|-----------------------------------|------------------------------------------|
| `DATABASE_URL`                    | PostgreSQL connection string             |
| `ENCRYPTION_KEY`                  | Base64-encoded 32-byte AES key           |
| `HMAC_KEY`                        | Base64-encoded 32-byte HMAC key          |
| `KEY_ID`                          | Identifier for the active key version    |
| `KEYRING_JSON`                    | Optional JSON array of historical keys for rotation |

### Generating keys

```sh
# ENCRYPTION_KEY
openssl rand -base64 32

# HMAC_KEY
openssl rand -base64 32

# KEY_ID — any string, e.g. a date or version
echo "v1-2026-04-21"
```

## Running the project

```sh
# Development (hot reload)
bun dev

# Run a specific file
bun run src/index.ts
```

## Running tests

```sh
bun test
```

## Project structure

```
src/
  core/              # Module system, DI container
  http/              # HTTP layer (router, pipes, validation)
    core/            # HiusRequest, response helpers, types
    routing/         # DSL builder, path matcher, pipeline
    validation/      # validate(), permit(), permitQuery()
  infra/
    db/
      schema/        # Drizzle table definitions
      repositories/  # Drizzle repository implementations
      client.ts      # DB connection
    encryption/      # Encryption layer (crypto, blind index, query rewrite)
  domain/            # Pure domain types and interfaces
  app/               # Application services and controllers
  config/            # Environment validation
  test/              # Tests
```

## Next steps

- [Modules & Dependency Injection](02_modules_and_di.md)
- [Database Setup](03_database.md)
- [HTTP Routing](08_http_routing.md)
- [Validation & Strong Parameters](09_validation.md)
- [Tooling](10_tooling.md)
