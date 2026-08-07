import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineRoutes } from "@/http/builder";
import { createHiusRequest } from "@/http/request";
import { Router } from "@/http/router";
import type { ValidationIssue } from "@/http/validate";
import { validate } from "@/http/validate";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

function jsonRequest(method: string, url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validate()", () => {
  test("returns typed data on valid input", async () => {
    const raw = new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });
    const req = createHiusRequest(raw, new URL(raw.url));

    const data = await validate(req, UserSchema);

    expect(data.name).toBe("Alice");
    expect(data.email).toBe("alice@example.com");
    expect(data.age).toBeUndefined();
  });

  test("throws ValidationError on invalid input", async () => {
    const raw = new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "not-an-email" }),
    });
    const req = createHiusRequest(raw, new URL(raw.url));

    expect(validate(req, UserSchema)).rejects.toThrow();
  });

  test("ValidationError carries structured, locale-independent issues", async () => {
    const raw = new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad" }),
    });
    const req = createHiusRequest(raw, new URL(raw.url));

    try {
      await validate(req, UserSchema);
      expect(true).toBe(false); // should not reach here
    } catch (err: unknown) {
      expect(err).toHaveProperty("code", "VALIDATION_FAILED");
      const issues = (err as { issues: ValidationIssue[] }).issues;
      const paths = issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("name");
      expect(paths).toContain("email");
      // `code` is Zod's own stable issue code (e.g. "too_small",
      // "invalid_format") — not an English sentence — so an app can key
      // a translation catalog off it instead of parsing `message`.
      for (const issue of issues) {
        expect(typeof issue.code).toBe("string");
        expect(issue.code.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Router catches ValidationError → 422", () => {
  function makeRouter() {
    return new Router(
      defineRoutes((r) => {
        r.post("/users", async (req) => {
          const data = await validate(req, UserSchema);
          return new Response(JSON.stringify(data), { status: 201 });
        });
      }),
    );
  }

  test("valid body → 201", async () => {
    const router = makeRouter();
    const res = await router.handle(
      jsonRequest("POST", "/users", { name: "Bob", email: "bob@example.com" }),
    );
    expect(res.status).toBe(201);
  });

  test("invalid body → 422 with a code and structured issues", async () => {
    const router = makeRouter();
    const res = await router.handle(jsonRequest("POST", "/users", { name: "", email: "bad" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; issues: ValidationIssue[] };
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  test("non-JSON body → 400", async () => {
    const router = makeRouter();
    const res = await router.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
