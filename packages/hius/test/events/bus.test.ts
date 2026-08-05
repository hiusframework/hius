import { describe, expect, test } from "bun:test";
import { createEventBus } from "@/events/bus";

describe("EventBus", () => {
  test("emit calls registered listener", async () => {
    const bus = createEventBus();
    const received: string[] = [];

    bus.on("user.created", (email) => {
      received.push(email as string);
    });
    await bus.emit("user.created", "alice@example.com");

    expect(received).toEqual(["alice@example.com"]);
  });

  test("multiple listeners on same event all receive payload", async () => {
    const bus = createEventBus();
    const log: number[] = [];

    bus.on("tick", () => {
      log.push(1);
    });
    bus.on("tick", () => {
      log.push(2);
    });
    await bus.emit("tick", undefined);

    expect(log).toEqual([1, 2]);
  });

  test("listeners for different events don't interfere", async () => {
    const bus = createEventBus();
    const received: string[] = [];

    bus.on("a", () => {
      received.push("a");
    });
    bus.on("b", () => {
      received.push("b");
    });
    await bus.emit("a", undefined);

    expect(received).toEqual(["a"]);
  });

  test("off removes the listener", async () => {
    const bus = createEventBus();
    const received: string[] = [];
    const handler = (v: unknown) => {
      received.push(v as string);
    };

    bus.on("ping", handler);
    bus.off("ping", handler);
    await bus.emit("ping", "ignored");

    expect(received).toEqual([]);
  });

  test("emit with no listeners is a no-op", async () => {
    const bus = createEventBus();
    await expect(bus.emit("nothing", 42)).resolves.toBeUndefined();
  });

  test("emit awaits async handlers before resolving", async () => {
    const bus = createEventBus();
    const log: string[] = [];

    bus.on("order.placed", async () => {
      await new Promise((r) => setTimeout(r, 5));
      log.push("handled");
    });

    await bus.emit("order.placed", undefined);
    expect(log).toEqual(["handled"]);
  });

  test("emit runs handlers concurrently, not sequentially", async () => {
    const bus = createEventBus();
    const order: string[] = [];

    bus.on("go", async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("slow");
    });
    bus.on("go", async () => {
      order.push("fast");
    });

    await bus.emit("go", undefined);
    expect(order).toEqual(["fast", "slow"]);
  });

  test("a handler that throws rejects emit()", async () => {
    const bus = createEventBus();
    bus.on("boom", () => {
      throw new Error("handler failed");
    });

    expect(bus.emit("boom", undefined)).rejects.toThrow("handler failed");
  });
});
