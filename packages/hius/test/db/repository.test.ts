import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ConflictError } from "@/errors";
import { makeTestDependencies, type TestRepo } from "./helpers";

const hasDb = !!process.env.DATABASE_URL;

// Every test uses a distinct fixed UUID/email, so they don't collide with
// each other — no per-test cleanup needed, just a full teardown at the end.
describe.if(hasDb)("repository pattern (integration)", () => {
  let repo: TestRepo;

  beforeAll(async () => {
    repo = makeTestDependencies();
    await repo.setup();
  });

  afterAll(async () => {
    await repo.teardown();
  });

  test("create and findByEmail round-trips email through encryption", async () => {
    await repo.create({ id: "10000000-0000-0000-0000-000000000001", email: "alice@example.com" });

    const found = await repo.findByEmail("alice@example.com");

    expect(found?.id).toBe("10000000-0000-0000-0000-000000000001");
    expect(found?.email).toBe("alice@example.com");
  });

  test("create and findById returns the user", async () => {
    const id = "10000000-0000-0000-0000-000000000002";
    await repo.create({ id, email: "bob@example.com", name: "Bob" });

    const found = await repo.findById(id);

    expect(found?.id).toBe(id);
    expect(found?.email).toBe("bob@example.com");
    expect(found?.name).toBe("Bob");
  });

  test("findByEmail returns null for unknown email", async () => {
    expect(await repo.findByEmail("ghost@example.com")).toBeNull();
  });

  test("findById returns null for unknown id", async () => {
    expect(await repo.findById("10000000-0000-0000-0000-000000000099")).toBeNull();
  });

  test("email lookup is case-insensitive via blind index normalization", async () => {
    await repo.create({ id: "10000000-0000-0000-0000-000000000003", email: "carol@example.com" });

    const found = await repo.findByEmail("CAROL@EXAMPLE.COM");

    expect(found?.email).toBe("carol@example.com");
  });

  test("soft-deleted user is not returned by findById or findByEmail", async () => {
    const id = "10000000-0000-0000-0000-000000000004";
    await repo.create({ id, email: "deleted@example.com" });
    await repo.softDelete(id);

    expect(await repo.findById(id)).toBeNull();
    expect(await repo.findByEmail("deleted@example.com")).toBeNull();
  });

  test("a duplicate email on create throws ConflictError, not a raw driver error", async () => {
    await repo.create({ id: "10000000-0000-0000-0000-000000000005", email: "dup@example.com" });

    expect(
      repo.create({ id: "10000000-0000-0000-0000-000000000006", email: "dup@example.com" }),
    ).rejects.toThrow(ConflictError);
  });

  test(
    "the TOCTOU race: two concurrent creates with the same email — one succeeds, " +
      "the other gets ConflictError, never a raw Postgres error",
    async () => {
      const email = "race@example.com";
      const results = await Promise.allSettled([
        repo.create({ id: "10000000-0000-0000-0000-000000000007", email }),
        repo.create({ id: "10000000-0000-0000-0000-000000000008", email }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);

      // Exactly one row actually landed — the constraint, not just the
      // error mapping, is what makes this safe under real concurrency.
      const found = await repo.findByEmail(email);
      expect(found).not.toBeNull();
    },
  );
});
