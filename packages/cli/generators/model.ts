import { join } from "node:path";
import { toKebabCase, toPascalCase } from "./naming";
import type { WriteResult } from "./write-file";
import { writeGeneratedFile } from "./write-file";

// Deliberately small — the practical common cases, not every Drizzle
// column type. Anything else, write the column by hand; this generator
// is a starting point, not a schema DSL of its own.
const COLUMN_BUILDERS: Record<string, (fieldName: string) => string> = {
  string: (f) => `text("${f}")`,
  text: (f) => `text("${f}")`,
  number: (f) => `integer("${f}")`,
  int: (f) => `integer("${f}")`,
  boolean: (f) => `boolean("${f}")`,
  timestamp: (f) => `timestamp("${f}", { withTimezone: true })`,
  uuid: (f) => `uuid("${f}")`,
  decimal: (f) => `numeric("${f}")`,
  money: (f) => `numeric("${f}")`,
  // belongs_to:orders -> an "order_id" FK column (uuid). The relation
  // itself (references()) is left for the developer to wire — knowing
  // the target table's exact export name isn't something this generator
  // can infer reliably from a string.
  belongs_to: (f) => `uuid("${f}_id")`,
};

export type FieldSpec = { name: string; type: string };

export class UnsupportedFieldTypeError extends Error {
  constructor(type: string) {
    super(
      `Unsupported field type "${type}". Supported: ${Object.keys(COLUMN_BUILDERS).join(", ")}. ` +
        "Add the column by hand for anything else.",
    );
    this.name = "UnsupportedFieldTypeError";
  }
}

/** Parses "amount:money status:string customer:belongs_to" into FieldSpecs. */
export function parseFieldSpecs(args: string[]): FieldSpec[] {
  return args.map((arg) => {
    const [name, type] = arg.split(":");
    if (!name || !type) {
      throw new Error(`Invalid field spec "${arg}" — expected "name:type"`);
    }
    return { name, type };
  });
}

function schemaTemplate(domain: string, modelName: string, fields: FieldSpec[]): string {
  const tableName = `${toKebabCase(domain)}_${toKebabCase(modelName)}s`.replace(/-/g, "_");
  const varName = `${toKebabCase(modelName)}s`.replace(/-/g, "_");

  const columnLines = fields.map(({ name, type }) => {
    const builder = COLUMN_BUILDERS[type];
    if (!builder) throw new UnsupportedFieldTypeError(type);
    return `  ${name}: ${builder(name)},`;
  });

  return `import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ${varName} = pgTable("${tableName}", {
  id: uuid("id").primaryKey().defaultRandom(),
${columnLines.join("\n")}
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export type ${toPascalCase(modelName)} = typeof ${varName}.$inferSelect;
export type New${toPascalCase(modelName)} = typeof ${varName}.$inferInsert;
`;
}

function schemaTestTemplate(modelName: string): string {
  const varName = `${toKebabCase(modelName)}s`.replace(/-/g, "_");
  const file = toKebabCase(modelName);
  return `import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { ${varName} } from "../${file}";

describe("${varName} schema", () => {
  test("has the standard id/timestamps columns", () => {
    const columns = Object.keys(getTableColumns(${varName}));
    expect(columns).toContain("id");
    expect(columns).toContain("created_at");
    expect(columns).toContain("updated_at");
    expect(columns).toContain("deleted_at");
  });
});
`;
}

/**
 * Generates a Drizzle schema file (the "entity" half of Active Record-
 * style ergonomics) from field:type pairs. Migration and repository
 * generation aren't part of this — the migration workflow isn't built
 * yet, and a repository needs domain-specific decisions (which fields
 * are encrypted, what the public shape looks like) this generator can't
 * infer from a schema alone.
 */
export async function generateModel(
  appsDir: string,
  domain: string,
  modelName: string,
  fieldArgs: string[],
  force = false,
): Promise<WriteResult[]> {
  const fields = parseFieldSpecs(fieldArgs);
  const domainDir = join(appsDir, toKebabCase(domain));
  const file = toKebabCase(modelName);
  const modelsDir = join(domainDir, "models");

  return Promise.all([
    writeGeneratedFile(
      join(modelsDir, `${file}.ts`),
      schemaTemplate(domain, modelName, fields),
      force,
    ),
    writeGeneratedFile(
      join(modelsDir, "test", `${file}.test.ts`),
      schemaTestTemplate(modelName),
      force,
    ),
  ]);
}
