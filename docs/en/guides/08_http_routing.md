# HTTP Routing

Hius uses a declarative router DSL inspired by Rails and Phoenix. Controllers are plain classes — no decorators, no magic. All routing logic lives in a single routes file (or split across domain files).

## Quick start

```ts
// src/app/routes.ts
import { defineRoutes } from "hius";
import { AuthPipe } from "@/http/pipes/auth.pipe.ts";
import { IsAdmin } from "@/http/constraints/admin.constraint.ts";
import { PostsController } from "@/app/posts/posts.controller.ts";
import { UsersController } from "@/app/users/users.controller.ts";

export default defineRoutes((r) => {
  r.pipeline("auth", [AuthPipe]);

  r.get("/health", HealthController, "check");

  r.scope("/api/v1", { pipe: "auth" }, (r) => {
    r.resources("posts", PostsController);
    r.get("/me", UsersController, "me");
  });

  r.scope("/admin", { pipe: "auth", constraints: [IsAdmin] }, (r) => {
    r.resources("users", UsersController);
  });
});
```

```ts
// src/index.ts
import { bootstrapHttp } from "hius";
import { AppModule } from "@/app/app.module.ts";
import routes from "@/app/routes.ts";

bootstrapHttp(AppModule, routes, { port: 3000 });
```

## Route methods

```ts
r.get("/path", Controller, "action");
r.post("/path", Controller, "action");
r.put("/path", Controller, "action");
r.patch("/path", Controller, "action");
r.delete("/path", Controller, "action");
```

## `resources` macro

Generates five standard CRUD routes in one call:

```ts
r.resources("posts", PostsController);
```

Expands to:

| Method | Path | Action |
|--------|------|--------|
| GET | `/posts` | `index` |
| GET | `/posts/:id` | `show` |
| POST | `/posts` | `create` |
| PATCH | `/posts/:id` | `update` |
| DELETE | `/posts/:id` | `destroy` |

## Path parameters

Use `:name` segments — they are available in the controller via `req.params`:

```ts
r.get("/users/:id/posts/:postId", PostsController, "show");

// In the controller:
async show(req: HiusRequest): Promise<Response> {
  const { id, postId } = req.params; // both typed as string
}
```

## Scopes

Group routes under a common prefix, pipeline, or constraint set:

```ts
r.scope("/api/v1", { pipe: "auth", constraints: [IsVerified] }, (r) => {
  r.resources("posts", PostsController);
  r.get("/me", UsersController, "me");
});
```

Nested scopes accumulate prefix and pipes:

```ts
r.scope("/api", { pipe: "logging" }, (r) => {
  r.scope("/v1", { pipe: "auth" }, (r) => {
    r.get("/me", UsersController, "me");
    // pattern: /api/v1/me, pipes: [loggingPipe, authPipe]
  });
});
```

## Pipelines

Named middleware chains applied at scope level:

```ts
r.pipeline("auth", [RateLimitPipe, AuthPipe]);
r.pipeline("api",  [AuthPipe, JsonContentTypePipe]);

r.scope("/admin", { pipe: "auth" }, (r) => { ... });
r.scope("/api",   { pipe: "api"  }, (r) => { ... });
```

A `Pipe` is a function that receives the request and a `next` handler:

```ts
import type { Pipe } from "hius";

export const AuthPipe: Pipe = async (req, next) => {
  const token = req.raw.headers.get("Authorization");
  if (!token) return unauthorized();
  const user = await verifyToken(token);
  return next(req.withCtx({ user })); // enrich context, pass forward
};
```

Pipes compose left-to-right: `[A, B]` → A wraps B wraps handler.

## Constraints

Predicates that guard routes — return `false` to reject with 403:

```ts
import type { Constraint } from "hius";

export const IsAdmin: Constraint = (req) => {
  const user = req.ctx.user as User | undefined;
  return user?.role === "admin";
};

r.scope("/admin", { constraints: [IsAdmin] }, (r) => {
  r.resources("users", AdminUsersController);
});
```

Constraints run after pipes and before the handler.

## Splitting routes across files

For larger applications, split routes by domain using `r.draw()` or `mergeRoutes()`.

### `r.draw()` — scope-aware (recommended)

The sub-route function inherits the parent scope's prefix, pipes, and constraints:

```ts
// src/app/users/users.routes.ts
import type { RouteBuilder } from "hius";
import { UsersController } from "./users.controller.ts";

export const usersRoutes = (r: RouteBuilder) => {
  r.resources("users", UsersController);
  r.get("/me", UsersController, "me");
};

// src/app/routes.ts
import { usersRoutes } from "@/app/users/users.routes.ts";

export default defineRoutes((r) => {
  r.pipeline("auth", [AuthPipe]);
  r.scope("/api/v1", { pipe: "auth" }, (r) => {
    r.draw(usersRoutes); // inherits /api/v1 prefix + auth pipe
  });
});
```

### `mergeRoutes()` — flat merge

When each domain file builds its own complete `RouteDescriptor[]`:

```ts
import { defineRoutes, mergeRoutes } from "hius";

export default mergeRoutes(
  defineRoutes(usersRoutes),
  defineRoutes(adminRoutes),
  defineRoutes(billingRoutes),
);
```

## Controllers

Plain classes — no decorators required. Register them as module providers so the DI container can resolve them:

```ts
// src/app/posts/posts.controller.ts
import { ok, created, notFound } from "hius";
import type { HiusRequest } from "hius";

export class PostsController {
  constructor(private readonly posts: PostsService) {}

  async index(req: HiusRequest): Promise<Response> {
    const all = await this.posts.getAll();
    return ok(all);
  }

  async show(req: HiusRequest): Promise<Response> {
    const post = await this.posts.getById(req.params.id);
    return post ? ok(post) : notFound();
  }

  async create(req: HiusRequest): Promise<Response> {
    const body = await validate(req, CreatePostSchema);
    const post = await this.posts.create(body);
    return created(post);
  }
}
```

## Response helpers

```ts
import { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, unprocessable, serverError } from "hius";

ok(data)             // 200 JSON
created(data)        // 201 JSON
noContent()          // 204 no body
badRequest(data)     // 400 JSON
unauthorized()       // 401 JSON { error: "Unauthorized" }
forbidden()          // 403 JSON { error: "Forbidden" }
notFound()           // 404 JSON { error: "Not Found" }
unprocessable(data)  // 422 JSON
serverError()        // 500 JSON { error: "Internal Server Error" }
```

## `HiusRequest`

| Property | Type | Description |
|----------|------|-------------|
| `raw` | `Request` | Native Bun/Web Request |
| `method` | `HttpMethod` | GET, POST, etc. |
| `pathname` | `string` | URL path without query string |
| `params` | `Record<string, string>` | Path parameters |
| `query` | `URLSearchParams` | Query string parameters |
| `ctx` | `HiusContext` | Per-request context (user, tenant, etc.) |
| `withCtx(extra)` | `HiusRequest` | Returns new request with merged context |
| `json<T>()` | `Promise<T>` | Parse request body as JSON |
