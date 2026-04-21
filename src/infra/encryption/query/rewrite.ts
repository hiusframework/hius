import type { BlindIndex } from "@/infra/encryption/core/blind-index.ts";
import type { Query, RewrittenCondition } from "@/infra/encryption/query/ast.ts";
import type { FieldRegistry } from "@/infra/encryption/registry/field-registry.ts";

// Rewrites a logical query into a physical DB query.
// Rules:
//   eq(encryptedSearchable)  → eq(hashField, blindIndex(value))
//   eq(encryptedUnsearchable)→ ERROR (can't search without blind index)
//   eq(plainField)           → eq(field, value) unchanged
//   and/or                   → recurse
export function rewriteQuery(
  query: Query,
  model: string,
  registry: FieldRegistry,
  blindIndex: BlindIndex,
): RewrittenCondition {
  switch (query.type) {
    case "eq": {
      const fieldCfg = registry.getField(model, query.field);

      // Plain (non-encrypted) field — pass through unchanged
      if (!fieldCfg) {
        return { type: "eq", column: query.field, value: query.value };
      }

      // Encrypted but not searchable — searching would require full table scan + decrypt
      if (!fieldCfg.searchable || !fieldCfg.hashField) {
        throw new Error(
          `[Hius/Rewrite] Field "${query.field}" on model "${model}" is encrypted but not searchable. ` +
            `Add searchable: true and hashField to enable equality search.`,
        );
      }

      // Encrypted + searchable → rewrite to blind index lookup
      return {
        type: "eq",
        column: fieldCfg.hashField,
        value: blindIndex.compute(String(query.value)),
      };
    }

    case "and":
      return {
        type: "and",
        conditions: query.conditions.map((c) => rewriteQuery(c, model, registry, blindIndex)),
      };

    case "or":
      return {
        type: "or",
        conditions: query.conditions.map((c) => rewriteQuery(c, model, registry, blindIndex)),
      };
  }
}
