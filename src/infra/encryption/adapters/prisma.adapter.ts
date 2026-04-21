import type { RewrittenCondition } from "@/infra/encryption/query/ast.ts";

// Interface-only stub. Implement when Prisma is added as an ORM adapter.
//
// Implementation notes:
//   - Convert RewrittenCondition to Prisma `where` object
//   - eq → { [column]: value }
//   - and → { AND: [...] }
//   - or  → { OR: [...] }

export interface PrismaAdapterOptions {
  // The Prisma client instance (typed as unknown to avoid a Prisma dependency)
  client: unknown;
}

export interface PrismaAdapter {
  findOne(model: string, condition: RewrittenCondition): Promise<Record<string, unknown> | null>;

  findMany(model: string, condition: RewrittenCondition): Promise<Record<string, unknown>[]>;
}

// Not implemented — placeholder for future Prisma support.
export function createPrismaAdapter(_options: PrismaAdapterOptions): PrismaAdapter {
  throw new Error("[Hius/PrismaAdapter] Not implemented");
}
