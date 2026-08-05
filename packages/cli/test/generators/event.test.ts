import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateEvent } from "@/generators/event";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-event-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("generateEvent", () => {
  test("generates a handler under citadel/handlers named on<Event>", async () => {
    const { results, handlerName } = await generateEvent(appsDir, "billing", "invoice.paid");

    expect(handlerName).toBe("onInvoicePaid");
    expect(results[0]?.skipped).toBe(false);

    const file = await Bun.file(
      join(appsDir, "billing", "citadel", "handlers", "on-invoice-paid.ts"),
    ).text();
    expect(file).toContain("export async function onInvoicePaid");
  });

  test("the generated handler carries the idempotency reminder", async () => {
    const { results } = await generateEvent(appsDir, "billing", "invoice.paid");
    const file = await Bun.file(results[0]?.path ?? "").text();

    expect(file).toContain("idempotent");
  });

  test("returns the exact bus.on(...) snippet to wire the handler in", async () => {
    const { wiringSnippet } = await generateEvent(appsDir, "billing", "invoice.paid");

    expect(wiringSnippet).toBe('bus.on("invoice.paid", onInvoicePaid);');
  });

  test("does not touch an existing events.ts", async () => {
    const eventsPath = join(appsDir, "billing", "events.ts");
    await Bun.write(eventsPath, "// hand-written, don't touch\n");

    await generateEvent(appsDir, "billing", "invoice.paid");

    expect(await Bun.file(eventsPath).text()).toBe("// hand-written, don't touch\n");
  });
});
