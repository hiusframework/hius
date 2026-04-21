import type { User } from "@/domain/users/user.entity.ts";

// Port (interface) — domain owns this contract, infra implements it.
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
}
