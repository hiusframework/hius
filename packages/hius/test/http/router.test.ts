import { describe, expect, spyOn, test } from "bun:test";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "@/errors";
import { defineRoutes } from "@/http/builder";
import { Router } from "@/http/router";
import type { Constraint, HiusRequest, Pipe } from "@/http/types";

async function hello(req: HiusRequest): Promise<Response> {
  return new Response(`hello ${req.params.name ?? "world"}`);
}

function req(method: string, url: string) {
  return new Request(`http://localhost${url}`, { method });
}

describe("Router", () => {
  test("dispatches GET to matching handler", async () => {
    const router = new Router(defineRoutes((r) => r.get("/hello", hello)));
    const res = await router.handle(req("GET", "/hello"));
    expect(await res.text()).toBe("hello world");
  });

  test("passes path params to handler", async () => {
    const router = new Router(defineRoutes((r) => r.get("/hello/:name", hello)));
    const res = await router.handle(req("GET", "/hello/alice"));
    expect(await res.text()).toBe("hello alice");
  });

  test("returns 404 for unknown route", async () => {
    const router = new Router(defineRoutes((r) => r.get("/hello", hello)));
    const res = await router.handle(req("GET", "/unknown"));
    expect(res.status).toBe(404);
  });

  test("returns 404 when method does not match", async () => {
    const router = new Router(defineRoutes((r) => r.get("/hello", hello)));
    const res = await router.handle(req("POST", "/hello"));
    expect(res.status).toBe(404);
  });

  test("runs pipes before handler", async () => {
    const log: string[] = [];
    const logPipe: Pipe = async (req, next) => {
      log.push("pipe");
      return next(req);
    };

    const router = new Router(
      defineRoutes((r) => {
        r.pipeline("log", [logPipe]);
        r.scope("/", { pipe: "log" }, (r) => {
          r.get("/hello", hello);
        });
      }),
    );

    await router.handle(req("GET", "/hello"));
    expect(log).toEqual(["pipe"]);
  });

  test("returns 403 when constraint fails", async () => {
    const block: Constraint = () => false;

    const router = new Router(
      defineRoutes((r) => {
        r.scope("/admin", { constraints: [block] }, (r) => {
          r.get("/users", hello);
        });
      }),
    );

    const res = await router.handle(req("GET", "/admin/users"));
    expect(res.status).toBe(403);
  });

  test("allows request when constraint passes", async () => {
    const allow: Constraint = () => true;

    const router = new Router(
      defineRoutes((r) => {
        r.scope("/admin", { constraints: [allow] }, (r) => {
          r.get("/users", hello);
        });
      }),
    );

    const res = await router.handle(req("GET", "/admin/users"));
    expect(res.status).toBe(200);
  });

  describe("domain error mapping", () => {
    function makeThrowingRouter(error: Error) {
      return new Router(
        defineRoutes((r) =>
          r.get("/action", async () => {
            throw error;
          }),
        ),
      );
    }

    test("NotFoundError → 404", async () => {
      const res = await makeThrowingRouter(new NotFoundError("user")).handle(req("GET", "/action"));
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "user not found" });
    });

    test("UnauthorizedError → 401", async () => {
      const res = await makeThrowingRouter(new UnauthorizedError()).handle(req("GET", "/action"));
      expect(res.status).toBe(401);
    });

    test("ForbiddenError → 403", async () => {
      const res = await makeThrowingRouter(new ForbiddenError()).handle(req("GET", "/action"));
      expect(res.status).toBe(403);
    });

    test("ConflictError → 409", async () => {
      const res = await makeThrowingRouter(new ConflictError("email already taken")).handle(
        req("GET", "/action"),
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "email already taken" });
    });

    test("UnprocessableError → 422", async () => {
      const res = await makeThrowingRouter(new UnprocessableError("invalid state")).handle(
        req("GET", "/action"),
      );
      expect(res.status).toBe(422);
    });

    test("unknown error is caught and mapped to 500, not rethrown", async () => {
      // Router logs the unmapped error via console.error before returning
      // 500 (deliberately — an operator needs to see it). Spy on it rather
      // than let this deliberately-triggered error print a stack trace
      // that reads like a real test failure.
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});

      const router = makeThrowingRouter(new Error("boom"));
      const res = await router.handle(req("GET", "/action"));

      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: "Internal Server Error" });
      expect(errorSpy).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });
});
