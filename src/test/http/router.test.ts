import { describe, expect, test } from "bun:test";
import { Container } from "@/core/container.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "@/domain/errors.ts";
import type { Constraint, HiusRequest, Pipe } from "@/http/core/types.ts";
import { Router } from "@/http/router.ts";
import { defineRoutes } from "@/http/routing/builder.ts";

class GreetController {
  async hello(req: HiusRequest) {
    return new Response(`hello ${req.params.name ?? "world"}`);
  }
  async create() {
    return new Response("created", { status: 201 });
  }
}

function makeRouter(fn: Parameters<typeof defineRoutes>[0]) {
  const routes = defineRoutes(fn);
  const container = new Container();
  container.register(GreetController, () => new GreetController());
  return new Router(routes, container);
}

function req(method: string, url: string) {
  return new Request(`http://localhost${url}`, { method });
}

describe("Router", () => {
  test("dispatches GET to matching handler", async () => {
    const router = makeRouter((r) => {
      r.get("/hello", GreetController, "hello");
    });
    const res = await router.handle(req("GET", "/hello"));
    expect(await res.text()).toBe("hello world");
  });

  test("passes path params to handler", async () => {
    const router = makeRouter((r) => {
      r.get("/hello/:name", GreetController, "hello");
    });
    const res = await router.handle(req("GET", "/hello/alice"));
    expect(await res.text()).toBe("hello alice");
  });

  test("returns 404 for unknown route", async () => {
    const router = makeRouter((r) => {
      r.get("/hello", GreetController, "hello");
    });
    const res = await router.handle(req("GET", "/unknown"));
    expect(res.status).toBe(404);
  });

  test("returns 404 when method does not match", async () => {
    const router = makeRouter((r) => {
      r.get("/hello", GreetController, "hello");
    });
    const res = await router.handle(req("POST", "/hello"));
    expect(res.status).toBe(404);
  });

  test("runs pipes before handler", async () => {
    const log: string[] = [];
    const logPipe: Pipe = async (req, next) => {
      log.push("pipe");
      return next(req);
    };

    const router = (() => {
      const routes = defineRoutes((r) => {
        r.pipeline("log", [logPipe]);
        r.scope("/", { pipe: "log" }, (r) => {
          r.get("/hello", GreetController, "hello");
        });
      });
      const container = new Container();
      container.register(GreetController, () => new GreetController());
      return new Router(routes, container);
    })();

    await router.handle(req("GET", "/hello"));
    expect(log).toEqual(["pipe"]);
  });

  test("returns 403 when constraint fails", async () => {
    const block: Constraint = () => false;

    const router = (() => {
      const routes = defineRoutes((r) => {
        r.scope("/admin", { constraints: [block] }, (r) => {
          r.get("/users", GreetController, "hello");
        });
      });
      const container = new Container();
      container.register(GreetController, () => new GreetController());
      return new Router(routes, container);
    })();

    const res = await router.handle(req("GET", "/admin/users"));
    expect(res.status).toBe(403);
  });

  test("allows request when constraint passes", async () => {
    const allow: Constraint = () => true;

    const router = (() => {
      const routes = defineRoutes((r) => {
        r.scope("/admin", { constraints: [allow] }, (r) => {
          r.get("/users", GreetController, "hello");
        });
      });
      const container = new Container();
      container.register(GreetController, () => new GreetController());
      return new Router(routes, container);
    })();

    const res = await router.handle(req("GET", "/admin/users"));
    expect(res.status).toBe(200);
  });

  describe("domain error mapping", () => {
    function makeThrowingRouter(error: Error) {
      class ThrowController {
        async action(): Promise<Response> {
          throw error;
        }
      }
      const routes = defineRoutes((r) => {
        r.get("/action", ThrowController, "action");
      });
      const container = new Container();
      container.register(ThrowController, () => new ThrowController());
      return new Router(routes, container);
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

    test("unknown error is rethrown", async () => {
      const boom = new Error("boom");
      const router = makeThrowingRouter(boom);
      expect(router.handle(req("GET", "/action"))).rejects.toThrow("boom");
    });
  });
});
