import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { Container } from "@/core/container.ts";
import { createHiusRequest } from "@/http/core/request.ts";
import { Router } from "@/http/router.ts";
import { defineRoutes } from "@/http/routing/builder.ts";
import { validate } from "@/http/validation/validate.ts";

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

  test("ValidationError contains field errors", async () => {
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
      expect(err).toHaveProperty("errors");
      const errors = (err as { errors: Record<string, string[]> }).errors;
      expect(errors).toHaveProperty("name");
      expect(errors).toHaveProperty("email");
    }
  });
});

describe("Router catches ValidationError → 422", () => {
  class TestController {
    async create(req: ReturnType<typeof createHiusRequest>): Promise<Response> {
      const data = await validate(req, UserSchema);
      return new Response(JSON.stringify(data), { status: 201 });
    }
  }

  function makeRouter() {
    const routes = defineRoutes((r) => {
      r.post("/users", TestController, "create");
    });
    const container = new Container();
    container.register(TestController, () => new TestController());
    return new Router(routes, container);
  }

  test("valid body → 201", async () => {
    const router = makeRouter();
    const res = await router.handle(
      jsonRequest("POST", "/users", { name: "Bob", email: "bob@example.com" }),
    );
    expect(res.status).toBe(201);
  });

  test("invalid body → 422 with errors", async () => {
    const router = makeRouter();
    const res = await router.handle(jsonRequest("POST", "/users", { name: "", email: "bad" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: unknown };
    expect(body).toHaveProperty("errors");
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
