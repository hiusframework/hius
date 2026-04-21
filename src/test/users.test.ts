import { describe, expect, test } from "bun:test";
import { UsersService } from "@/app/users.service.ts";
import type { User } from "@/domain/users/user.entity.ts";
import type { UserRepository } from "@/domain/users/user.repository.ts";

function makeInMemoryRepo(): UserRepository {
  const store: User[] = [];
  return {
    async create(user: User) {
      store.push(user);
    },
    async findById(id: string) {
      return store.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email: string) {
      return store.find((u) => u.email === email) ?? null;
    },
  };
}

describe("UsersService", () => {
  test("createUser + findByEmail returns correct email", async () => {
    const repo = makeInMemoryRepo();
    const service = new UsersService(repo);

    const created = await service.createUser({ email: "bob@example.com", name: "Bob" });
    expect(created.id).toBeTruthy();

    const found = await service.getByEmail("bob@example.com");
    expect(found).not.toBeNull();
    expect(found!.email).toBe("bob@example.com");
    expect(found!.name).toBe("Bob");
  });

  test("getByEmail returns null for unknown email", async () => {
    const service = new UsersService(makeInMemoryRepo());
    expect(await service.getByEmail("ghost@x.com")).toBeNull();
  });

  test("getById returns created user", async () => {
    const repo = makeInMemoryRepo();
    const service = new UsersService(repo);
    const created = await service.createUser({ email: "id@test.com" });
    const found = await service.getById(created.id);
    expect(found?.id).toBe(created.id);
  });
});
