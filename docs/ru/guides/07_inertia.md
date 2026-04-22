# Интеграция Inertia.js

Inertia.js — это протокол, позволяющий строить single-page приложения с серверным роутингом и контроллерами, без написания отдельного API. Hius выступает сервером, Svelte (или Vue/React) отвечает за UI.

## Как это работает

```
Первый запрос (полная загрузка страницы):
  Браузер → GET /posts
  Hius    → HTML shell + вложенные { component: "Posts/Index", props: { posts } }
  Клиент  → Inertia инициализируется, рендерит Posts/Index.svelte с props

Навигация (SPA, без перезагрузки):
  Браузер → GET /posts/1  [заголовок X-Inertia: true]
  Hius    → JSON { component: "Posts/Show", props: { post }, url: "/posts/1" }
  Клиент  → Inertia меняет компонент, обновляет URL
```

Контроллер ничего не знает о Svelte. Он возвращает данные — Inertia сам управляет рендерингом.

## Этапы реализации

### Фаза A — Минимальная рабочая интеграция

**Цель:** хелпер `inertia()` + отдача статики. Достаточно для рендера страниц.

#### 1. Установка `@inertiajs/svelte`

```sh
bun add @inertiajs/svelte
```

#### 2. Хелпер `inertia()` для ответов

Создать `src/http/inertia/inertia.ts`:

```ts
import type { HiusRequest } from "@/http/core/types.ts";

type PageData = {
  component: string;
  props: Record<string, unknown>;
  url: string;
  version: string;
};

// Bump this when assets change to trigger a full reload on the client.
const ASSET_VERSION = "1";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function rootLayout(page: PageData): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="app" data-page="${escapeHtml(JSON.stringify(page))}"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`;
}

export function inertia(
  req: HiusRequest,
  component: string,
  props: Record<string, unknown> = {},
): Response {
  const page: PageData = {
    component,
    props,
    url: req.pathname,
    version: ASSET_VERSION,
  };

  // XHR-запрос от Inertia — возвращаем только JSON
  if (req.raw.headers.get("X-Inertia")) {
    return new Response(JSON.stringify(page), {
      headers: {
        "Content-Type": "application/json",
        "X-Inertia": "true",
        Vary: "Accept",
      },
    });
  }

  // Первый визит — возвращаем полный HTML shell
  return new Response(rootLayout(page), {
    headers: { "Content-Type": "text/html" },
  });
}
```

#### 3. Отдача статических файлов

В `src/http/server.ts` настроить `Bun.serve()` для отдачи скомпилированного фронтенда:

```ts
Bun.serve({
  routes: {
    "/assets/*": async (req) => {
      const path = new URL(req.url).pathname.replace("/assets", "./frontend/dist");
      return new Response(Bun.file(path));
    },
  },
  fetch: (req) => router.handle(req),
  port: opts.port ?? 3000,
});
```

#### 4. Точка входа Svelte

```
frontend/
  app.ts           ← инициализация Inertia
  Pages/
    Posts/
      Index.svelte
      Show.svelte
    Users/
      Index.svelte
```

`frontend/app.ts`:

```ts
import { createInertiaApp } from "@inertiajs/svelte";

createInertiaApp({
  resolve: (name) => import(`./Pages/${name}.svelte`),
  setup({ el, App, props }) {
    new App({ target: el, props });
  },
});
```

#### 5. Использование `inertia()` в контроллере

```ts
class PostsController {
  constructor(private readonly posts: PostsService) {}

  async index(req: HiusRequest): Promise<Response> {
    const posts = await this.posts.getAll();
    return inertia(req, "Posts/Index", { posts });
  }

  async show(req: HiusRequest): Promise<Response> {
    const post = await this.posts.getById(req.params.id);
    if (!post) return notFound();
    return inertia(req, "Posts/Show", { post });
  }

  async store(req: HiusRequest): Promise<Response> {
    const body = await req.json<CreatePostDto>();
    await this.posts.create(body);
    return redirect("/posts");
  }
}
```

`frontend/Pages/Posts/Index.svelte`:

```svelte
<script lang="ts">
  import { Link } from "@inertiajs/svelte";
  export let posts: Post[];
</script>

<h1>Posts</h1>

