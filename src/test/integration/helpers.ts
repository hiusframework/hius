// Shared setup for integration tests that require a real PostgreSQL database.
// DATABASE_URL must be set in .env.test — Bun loads it automatically on `bun test`.

import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { DrizzleUserRepository } from "@/infra/db/repositories/user.repository.ts";
import * as schema from "@/infra/db/schema/users.ts";
import { users } from "@/infra/db/schema/users.ts";
import { createBlindIndex } from "@/infra/encryption/core/blind-index.ts";
import { createCryptoEngine } from "@/infra/encryption/core/crypto.ts";
import { createStaticKeyProvider } from "@/infra/encryption/core/key-provider.ts";

// Fixed 32-byte keys for integration tests — never use in production.
const TEST_KEY_BUNDLE = {
  keyId: "test-key-1",
  encryptionKey: Buffer.alloc(32, 0x01),
  hmacKey: Buffer.alloc(32, 0x02),
};

export type TestDeps = ReturnType<typeof makeTestDependencies>;

export function makeTestDependencies() {
  const sql = new SQL(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql, schema });
  const provider = createStaticKeyProvider(TEST_KEY_BUNDLE);
  const crypto = createCryptoEngine(provider);
  const blindIndex = createBlindIndex(provider);
  const repo = new DrizzleUserRepository(db, crypto, blindIndex);

  async function softDelete(id: string) {
    await db.update(users).set({ deleted_at: new Date() }).where(eq(users.id, id));
  }

  async function teardown() {
    await db.delete(users);
    await sql.close();
  }

  return { db, repo, softDelete, teardown };
}
