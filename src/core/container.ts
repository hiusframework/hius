import type { Token } from "./types.ts";

interface ProviderEntry<T> {
  factory: () => T;
  instance: T | null; // null = not yet instantiated
}

function tokenName(token: Token): string {
  if (typeof token === "function") return token.name;
  if (typeof token === "symbol") return token.toString();
  return String(token);
}

/**
 * IoC container. Holds provider registrations and resolves singletons.
 * All providers are singleton-scoped: resolved once, then cached.
 */
export class Container {
  private readonly entries = new Map<Token, ProviderEntry<unknown>>();

  /** Register a factory for the given token. */
  register<T>(token: Token<T>, factory: () => T): void {
    this.entries.set(token, { factory, instance: null });
  }

  /** Resolve a token to its singleton instance, instantiating on first call. */
  resolve<T>(token: Token<T>): T {
    const entry = this.entries.get(token) as ProviderEntry<T> | undefined;
    if (!entry) {
      throw new Error(`[Hius] No provider registered for: ${tokenName(token)}`);
    }
    if (entry.instance === null) {
      entry.instance = entry.factory();
    }
    return entry.instance;
  }

  has(token: Token): boolean {
    return this.entries.has(token);
  }
}
