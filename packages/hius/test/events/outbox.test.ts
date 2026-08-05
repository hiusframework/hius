import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { createEventBus } from "@/events/bus";
import { relayOutboxEvents, writeOutboxEvent } from "@/events/outbox";
import { outboxEvents } from "@/events/schema";

const hasDb = !!process.env.DATABASE_URL;

describe.if(hasDb)("outbox (integration)", () => {
  const sql = new SQL(process.env.DATABASE_URL ?? "");
  const db = drizzle({ client: sql });

  beforeAll(async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS hius_outbox_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        dispatched_at TIMESTAMPTZ
      )
    `;
  });

  afterEach(async () => {
    await db.delete(outboxEvents);
  });

  afterAll(async () => {
    await sql.close();
  });

  test("a written event is dispatched to a matching handler and marked dispatched", async () => {
    const bus = createEventBus();
    const received: unknown[] = [];
    bus.on("user.created", (payload) => {
      received.push(payload);
    });

    await writeOutboxEvent(db, "user.created", { email: "alice@example.com" });
    const result = await relayOutboxEvents(db, bus);

    expect(result).toEqual({ dispatched: 1, failed: 0 });
    expect(received).toEqual([{ email: "alice@example.com" }]);

    const [row] = await db.select().from(outboxEvents);
    expect(row?.dispatchedAt).not.toBeNull();
  });

  test("an event with no matching handler still dispatches cleanly (emit on no listeners is a no-op)", async () => {
    const bus = createEventBus();

    await writeOutboxEvent(db, "nobody.listening", { x: 1 });
    const result = await relayOutboxEvents(db, bus);

    expect(result).toEqual({ dispatched: 1, failed: 0 });
  });

  test("a failing handler leaves its row undispatched, and it's retried on the next call", async () => {
    // relayOutboxEvents logs a failed row via console.error (deliberately —
    // that's the production behavior an operator needs to see). Spy on it
    // here rather than let a deliberately-triggered failure print a stack
    // trace that reads like a real test failure.
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    let attempts = 0;
    const bus = createEventBus();
    bus.on("flaky", () => {
      attempts++;
      if (attempts === 1) throw new Error("transient failure");
    });

    await writeOutboxEvent(db, "flaky", { n: 1 });

    const first = await relayOutboxEvents(db, bus);
    expect(first).toEqual({ dispatched: 0, failed: 1 });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('event "flaky"');

    const second = await relayOutboxEvents(db, bus);
    expect(second).toEqual({ dispatched: 1, failed: 0 });
    expect(attempts).toBe(2);

    errorSpy.mockRestore();
  });

  test("one failing row doesn't block the rest of the batch", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    const bus = createEventBus();
    const succeeded: string[] = [];
    bus.on("mixed", (payload) => {
      const { id } = payload as { id: string };
      if (id === "bad") throw new Error("nope");
      succeeded.push(id);
    });

    await writeOutboxEvent(db, "mixed", { id: "good-1" });
    await writeOutboxEvent(db, "mixed", { id: "bad" });
    await writeOutboxEvent(db, "mixed", { id: "good-2" });

    const result = await relayOutboxEvents(db, bus);

    expect(result).toEqual({ dispatched: 2, failed: 1 });
    expect(succeeded.sort()).toEqual(["good-1", "good-2"]);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  test("dispatches oldest-first", async () => {
    const bus = createEventBus();
    const order: string[] = [];
    bus.on("ordered", (payload) => {
      order.push((payload as { id: string }).id);
    });

    await writeOutboxEvent(db, "ordered", { id: "first" });
    await writeOutboxEvent(db, "ordered", { id: "second" });
    await writeOutboxEvent(db, "ordered", { id: "third" });

    await relayOutboxEvents(db, bus);

    expect(order).toEqual(["first", "second", "third"]);
  });

  test("batchSize limits how many rows one relay call processes", async () => {
    const bus = createEventBus();
    let count = 0;
    bus.on("batchable", () => {
      count++;
    });

    await writeOutboxEvent(db, "batchable", { n: 1 });
    await writeOutboxEvent(db, "batchable", { n: 2 });
    await writeOutboxEvent(db, "batchable", { n: 3 });

    const result = await relayOutboxEvents(db, bus, { batchSize: 2 });

    expect(result).toEqual({ dispatched: 2, failed: 0 });
    expect(count).toBe(2);
  });

  test("an already-dispatched row is not redelivered on a later relay call", async () => {
    const bus = createEventBus();
    let count = 0;
    bus.on("once", () => {
      count++;
    });

    await writeOutboxEvent(db, "once", {});
    await relayOutboxEvents(db, bus);
    await relayOutboxEvents(db, bus);

    expect(count).toBe(1);
  });
});
