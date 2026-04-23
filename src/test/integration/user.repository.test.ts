import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DrizzleUserRepository } from "@/infra/db/repositories/user.repository.ts";
import { makeTestDependencies, type TestDeps } from "./helpers.ts";

const hasDb = !!process.env.DATABASE_URL;

describe.if(hasDb)("DrizzleUserRepository (integration)", () => {
  let deps: TestDeps;
  let repo: DrizzleUserRepository;

  beforeEach(() => {
    deps = makeTestDependencies();
    repo = deps.repo;
  });

  afterEach(async () => {
    await deps.teardown();
  });

  test("create and findByEmail round-trips email through encryption", async () => {
    await repo.create({ id: "00000000-0000-0000-0000-000000000001", email: "alice@example.com" });

    const found = await repo.findByEmail("alice@example.com");

    expect(found).not.toBeNull();
    expect(found!.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(found!.email).toBe("alice@example.com");
  });

  test("create and findById returns the user", async () => {
    const id = "00000000-0000-0000-0000-000000000002";
    await repo.create({ id, email: "bob@example.com", name: "Bob" });

    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.email).toBe("bob@example.com");
    expect(found!.name).toBe("Bob");
  });

  test("findByEmail returns null for unknown email", async () => {
    expect(await repo.findByEmail("ghost@example.com")).toBeNull();
  });

  test("findById returns null for unknown id", async () => {
    expect(await repo.findById("00000000-0000-0000-0000-000000000099")).toBeNull();
  });

  test("email lookup is case-insensitive via blind index normalization", async () => {
    await repo.create({ id: "00000000-0000-0000-0000-000000000003", email: "carol@example.com" });

    const found = await repo.findByEmail("CAROL@EXAMPLE.COM");

    expect(found).not.toBeNull();
    expect(found!.email).toBe("carol@example.com");
  });

  test("soft-deleted user is not returned by findById or findByEmail", async () => {
    const id = "00000000-0000-0000-0000-000000000004";
    await repo.create({ id, email: "deleted@example.com" });
    await deps.softDelete(id);

    expect(await repo.findById(id)).toBeNull();
    expect(await repo.findByEmail("deleted@example.com")).toBeNull();
  });
});
