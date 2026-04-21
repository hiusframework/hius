import { eq } from "drizzle-orm";
import type { User } from "@/domain/users/user.entity.ts";
import type { UserRepository } from "@/domain/users/user.repository.ts";
import type { Db } from "@/infra/db/client.ts";
import { users } from "@/infra/db/schema/users.ts";
import type { BlindIndex } from "@/infra/encryption/core/blind-index.ts";
import type { CryptoEngine } from "@/infra/encryption/core/crypto.ts";

export class DrizzleUserRepository implements UserRepository {
  constructor(
    private readonly db: Db,
    private readonly crypto: CryptoEngine,
    private readonly blindIndex: BlindIndex,
  ) {}

  async create(user: User): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email_encrypted: this.crypto.encrypt(user.email),
      email_hash: this.blindIndex.compute(user.email),
      name: user.name,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const hash = this.blindIndex.compute(email);
    const rows = await this.db.select().from(users).where(eq(users.email_hash, hash)).limit(1);

    const row = rows[0];
    if (!row || row.deleted_at !== null) return null;

    return {
      id: row.id,
      email: this.crypto.decrypt(row.email_encrypted),
      name: row.name ?? undefined,
    };
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    const row = rows[0];
    if (!row || row.deleted_at !== null) return null;

    return {
      id: row.id,
      email: this.crypto.decrypt(row.email_encrypted),
      name: row.name ?? undefined,
    };
  }
}
