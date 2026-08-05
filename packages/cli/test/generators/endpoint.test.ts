import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateEndpoint } from "@/generators/endpoint";

let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(tmpdir(), "hius-generate-endpoint-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

describe("generateEndpoint", () => {
  test("generates a handler under fortress/http named after the method and path", async () => {
    const { results, handlerName } = await generateEndpoint(
      appsDir,
      "billing",
      "GET",
      "/invoices/:id",
    );

    expect(handlerName).toBe("getInvoicesId");
    expect(results[0]?.skipped).toBe(false);

    const file = await Bun.file(
      join(appsDir, "billing", "fortress", "http", "get-invoices-id.ts"),
    ).text();
    expect(file).toContain("export async function getInvoicesId");
    expect(file).toContain("GET /invoices/:id");
  });

  test("returns the exact snippet to wire the handler into routes.ts", async () => {
    const { wiringSnippet } = await generateEndpoint(appsDir, "billing", "POST", "/invoices");

    expect(wiringSnippet).toBe('r.post("/invoices", postInvoices);');
  });

  test("does not touch an existing routes.ts", async () => {
    const routesPath = join(appsDir, "billing", "routes.ts");
    await Bun.write(routesPath, "// hand-written, don't touch\n");

    await generateEndpoint(appsDir, "billing", "GET", "/invoices");

    expect(await Bun.file(routesPath).text()).toBe("// hand-written, don't touch\n");
  });

  test("DELETE maps to the RouteBuilder's lowercase r.delete(...) call", async () => {
    const { wiringSnippet } = await generateEndpoint(appsDir, "billing", "DELETE", "/invoices/:id");

    expect(wiringSnippet).toContain("r.delete(");
  });
});
