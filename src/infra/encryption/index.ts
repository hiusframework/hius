// Public API for the Hius encryption layer

export { DrizzleAdapter } from "@/infra/encryption/adapters/drizzle.adapter.ts";
export type { BlindIndex } from "@/infra/encryption/core/blind-index.ts";
export { createBlindIndex } from "@/infra/encryption/core/blind-index.ts";
export type { CryptoEngine } from "@/infra/encryption/core/crypto.ts";
export { createCryptoEngine } from "@/infra/encryption/core/crypto.ts";
export type { KeyBundle, KeyProvider } from "@/infra/encryption/core/key-provider.ts";
export {
  createEnvKeyProvider,
  createStaticKeyProvider,
} from "@/infra/encryption/core/key-provider.ts";
export { backfillRows } from "@/infra/encryption/migration/migration.ts";
export type { Query, RewrittenCondition } from "@/infra/encryption/query/ast.ts";
export { and, eq, or } from "@/infra/encryption/query/ast.ts";
export { rewriteQuery } from "@/infra/encryption/query/rewrite.ts";
export type {
  FieldConfig,
  FieldRegistry,
  ModelConfig,
} from "@/infra/encryption/registry/field-registry.ts";
export { createFieldRegistry } from "@/infra/encryption/registry/field-registry.ts";
