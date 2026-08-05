import { describe, expect, test } from "bun:test";
import { defineRoutes, mergeRoutes, type RouteBuilder } from "@/http/builder";
import type { Constraint, Pipe } from "@/http/types";

const handler = async () => new Response("ok");
const noopPipe: Pipe = (req, next) => next(req);
const blockConstraint: Constraint = () => false;

describe("defineRoutes", () => {
  test("registers a simple GET route", () => {
    const routes = defineRoutes((r) => {
      r.get("/health", handler);
    });

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ method: "GET", pattern: "/health" });
  });

  test("registers all HTTP methods", () => {
    const routes = defineRoutes((r) => {
      r.get("/a", handler);
      r.post("/b", handler);
      r.put("/c", handler);
      r.patch("/d", handler);
      r.delete("/e", handler);
      r.options("/f", handler);
    });

    expect(routes.map((r) => r.method)).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ]);
  });

  test("resources generates a route per provided handler, skipping the rest", () => {
    const routes = defineRoutes((r) => {
      r.resources("posts", { index: handler, show: handler, create: handler });
    });

    expect(routes).toHaveLength(3);
    expect(routes.map((r) => `${r.method} ${r.pattern}`)).toEqual([
      "GET /posts",
      "GET /posts/:id",
      "POST /posts",
    ]);
  });

  test("resources generates all 5 CRUD routes when every handler is provided", () => {
    const routes = defineRoutes((r) => {
      r.resources("posts", {
        index: handler,
        show: handler,
        create: handler,
        update: handler,
        destroy: handler,
      });
    });

    expect(routes.map((r) => `${r.method} ${r.pattern}`)).toEqual([
      "GET /posts",
      "GET /posts/:id",
      "POST /posts",
      "PATCH /posts/:id",
      "DELETE /posts/:id",
    ]);
  });

  test("scope prepends prefix to routes", () => {
    const routes = defineRoutes((r) => {
      r.scope("/api/v1", (r) => {
        r.get("/users", handler);
        r.get("/users/:id", handler);
      });
    });

    expect(routes.map((r) => r.pattern)).toEqual(["/api/v1/users", "/api/v1/users/:id"]);
  });

  test("a path that textually starts with the scope's own prefix is still prefixed, not skipped", () => {
    // Regression: addRoute used to guard with path.startsWith(this.prefix)
    // to avoid double-prefixing, which meant "/apikeys" inside scope("/api")
    // was left as "/apikeys" instead of "/api/apikeys" — the prefix string
    // happening to be a textual prefix of the path was mistaken for the
    // path already having been prefixed.
    const routes = defineRoutes((r) => {
      r.scope("/api", (r) => {
        r.get("/apikeys", handler);
      });
    });

    expect(routes[0]?.pattern).toBe("/api/apikeys");
  });

  test("scope inherits pipes", () => {
    const routes = defineRoutes((r) => {
      r.pipeline("auth", [noopPipe]);
      r.scope("/admin", { pipe: "auth" }, (r) => {
        r.get("/dashboard", handler);
      });
    });

    expect(routes[0]!.pipes).toHaveLength(1);
    expect(routes[0]!.pipes[0]).toBe(noopPipe);
  });

  test("scope inherits constraints", () => {
    const routes = defineRoutes((r) => {
      r.scope("/admin", { constraints: [blockConstraint] }, (r) => {
        r.get("/users", handler);
      });
    });

    expect(routes[0]!.constraints).toHaveLength(1);
    expect(routes[0]!.constraints[0]).toBe(blockConstraint);
  });

  test("nested scopes accumulate prefix and pipes", () => {
    const pipeA: Pipe = (req, next) => next(req);
    const pipeB: Pipe = (req, next) => next(req);

    const routes = defineRoutes((r) => {
      r.pipeline("a", [pipeA]);
      r.pipeline("b", [pipeB]);

      r.scope("/api", { pipe: "a" }, (r) => {
        r.scope("/v1", { pipe: "b" }, (r) => {
          r.get("/me", handler);
        });
      });
    });

    expect(routes[0]!.pattern).toBe("/api/v1/me");
    expect(routes[0]!.pipes).toEqual([pipeA, pipeB]);
  });

  test("routes outside scope are unaffected", () => {
    const routes = defineRoutes((r) => {
      r.get("/health", handler);
      r.scope("/api", (r) => {
        r.get("/users", handler);
      });
    });

    expect(routes[0]!.pipes).toHaveLength(0);
    expect(routes[0]!.constraints).toHaveLength(0);
    expect(routes[0]!.pattern).toBe("/health");
  });

  test("resources inside scope uses scope prefix", () => {
    const routes = defineRoutes((r) => {
      r.scope("/api/v1", (r) => {
        r.resources("users", {
          index: handler,
          show: handler,
          create: handler,
          update: handler,
          destroy: handler,
        });
      });
    });

    expect(routes.map((r) => r.pattern)).toEqual([
      "/api/v1/users",
      "/api/v1/users/:id",
      "/api/v1/users",
      "/api/v1/users/:id",
      "/api/v1/users/:id",
    ]);
  });
});

describe("r.draw", () => {
  const subRoutes = (r: RouteBuilder) => {
    r.get("/users", handler);
    r.get("/users/:id", handler);
  };

  test("draw inlines sub-routes into current context", () => {
    const routes = defineRoutes((r) => {
      r.draw(subRoutes);
    });

    expect(routes.map((r) => r.pattern)).toEqual(["/users", "/users/:id"]);
  });

  test("draw inside scope inherits prefix", () => {
    const routes = defineRoutes((r) => {
      r.scope("/api/v1", (r) => {
        r.draw(subRoutes);
      });
    });

    expect(routes.map((r) => r.pattern)).toEqual(["/api/v1/users", "/api/v1/users/:id"]);
  });

  test("draw inside scope inherits pipes", () => {
    const pipe: Pipe = (req, next) => next(req);

    const routes = defineRoutes((r) => {
      r.pipeline("auth", [pipe]);
      r.scope("/api", { pipe: "auth" }, (r) => {
        r.draw(subRoutes);
      });
    });

    expect(routes[0]!.pipes).toEqual([pipe]);
    expect(routes[1]!.pipes).toEqual([pipe]);
  });

  test("draw inside scope inherits constraints", () => {
    const constraint: Constraint = () => true;

    const routes = defineRoutes((r) => {
      r.scope("/admin", { constraints: [constraint] }, (r) => {
        r.draw(subRoutes);
      });
    });

    expect(routes[0]!.constraints).toEqual([constraint]);
  });
});

describe("mergeRoutes", () => {
  test("concatenates multiple route groups", () => {
    const groupA = defineRoutes((r) => {
      r.get("/users", handler);
    });
    const groupB = defineRoutes((r) => {
      r.get("/posts", handler);
    });

    const merged = mergeRoutes(groupA, groupB);

    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.pattern)).toEqual(["/users", "/posts"]);
  });

  test("preserves pipes and constraints from each group", () => {
    const pipe: Pipe = (req, next) => next(req);

    const groupA = defineRoutes((r) => {
      r.pipeline("auth", [pipe]);
      r.scope("/admin", { pipe: "auth" }, (r) => {
        r.get("/users", handler);
      });
    });
    const groupB = defineRoutes((r) => {
      r.get("/health", handler);
    });

    const merged = mergeRoutes(groupA, groupB);

    expect(merged[0]!.pipes).toEqual([pipe]);
    expect(merged[1]!.pipes).toHaveLength(0);
  });
});
