import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Router } from "@/http/router.ts";
import { makeE2eApp } from "./helpers.ts";

const hasDb = !!process.env.DATABASE_URL;

function req(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe.if(hasDb)("Users API (e2e)", () => {
  let router: Router;
  let teardown: () => Promise<void>;

  beforeEach(() => {
    ({ router, teardown } = makeE2eApp());
  });

  afterEach(async () => {
    await teardown();
  });

  test("POST /users → 201 with user data", async () => {
    const res = await router.handle(
      req("POST", "/users", { email: "alice@example.com", name: "Alice" }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string; name: string };
    expect(body.email).toBe("alice@example.com");
    expect(body.name).toBe("Alice");
    expect(body.id).toBeTruthy();
  });

  test("GET /users/:id → 200 with user data", async () => {
    const created = await router.handle(req("POST", "/users", { email: "bob@example.com" }));
    const { id } = (await created.json()) as { id: string };

    const res = await router.handle(req("GET", `/users/${id}`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.id).toBe(id);
    expect(body.email).toBe("bob@example.com");
  });

  test("GET /users/:id → 404 for unknown id", async () => {
    const res = await router.handle(req("GET", "/users/00000000-0000-0000-0000-000000000099"));
    expect(res.status).toBe(404);
  });

  test("POST /users with missing email → 422", async () => {
    const res = await router.handle(req("POST", "/users", { name: "No Email" }));
    expect(res.status).toBe(422);
  });

  test("POST /users with duplicate email → 409", async () => {
    await router.handle(req("POST", "/users", { email: "dup@example.com" }));
    const res = await router.handle(req("POST", "/users", { email: "dup@example.com" }));
    expect(res.status).toBe(409);
  });
});
