import type { Constructor, ModuleMetadata } from "@/core/types.ts";
import { defineMetadata } from "@/utils/metadata.ts";

export const MODULE_KEY = "hius:module";
export const INJECTABLE_KEY = "hius:injectable";

/**
 * Marks a class as a Hius module.
 *
 * @example
 * @Module({ name: "users", providers: [UserService] })
 * class UsersModule {}
 */
export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target) => {
    defineMetadata(MODULE_KEY, metadata, target);
  };
}

/**
 * Marks a class as injectable and declares its constructor dependencies.
 * Dependencies must be listed in the same order as constructor parameters.
 *
 * @example
 * @Injectable([UserRepository])
 * class UserService {
 *   constructor(private repo: UserRepository) {}
 * }
 */
export function Injectable(deps: Constructor[] = []): ClassDecorator {
  return (target) => {
    defineMetadata(INJECTABLE_KEY, { deps }, target);
  };
}
