import type { BlindIndex } from "../encryption/blind-index";
import type { FieldRegistry } from "../encryption/field-registry";
import type { Query, RewrittenCondition } from "./ast";

// Rewrites a logical query into a physical DB query.
// Rules:
//   eq(encryptedSearchable)  → eq(hashField, blindIndex) or, across a key
//                              rotation, or(eq(hashField, hash1), eq(hashField, hash2), ...)
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

      const hashField = fieldCfg.hashField;
      const candidates = blindIndex.computeAllCandidates(String(query.value));

      // Single active key (the common case, no rotation in flight): a
      // plain eq, byte-for-byte what this produced before candidates
      // existed. With retired keys still accepted, search every hash a
      // matching row could have been written under.
      if (candidates.length === 1) {
        return { type: "eq", column: hashField, value: candidates[0] };
      }
      return {
        type: "or",
        conditions: candidates.map((hash) => ({ type: "eq", column: hashField, value: hash })),
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
