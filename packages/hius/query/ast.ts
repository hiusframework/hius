// Minimal query AST — only what's needed for encrypted field search.
// Intentionally small: do not add LIKE, GT, LT etc. without a clear need.

export type Query =
  | { type: "eq"; field: string; value: unknown }
  | { type: "and"; conditions: Query[] }
  | { type: "or"; conditions: Query[] };

// After rewrite, conditions reference physical DB columns (not logical fields)
export type RewrittenCondition =
  | { type: "eq"; column: string; value: unknown }
  | { type: "and"; conditions: RewrittenCondition[] }
  | { type: "or"; conditions: RewrittenCondition[] };

// Builder helpers — use these instead of constructing objects directly
export const eq = (field: string, value: unknown): Query => ({ type: "eq", field, value });
export const and = (...conditions: Query[]): Query => ({ type: "and", conditions });
export const or = (...conditions: Query[]): Query => ({ type: "or", conditions });
