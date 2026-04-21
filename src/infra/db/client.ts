import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "@/infra/db/schema/users.ts";

// Single connection pool shared across the application.
// DATABASE_URL must be set before importing this module.
export const sql = new SQL(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });

export type Db = typeof db;
