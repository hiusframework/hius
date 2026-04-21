// Lightweight metadata store backed by WeakMap.
// Avoids reflect-metadata and global state pollution.

const store = new WeakMap<object, Record<string, unknown>>();

export function defineMetadata(key: string, value: unknown, target: object): void {
  const existing = store.get(target) ?? {};
  store.set(target, { ...existing, [key]: value });
}

export function getMetadata<T>(key: string, target: object): T | undefined {
  return store.get(target)?.[key] as T | undefined;
}

export function hasMetadata(key: string, target: object): boolean {
  return key in (store.get(target) ?? {});
}
