import { describe, expect, test } from "bun:test";
import { Container } from "@/core/container.ts";
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
});
