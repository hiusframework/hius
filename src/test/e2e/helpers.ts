// E2e test helper — wires the full stack into a Router.
// Returns only what tests need: handle requests and clean up.

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { UsersController } from "@/app/users.controller.ts";
import { UsersService } from "@/app/users.service.ts";
import { Container } from "@/core/container.ts";
import { Router } from "@/http/router.ts";
import { defineRoutes } from "@/http/routing/builder.ts";
import { DrizzleUserRepository } from "@/infra/db/repositories/user.repository.ts";
import * as schema from "@/infra/db/schema/users.ts";
import { users } from "@/infra/db/schema/users.ts";
import { createBlindIndex } from "@/infra/encryption/core/blind-index.ts";
import { createCryptoEngine } from "@/infra/encryption/core/crypto.ts";
import { createStaticKeyProvider } from "@/infra/encryption/core/key-provider.ts";

// Fixed 32-byte keys for tests — never use in production.
const TEST_KEY_BUNDLE = {
  keyId: "test-key-1",
  encryptionKey: Buffer.alloc(32, 0x01),
  hmacKey: Buffer.alloc(32, 0x02),
};

export function makeE2eApp() {
  const sql = new SQL(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql, schema });

  const provider = createStaticKeyProvider(TEST_KEY_BUNDLE);
  const crypto = createCryptoEngine(provider);
  const blindIndex = createBlindIndex(provider);
  const repo = new DrizzleUserRepository(db, crypto, blindIndex);
  const service = new UsersService(repo);

  const container = new Container();
  container.register(UsersController, () => new UsersController(service));

  const routes = defineRoutes((r) => {
    r.post("/users", UsersController, "create");
    r.get("/users/:id", UsersController, "show");
  });

  const router = new Router(routes, container);

  async function teardown() {
    await db.delete(users);
    await sql.close();
  }

  return { router, teardown };
}
