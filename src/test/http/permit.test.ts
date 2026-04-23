import { describe, expect, test } from "bun:test";
import { createHiusRequest } from "@/http/core/request.ts";
import { permit, permitQuery } from "@/http/validation/permit.ts";

function jsonReq(body: unknown) {
  return createHiusRequest(
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    new URL("http://localhost/test"),
  );
}

function queryReq(query: string) {
  return createHiusRequest(
    new Request(`http://localhost/test?${query}`),
    new URL(`http://localhost/test?${query}`),
  );
}

describe("permit() — body", () => {
  test("returns only permitted fields", async () => {
    const req = jsonReq({
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
      __proto__: "bad",
    });
    const params = await permit(req, { name: "string", email: "string" });

    // toEqual verifies exact shape — unknown fields (role, __proto__) must be absent
    expect(params).toEqual({ name: "Alice", email: "alice@example.com" });
    expect(Object.hasOwn(params, "role")).toBe(false);
    expect(Object.hasOwn(params, "__proto__")).toBe(false);
  });

  test("drops fields with wrong type silently", async () => {
    const req = jsonReq({ age: "not-a-number", name: 42 });
    const params = await permit(req, { age: "number", name: "string" });

    expect(params).not.toHaveProperty("age");
    expect(params).not.toHaveProperty("name");
  });

  test("coerces string to number", async () => {
    const req = jsonReq({ age: "25" });
    const params = await permit(req, { age: "number" });

    expect(params.age).toBe(25);
  });

  test("coerces string to boolean", async () => {
    const req = jsonReq({ active: "true", archived: "false" });
    const params = await permit(req, { active: "boolean", archived: "boolean" });

    expect(params.active).toBe(true);
    expect(params.archived).toBe(false);
  });

  test("native boolean passes through", async () => {
    const req = jsonReq({ active: true });
    const params = await permit(req, { active: "boolean" });
    expect(params.active).toBe(true);
  });

  test("native number passes through", async () => {
    const req = jsonReq({ score: 99 });
    const params = await permit(req, { score: "number" });
    expect(params.score).toBe(99);
  });

  test("string[] filters non-string elements", async () => {
    const req = jsonReq({ tags: ["a", 1, "b", null] });
    const params = await permit(req, { tags: "string[]" });
    expect(params.tags).toEqual(["a", "b"]);
  });

  test("number[] coerces string elements", async () => {
    const req = jsonReq({ ids: [1, "2", 3] });
    const params = await permit(req, { ids: "number[]" });
    expect(params.ids).toEqual([1, 2, 3]);
  });

  test("enum allows only listed values", async () => {
    const req = jsonReq({ role: "admin" });
    const params = await permit(req, { role: ["admin", "user"] as const });
    expect(params.role).toBe("admin");
  });

  test("enum rejects unlisted value", async () => {
    const req = jsonReq({ role: "superuser" });
    const params = await permit(req, { role: ["admin", "user"] as const });
    expect(params).not.toHaveProperty("role");
  });

  test("missing fields are absent from result", async () => {
    const req = jsonReq({ name: "Alice" });
    const params = await permit(req, { name: "string", age: "number" });
    expect(params.name).toBe("Alice");
    expect(params).not.toHaveProperty("age");
  });

  test("returns empty object on non-JSON body", async () => {
    const req = createHiusRequest(
      new Request("http://localhost/test", { method: "POST", body: "plain text" }),
      new URL("http://localhost/test"),
    );
    const params = await permit(req, { name: "string" });
    expect(params).toEqual({});
  });

  test("returns empty object when body is not an object", async () => {
    const req = jsonReq([1, 2, 3]);
    const params = await permit(req, { name: "string" });
    expect(params).toEqual({});
  });
});

describe("permitQuery() — URL query params", () => {
  test("reads permitted string params", async () => {
    const req = queryReq("name=Alice&role=admin");
    const params = permitQuery(req, { name: "string" });
    expect(params).toEqual({ name: "Alice" });
    expect(params).not.toHaveProperty("role");
  });

  test("coerces query param to number", async () => {
    const req = queryReq("page=2&limit=10");
    const params = permitQuery(req, { page: "number", limit: "number" });
    expect(params).toEqual({ page: 2, limit: 10 });
  });

  test("coerces query param to boolean", async () => {
    const req = queryReq("active=true");
    const params = permitQuery(req, { active: "boolean" });
    expect(params.active).toBe(true);
  });

  test("enum restricts query param values", async () => {
    const req = queryReq("sort=asc");
    const params = permitQuery(req, { sort: ["asc", "desc"] as const });
    expect(params.sort).toBe("asc");
  });

  test("drops invalid enum value from query", async () => {
    const req = queryReq("sort=random");
    const params = permitQuery(req, { sort: ["asc", "desc"] as const });
    expect(params).not.toHaveProperty("sort");
  });

  test("returns empty object for missing params", async () => {
    const req = queryReq("other=x");
    const params = permitQuery(req, { name: "string" });
    expect(params).toEqual({});
  });
});