{#each posts as post}
  <div>
    <Link href="/posts/{post.id}">{post.title}</Link>
  </div>
{/each}
```

#### 6. Сборка фронтенда

```sh
bun build frontend/app.ts --outdir frontend/dist --target browser
```

Добавить в `mise.toml`:

```toml
[tasks."frontend:build"]
description = "Build Svelte frontend for production"
run = "bun build frontend/app.ts --outdir frontend/dist --target browser"

[tasks."frontend:dev"]
description = "Watch and rebuild frontend on change"
run = "bun build frontend/app.ts --outdir frontend/dist --target browser --watch"
```

---

### Фаза B — Сессии и flash-сообщения

**Цель:** POST → редирект → сообщение об успехе/ошибке. Стандартный flow форм.

#### Middleware сессий

```ts
// src/http/session/session.ts
export interface Session {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  flash(key: string, value: unknown): void;
  getFlash<T>(key: string): T | undefined;
}
```

Сессии хранятся в подписанных зашифрованных куках:

```ts
const SessionPipe: Pipe = async (req, next) => {
  const session = await loadSession(req.raw);
  const res = await next(req.withCtx({ session }));
  return attachSession(res, session);
};
```

#### Flash в props Inertia

Хелпер `inertia()` автоматически добавляет flash-сообщения в props:

```ts
export function inertia(req: HiusRequest, component: string, props = {}): Response {
  const session = req.ctx.session as Session | undefined;
  const flash = session ? {
    success: session.getFlash("success"),
    error:   session.getFlash("error"),
  } : {};

  const page = { component, props: { ...props, flash }, url: req.pathname, version: ASSET_VERSION };
  // ... остальная реализация
}
```

Использование в контроллере:

```ts
async store(req: HiusRequest): Promise<Response> {
  const session = req.ctx.session as Session;
  try {
    await this.posts.create(await req.json());
    session.flash("success", "Post created");
    return redirect("/posts");
  } catch {
    session.flash("error", "Validation failed");
    return redirect("/posts/new");
  }
}
```

В Svelte-компоненте:

```svelte
<script>
  export let flash: { success?: string; error?: string };
</script>

{#if flash.success}
  <div class="alert success">{flash.success}</div>
{/if}
```

---

### Фаза C — CSRF-защита

**Цель:** защита форм от межсайтовой подделки запросов.

```ts
// src/http/csrf/csrf.pipe.ts
export const CsrfPipe: Pipe = async (req, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const token = req.raw.headers.get("X-CSRF-Token")
      ?? (await req.json<{ _csrf?: string }>())._csrf;
    if (!isValidCsrfToken(token, req)) {
      return forbidden();
    }
  }
  return next(req);
};
```

Inertia автоматически отправляет CSRF-токен из мета-тега:

```html
<meta name="csrf-token" content="{{ csrfToken }}" />
```

Настройка `@inertiajs/svelte` для отправки токена в каждом запросе:

```ts
import axios from "axios";
axios.defaults.headers.common["X-CSRF-Token"] =
  document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
```

---

### Фаза D — Inertia SSR (опционально)

**Цель:** серверный рендеринг Svelte-компонентов для SEO и ускорения первой загрузки.

Svelte поддерживает SSR через `component.render(props)`. Хелпер `inertia()` может вызывать
его при первом запросе вместо возврата пустого shell:

```ts
import { renderToString } from "@svelte/server"; // зависит от версии Svelte

async function renderSSR(component: string, props: Record<string, unknown>): Promise<string> {
  const mod = await import(`../../frontend/Pages/${component}.svelte`);
  const { html, head } = mod.default.render(props);
  return rootLayout(page, { ssrBody: html, ssrHead: head });
}
```

> **Примечание:** Inertia SSR требует отдельного Node/Bun-сервера для обработки
> запросов серверного рендеринга. Подробнее — в [официальной документации Inertia SSR](https://inertiajs.com/server-side-rendering).

---

## Сводка

| Фаза | Что даёт | Усилия |
|------|---------|--------|
| A — Минимум | хелпер `inertia()`, Svelte страницы, статика | ~150 строк |
| B — Сессии | flash-сообщения, redirect-after-POST | ~200 строк |
| C — CSRF | защита форм | ~50 строк |
| D — SSR | SEO, быстрая первая загрузка | значительные |

Фазы A–C дают полноценный DX уровня AdonisJS. Фаза D опциональна и может быть
отложена до появления требований к SEO.
