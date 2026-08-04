import { describe, expect, test } from "bun:test";
import { createHiusRequest } from "@/http/request";

function jsonReq(body: unknown) {
  const raw = new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return createHiusRequest(raw, new URL(raw.url));
}

describe("HiusRequest.json() body caching", () => {
  // Regression: Request.json() consumes the body stream — calling it a
  // second time throws "Body already used". A pipe chain (e.g. an auth
  // pipe reading the body, then validate() reading it again in the
  // handler) used to break on exactly this.
  test("calling json() twice on the same request does not throw", async () => {
    const req = jsonReq({ name: "Alice" });

    const first = await req.json();
    const second = await req.json();

    expect(first).toEqual({ name: "Alice" });
    expect(second).toEqual({ name: "Alice" });
  });

  test("concurrent json() calls before the first resolves still agree", async () => {
    const req = jsonReq({ name: "Alice" });

    const [first, second] = await Promise.all([req.json(), req.json()]);

    expect(first).toEqual(second);
  });

  test("the cache is shared across instances derived via withParams/withCtx", async () => {
    const req = jsonReq({ name: "Alice" });
    const derived = req.withParams({ id: "1" }).withCtx({ user: "bob" });

    const fromOriginal = await req.json();
    const fromDerived = await derived.json();

    expect(fromOriginal).toEqual(fromDerived);
  });
});
