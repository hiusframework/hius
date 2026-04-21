import { and as drizzleAnd, eq as drizzleEq, or as drizzleOr, getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/infra/db/client.ts";
import type { RewrittenCondition } from "@/infra/encryption/query/ast.ts";

// biome-ignore lint/suspicious/noExplicitAny: Drizzle generics require any for table/column/where types
type AnyPgTable = PgTable<any>;
// biome-ignore lint/suspicious/noExplicitAny: Drizzle column type is opaque at this abstraction level
type AnyColumn = any;
// biome-ignore lint/suspicious/noExplicitAny: Drizzle SQL expression type is not exported
type DrizzleWhere = any;

// Converts a RewrittenCondition tree into a Drizzle SQL expression.
// Columns are looked up by name from the table's column map.
function buildWhere(
  condition: RewrittenCondition,
  columns: Record<string, AnyColumn>,
): DrizzleWhere {
  switch (condition.type) {
    case "eq": {
      const col = columns[condition.column];
      if (!col) {
        throw new Error(`[Hius/DrizzleAdapter] Unknown column: "${condition.column}"`);
      }
      return drizzleEq(col, condition.value);
    }
    case "and":
      return drizzleAnd(...condition.conditions.map((c) => buildWhere(c, columns)));
    case "or":
      return drizzleOr(...condition.conditions.map((c) => buildWhere(c, columns)));
  }
}

export class DrizzleAdapter {
  constructor(private readonly db: Db) {}

  async findOne(
    table: AnyPgTable,
    condition: RewrittenCondition,
  ): Promise<Record<string, unknown> | null> {
    const columns = getTableColumns(table);
    const where = buildWhere(condition, columns);
    const rows = await this.db.select().from(table).where(where).limit(1);
    return rows[0] ?? null;
  }

  async findMany(
    table: AnyPgTable,
    condition: RewrittenCondition,
  ): Promise<Record<string, unknown>[]> {
    const columns = getTableColumns(table);
    const where = buildWhere(condition, columns);
    return this.db.select().from(table).where(where);
  }
}
