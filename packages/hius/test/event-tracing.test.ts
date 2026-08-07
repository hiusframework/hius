import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { whereDoesEventGo } from "@/event-tracing";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-event-tracing-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

async function writeDomainFile(
  domain: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const fullPath = join(appsDir, domain, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

test("finds a single subscriber", async () => {
  await writeDomainFile("billing", "events.ts", `bus.on("invoice.paid", onInvoicePaid);\n`);

  const subscribers = await whereDoesEventGo(appsDir, "invoice.paid");

  expect(subscribers).toEqual([{ domain: "billing", file: "events.ts", handler: "onInvoicePaid" }]);
});

test("finds subscribers across multiple domains", async () => {
  await writeDomainFile("billing", "events.ts", `bus.on("invoice.paid", onInvoicePaid);\n`);
  await writeDomainFile("notifications", "events.ts", `bus.on("invoice.paid", sendReceipt);\n`);

  const subscribers = await whereDoesEventGo(appsDir, "invoice.paid");

  expect(subscribers.map((s) => s.domain).sort()).toEqual(["billing", "notifications"]);
});

test("ignores subscriptions to a different event name", async () => {
  await writeDomainFile("billing", "events.ts", `bus.on("invoice.refunded", onRefund);\n`);

  const subscribers = await whereDoesEventGo(appsDir, "invoice.paid");

  expect(subscribers).toEqual([]);
});

test("ignores unrelated .on(...) calls that don't match the (string, handler) shape", async () => {
  await writeDomainFile(
    "billing",
    "events.ts",
    `something.on(makeEventName(), onInvoicePaid); // not a string literal — not a match
other.on("invoice.paid"); // no handler argument — not a match
`,
  );

  const subscribers = await whereDoesEventGo(appsDir, "invoice.paid");

  expect(subscribers).toEqual([]);
});

test("a project with no domains returns no subscribers", async () => {
  const subscribers = await whereDoesEventGo(appsDir, "invoice.paid");
  expect(subscribers).toEqual([]);
});
