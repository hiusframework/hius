# HTTP Роутинг

Hius использует декларативный DSL для роутинга, вдохновлённый Rails и Phoenix. Контроллеры — это обычные классы без декораторов. Вся логика маршрутизации сосредоточена в одном файле (или разбита по доменным файлам).

## Быстрый старт

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

## Методы роутов

```ts
r.get("/path", Controller, "action");
r.post("/path", Controller, "action");
r.put("/path", Controller, "action");
r.patch("/path", Controller, "action");
r.delete("/path", Controller, "action");
```

## Макрос `resources`

Генерирует пять стандартных CRUD-маршрутов одним вызовом:

```ts
r.resources("posts", PostsController);
```

Разворачивается в:

| Метод | Путь | Экшн |
|-------|------|------|
| GET | `/posts` | `index` |
| GET | `/posts/:id` | `show` |
| POST | `/posts` | `create` |
| PATCH | `/posts/:id` | `update` |
| DELETE | `/posts/:id` | `destroy` |

## Параметры пути

Используйте сегменты `:name` — они доступны в контроллере через `req.params`:

```ts
r.get("/users/:id/posts/:postId", PostsController, "show");

// В контроллере:
async show(req: HiusRequest): Promise<Response> {
  const { id, postId } = req.params; // оба типизированы как string
}
```

## Scopes (области)

Группируют маршруты под общий префикс, пайплайн или набор ограничений:

```ts
r.scope("/api/v1", { pipe: "auth", constraints: [IsVerified] }, (r) => {
  r.resources("posts", PostsController);
  r.get("/me", UsersController, "me");
});
```

Вложенные scopes накапливают префикс и пайпы:

```ts
r.scope("/api", { pipe: "logging" }, (r) => {
  r.scope("/v1", { pipe: "auth" }, (r) => {
    r.get("/me", UsersController, "me");
    // pattern: /api/v1/me, pipes: [loggingPipe, authPipe]
  });
});
```

## Пайплайны

Именованные цепочки middleware, применяемые на уровне scope:

```ts
r.pipeline("auth", [RateLimitPipe, AuthPipe]);
r.pipeline("api",  [AuthPipe, JsonContentTypePipe]);

r.scope("/admin", { pipe: "auth" }, (r) => { ... });
r.scope("/api",   { pipe: "api"  }, (r) => { ... });
```

`Pipe` — функция, которая получает запрос и хендлер `next`:

```ts
import type { Pipe } from "hius";

export const AuthPipe: Pipe = async (req, next) => {
  const token = req.raw.headers.get("Authorization");
  if (!token) return unauthorized();
  const user = await verifyToken(token);
  return next(req.withCtx({ user })); // обогащаем контекст, передаём дальше
};
```

Пайпы компонуются слева направо: `[A, B]` → A оборачивает B оборачивает хендлер.

## Ограничения (Constraints)

Предикаты, защищающие маршруты — возвращают `false` чтобы отклонить с 403:

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

Constraints выполняются после пайпов и перед хендлером.

## Разбивка роутов по файлам

Для больших приложений — разбивайте роуты по доменам через `r.draw()` или `mergeRoutes()`.

### `r.draw()` — с наследованием scope (рекомендуется)

Функция под-роутов наследует префикс, пайпы и ограничения родительского scope:

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
    r.draw(usersRoutes); // наследует префикс /api/v1 и пайп auth
  });
});
```

### `mergeRoutes()` — плоское объединение

Когда каждый файл домена строит собственный `RouteDescriptor[]`:

```ts
import { defineRoutes, mergeRoutes } from "hius";

export default mergeRoutes(
  defineRoutes(usersRoutes),
  defineRoutes(adminRoutes),
  defineRoutes(billingRoutes),
);
```

## Контроллеры

Обычные классы — без декораторов. Регистрируйте их как провайдеры модуля, чтобы DI-контейнер мог их резолвить:

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

## Хелперы ответов

```ts
import { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, unprocessable, serverError } from "hius";

ok(data)             // 200 JSON
created(data)        // 201 JSON
noContent()          // 204 без тела
badRequest(data)     // 400 JSON
unauthorized()       // 401 JSON { error: "Unauthorized" }
forbidden()          // 403 JSON { error: "Forbidden" }
notFound()           // 404 JSON { error: "Not Found" }
unprocessable(data)  // 422 JSON
serverError()        // 500 JSON { error: "Internal Server Error" }
```

## `HiusRequest`

| Свойство | Тип | Описание |
|----------|-----|----------|
| `raw` | `Request` | Нативный Bun/Web Request |
| `method` | `HttpMethod` | GET, POST и т.д. |
| `pathname` | `string` | Путь URL без строки запроса |
| `params` | `Record<string, string>` | Параметры пути |
| `query` | `URLSearchParams` | Параметры строки запроса |
| `ctx` | `HiusContext` | Контекст запроса (пользователь, тенант и т.д.) |
| `withCtx(extra)` | `HiusRequest` | Возвращает новый запрос с объединённым контекстом |
| `json<T>()` | `Promise<T>` | Разобрать тело запроса как JSON |
