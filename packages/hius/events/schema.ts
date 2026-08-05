import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Durable record of every event a domain has published — the
// transactional guarantee events need: write a row here in the SAME
// database transaction as the business change that caused it, so a
// crash between "save the change" and "notify subscribers" can never
// lose the event. A relay reads undispatched rows and hands each to the
// in-process EventBus (bus.ts) — this table is the durability mechanism,
// the bus is the dispatch mechanism, they're deliberately separate.
export const outboxEvents = pgTable("hius_outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
});
