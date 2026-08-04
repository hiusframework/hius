import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Test fixture only — a worked example proving the repository pattern
// (DrizzleAdapter + encryption + Query AST + conflict mapping) end to
// end against a real Postgres database, not a permanent schema shipped
// by the framework. No `email_det`-style speculative column: nothing
// reads or writes deterministic encryption here, so nothing declares it.
export const testUsers = pgTable("hius_test_users", {
  id: uuid("id").primaryKey(),
  email_encrypted: text("email_encrypted").notNull(),
  email_hash: text("email_hash").notNull().unique(),
  name: text("name"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});
