import type { Container } from "@/core/container.ts";
import { INJECTABLE_KEY } from "@/core/decorators.ts";
import type { Constructor, InjectableMetadata } from "@/core/types.ts";
import { getMetadata } from "@/utils/metadata.ts";

/**
 * Register a class and its full dependency tree into the container.
 * Walks the dep list recursively so providers can be declared in any order.
 */
export function registerProvider(container: Container, cls: Constructor): void {
  // Skip if already registered (handles shared deps across modules)
  if (container.has(cls)) return;

  const meta = getMetadata<InjectableMetadata>(INJECTABLE_KEY, cls);
  if (!meta) {
    throw new Error(
      `[Hius] ${cls.name} must be decorated with @Injectable() to be used as a provider`,
    );
  }

  // Register dependencies before the class that needs them
  for (const dep of meta.deps) {
    registerProvider(container, dep);
  }

  container.register(cls, () => {
    const args = meta.deps.map((dep) => container.resolve(dep));
    return new cls(...args);
  });
}
