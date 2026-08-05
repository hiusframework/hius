import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import type { KeyBundle, KeyProvider, RouteDescriptor } from "hius";
import { bootstrapHttp, createStaticKeyProvider } from "hius";

export const PACKAGE_NAME = "@hius/test-harness" as const;

// Common setup a Hius application's own integration/e2e tests need —
// generalized from patterns that were being hand-rolled per test file
// (a real Postgres connection with teardown, a fixed test key bundle, an
// ephemeral-port HTTP server). None of this is framework-internal: it's
// exactly what an application built on Hius needs for its own test suite
// too, which is why it's a separate package rather than living inside
// `hius` itself.

// True when a real database is reachable (DATABASE_URL set, e.g. from
// .env.test, which Bun loads automatically on `bun test`) — gate
// integration tests with `describe.if(hasDb)(...)` rather than skipping
// silently on a misconfigured environment.
export const hasDb = !!process.env.DATABASE_URL;

export type TestDatabase = {
  sql: SQL;
  db: ReturnType<typeof drizzle>;
  teardown: () => Promise<void>;
};

/**
 * Opens a real connection to DATABASE_URL and wraps it with Drizzle — no
 * schema binding, since `db.select().from(table)`/`db.insert(table)`
 * work against any table without one; a test file that wants typed
 * `db.query.*` access can pass its own schema straight to
 * `drizzle-orm/bun-sql` instead of going through this helper.
 */
export function createTestDatabase(): TestDatabase {
  // Checked fresh here rather than via the module-level `hasDb` constant
  // — `hasDb` is captured once at import time, so it wouldn't reflect a
  // DATABASE_URL change (or removal, e.g. in a test of this very error)
  // made afterward.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("createTestDatabase requires DATABASE_URL to be set");
  }
  const sql = new SQL(databaseUrl);
  const db = drizzle({ client: sql });

  return {
    sql,
    db,
    teardown: () => sql.close(),
  };
}

// Fixed 32-byte keys — deterministic across test runs, never use in
// production. One canonical bundle here instead of every test file
// inventing its own Buffer.alloc(32, ...) constants. Exported directly
// (not just wrapped in a provider) for tests that compose it themselves
// — key rotation tests need a *second*, distinct bundle alongside this
// one, which createStaticKeyProvider's own (activeKey, additionalKeys)
// signature already supports.
export const testKeyBundle: KeyBundle = {
  keyId: "test-key-1",
  encryptionKey: Buffer.alloc(32, 0x01),
  hmacKey: Buffer.alloc(32, 0x02),
};

export function createTestKeyProvider(): KeyProvider {
  return createStaticKeyProvider(testKeyBundle);
}

export type TestServer = {
  url: string;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  close: () => void;
};

/**
 * Boots a real HTTP server on an OS-assigned free port (safe for tests
 * running in parallel) and returns a `fetch` scoped to it — an actual
 * request/response round-trip through the real router, not a handler
 * called in-process, so status codes, headers, and serialization are all
 * exercised the same way a real client would see them.
 */
export function createTestServer(routes: RouteDescriptor[]): TestServer {
  const server = bootstrapHttp(routes, { port: 0 });
  const url = `http://localhost:${server.port}`;

  return {
    url,
    fetch: (path, init) => fetch(`${url}${path}`, init),
    close: () => server.stop(true),
  };
}
