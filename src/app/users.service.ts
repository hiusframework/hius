import { randomUUID } from "node:crypto";
import { ConflictError } from "@/domain/errors.ts";
import type { User } from "@/domain/users/user.entity.ts";
import type { UserRepository } from "@/domain/users/user.repository.ts";

export type CreateUserInput = {
  email: string;
  name?: string;
};

export class UsersService {
  constructor(private readonly repo: UserRepository) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new ConflictError("email already taken");

    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
    };
    await this.repo.create(user);
    return user;
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async getById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }
}
