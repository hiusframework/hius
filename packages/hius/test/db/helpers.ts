import { SQL } from "bun";
import { eq as drizzleEq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import {
  createBlindIndex,
  createCryptoEngine,
  createFieldRegistry,
  createStaticKeyProvider,
  DrizzleAdapter,
  eq,
  rewriteQuery,
  withUniqueConstraintMapping,
} from "@/index";
import { testUsers } from "./schema";

// Fixed 32-byte keys for integration tests — never use in production.
const TEST_KEY_BUNDLE = {
  keyId: "test-key-1",
  encryptionKey: Buffer.alloc(32, 0x01),
  hmacKey: Buffer.alloc(32, 0x02),
};

export type TestUser = { id: string; email: string; name?: string };

// Worked example wiring together DrizzleAdapter + encryption + Query AST
// + withUniqueConstraintMapping — the pieces a real domain repository
// composes explicitly (no DI container, no base class to extend).
export function makeTestDependencies() {
  const sql = new SQL(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });
  const provider = createStaticKeyProvider(TEST_KEY_BUNDLE);
  const crypto = createCryptoEngine(provider);
  const blindIndex = createBlindIndex(provider);
  const registry = createFieldRegistry();
  registry.register("users", {
    email: { encrypted: true, searchable: true, field: "email_encrypted", hashField: "email_hash" },
  });
  const adapter = new DrizzleAdapter(db);

  function toDomain(row: Record<string, unknown>): TestUser {
    return {
      id: row.id as string,
      email: crypto.decrypt(row.email_encrypted as string),
      name: (row.name as string | null) ?? undefined,
    };
  }

  async function create(user: TestUser): Promise<void> {
    await withUniqueConstraintMapping(() =>
      db.insert(testUsers).values({
        id: user.id,
        email_encrypted: crypto.encrypt(user.email),
        email_hash: blindIndex.compute(user.email),
        name: user.name,
      }),
    );
  }

  async function findByEmail(email: string): Promise<TestUser | null> {
    const condition = rewriteQuery(eq("email", email), "users", registry, blindIndex);
    const row = await adapter.findOne(testUsers, condition);
    if (!row || row.deleted_at !== null) return null;
    return toDomain(row);
  }

  async function findById(id: string): Promise<TestUser | null> {
    const rows = await db.select().from(testUsers).where(drizzleEq(testUsers.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.deleted_at !== null) return null;
    return toDomain(row);
  }

  async function softDelete(id: string): Promise<void> {
    await db.update(testUsers).set({ deleted_at: new Date() }).where(drizzleEq(testUsers.id, id));
  }

  async function setup(): Promise<void> {
    await sql`
      CREATE TABLE IF NOT EXISTS hius_test_users (
        id UUID PRIMARY KEY,
        email_encrypted TEXT NOT NULL,
        email_hash TEXT NOT NULL UNIQUE,
        name TEXT,
        deleted_at TIMESTAMPTZ
      )
    `;
  }

  async function teardown(): Promise<void> {
    await db.delete(testUsers);
    await sql.close();
  }

  return { create, findByEmail, findById, softDelete, setup, teardown };
}

export type TestRepo = ReturnType<typeof makeTestDependencies>;
