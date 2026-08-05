import { afterEach, describe, expect, test } from "bun:test";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { defineRoutes } from "hius";
import {
  createTestDatabase,
  createTestKeyProvider,
  createTestServer,
  hasDb,
  PACKAGE_NAME,
  testKeyBundle,
} from "@/index";

const probeTable = pgTable("hius_test_harness_probe", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
});

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/test-harness");
});

describe.if(hasDb)("createTestDatabase", () => {
  test("opens a real, queryable connection and tears it down cleanly", async () => {
    const { sql, teardown } = createTestDatabase();

    const [{ answer }] = await sql`SELECT 1 AS answer`;
    expect(answer).toBe(1);

    await expect(teardown()).resolves.toBeUndefined();
  });

  test("db works through drizzle's query builder for a real table", async () => {
    const { sql, db, teardown } = createTestDatabase();
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS hius_test_harness_probe (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          label TEXT NOT NULL
        )
      `;
      await db.delete(probeTable);
      await db.insert(probeTable).values({ label: "probe" });

      const rows = await db.select({ label: probeTable.label }).from(probeTable);
      expect(rows).toEqual([{ label: "probe" }]);
    } finally {
      await sql`DROP TABLE IF EXISTS hius_test_harness_probe`;
      await teardown();
    }
  });
});

test("createTestDatabase throws a clear error when DATABASE_URL is unset", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    expect(() => createTestDatabase()).toThrow("requires DATABASE_URL");
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});

describe("createTestKeyProvider", () => {
  test("returns a deterministic 32-byte key bundle usable for encryption round-trips", () => {
    const provider = createTestKeyProvider();
    const key = provider.getActiveKey();

    expect(key.encryptionKey.length).toBe(32);
    expect(key.hmacKey.length).toBe(32);
  });

  test("returns the same key material across calls — deterministic, not random per test", () => {
    const a = createTestKeyProvider().getActiveKey();
    const b = createTestKeyProvider().getActiveKey();

    expect(a.encryptionKey.equals(b.encryptionKey)).toBe(true);
    expect(a.keyId).toBe(b.keyId);
  });

  test("wraps testKeyBundle exactly — the raw bundle is available for tests that compose their own provider", () => {
    const provider = createTestKeyProvider();
    expect(provider.getActiveKey()).toEqual(testKeyBundle);
  });
});

describe("createTestServer", () => {
  let server: ReturnType<typeof createTestServer> | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  test("serves real requests through the actual router on an ephemeral port", async () => {
    const routes = defineRoutes((r) => r.get("/ping", async () => new Response("pong")));
    server = createTestServer(routes);

    const res = await server.fetch("/ping");
    expect(await res.text()).toBe("pong");
  });

  test("close() actually stops the server", async () => {
    const routes = defineRoutes((r) => r.get("/ping", async () => new Response("pong")));
    server = createTestServer(routes);
    const url = server.url;
    server.close();
    server = undefined;

    expect(fetch(`${url}/ping`)).rejects.toThrow();
  });
});
