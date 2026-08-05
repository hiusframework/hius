import { asc, eq, isNull } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type { EventBus } from "./bus";
import { outboxEvents } from "./schema";

// biome-ignore lint/suspicious/noExplicitAny: schema-agnostic — works against any BunSQLDatabase, transaction or not
type AnyDb = BunSQLDatabase<any>;

/**
 * Records an event durably. Call this with a transaction handle
 * (`db.transaction(tx => ...)`, passing `tx`) so the write lands in the
 * same transaction as the business change it describes — that's what
 * makes the delivery guarantee real, not the table by itself.
 */
export async function writeOutboxEvent(db: AnyDb, event: string, payload: unknown): Promise<void> {
  await db.insert(outboxEvents).values({ event, payload });
}

export type RelayResult = {
  dispatched: number;
  failed: number;
};

/**
 * Reads undispatched outbox rows oldest-first and hands each to the
 * EventBus, marking a row dispatched only once every handler for its
 * event has succeeded. A row whose handlers throw is left undispatched
 * and retried on the next call, alongside whichever rows in the same
 * batch succeeded — one failure doesn't block the rest of the batch.
 *
 * This is at-least-once delivery: a crash between emit() succeeding and
 * the UPDATE committing re-delivers that row next time. Handlers must be
 * idempotent — a contract requirement (Interaction Model), not something
 * the relay itself can enforce.
 */
export async function relayOutboxEvents(
  db: AnyDb,
  bus: EventBus,
  opts: { batchSize?: number } = {},
): Promise<RelayResult> {
  const batchSize = opts.batchSize ?? 100;

  const rows = await db
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.dispatchedAt))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(batchSize);

  let dispatched = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await bus.emit(row.event, row.payload);
      await db
        .update(outboxEvents)
        .set({ dispatchedAt: new Date() })
        .where(eq(outboxEvents.id, row.id));
      dispatched++;
    } catch (err) {
      failed++;
      console.error(
        `[Hius] outbox relay: event "${row.event}" (id ${row.id}) failed, will retry`,
        err,
      );
    }
  }

  return { dispatched, failed };
}
