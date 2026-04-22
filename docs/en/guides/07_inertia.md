# Inertia.js Integration

Inertia.js is a protocol that lets you build single-page applications using server-side routing and controllers — without building a separate API. Hius acts as the server, Svelte (or Vue/React) handles the UI.

## How It Works

```
First request (full page load):
  Browser → GET /posts
  Hius    → HTML shell + embedded { component: "Posts/Index", props: { posts } }
  Client  → Inertia boots, renders Posts/Index.svelte with props

Navigation (SPA, no full reload):
  Browser → GET /posts/1  [X-Inertia: true header]
  Hius    → JSON { component: "Posts/Show", props: { post }, url: "/posts/1" }
  Client  → Inertia swaps component, updates URL
```

The controller never knows about Svelte. It returns data; Inertia handles the rendering.

## Implementation Phases

### Phase A — Minimal Working Integration

**Goal:** `inertia()` helper + asset serving. Enough to render a page.

#### 1. Install `@inertiajs/svelte`

```sh
bun add @inertiajs/svelte
```

#### 2. Add the `inertia()` response helper

Create `src/http/inertia/inertia.ts`:

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

  // Inertia XHR request — return JSON only
  if (req.raw.headers.get("X-Inertia")) {
    return new Response(JSON.stringify(page), {
      headers: {
        "Content-Type": "application/json",
        "X-Inertia": "true",
        Vary: "Accept",
      },
    });
  }

  // First visit — return full HTML shell
  return new Response(rootLayout(page), {
    headers: { "Content-Type": "text/html" },
  });
}
```

#### 3. Serve static assets

In `src/http/server.ts`, configure `Bun.serve()` to serve the compiled frontend:

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

#### 4. Write the Svelte entry point

```
frontend/
  app.ts           ← Inertia bootstrap
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

#### 5. Use `inertia()` in a controller

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

#### 6. Build the frontend

```sh
bun build frontend/app.ts --outdir frontend/dist --target browser
```

Add to `mise.toml`:

```toml
[tasks."frontend:build"]
description = "Build Svelte frontend for production"
run = "bun build frontend/app.ts --outdir frontend/dist --target browser"

[tasks."frontend:dev"]
description = "Watch and rebuild frontend on change"
run = "bun build frontend/app.ts --outdir frontend/dist --target browser --watch"
```

---

### Phase B — Session and Flash Messages

**Goal:** POST → redirect → success/error message. The standard form flow.

#### Session middleware

```ts
// src/http/session/session.ts
export interface Session {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  flash(key: string, value: unknown): void;
  getFlash<T>(key: string): T | undefined;
}
```

Sessions are stored in signed, encrypted cookies:

```ts
const SessionPipe: Pipe = async (req, next) => {
  const session = await loadSession(req.raw);
  const res = await next(req.withCtx({ session }));
  return attachSession(res, session);
};
```

#### Flash in Inertia props

The `inertia()` helper automatically merges flash messages into props:

```ts
export function inertia(req: HiusRequest, component: string, props = {}): Response {
  const session = req.ctx.session as Session | undefined;
  const flash = session ? {
    success: session.getFlash("success"),
    error:   session.getFlash("error"),
  } : {};

  const page = { component, props: { ...props, flash }, url: req.pathname, version: ASSET_VERSION };
  // ... rest of implementation
}
```

Usage in controller:

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

In the Svelte component:

```svelte
<script>
  export let flash: { success?: string; error?: string };
</script>

{#if flash.success}
  <div class="alert success">{flash.success}</div>
{/if}
```

---

### Phase C — CSRF Protection

**Goal:** Protect form submissions from cross-site request forgery.

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

Inertia automatically sends the CSRF token from a meta tag:

```html
<meta name="csrf-token" content="{{ csrfToken }}" />
```

Configure `@inertiajs/svelte` to include it on every request:

```ts
import axios from "axios";
axios.defaults.headers.common["X-CSRF-Token"] =
  document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
```

---

### Phase D — Inertia SSR (Optional)

**Goal:** Server-side render Svelte components for SEO and initial page load performance.

Svelte supports SSR via `component.render(props)`. The `inertia()` helper can call this
on the first request instead of returning an empty shell:

```ts
import { renderToString } from "@svelte/server"; // hypothetical — depends on Svelte version

async function renderSSR(component: string, props: Record<string, unknown>): Promise<string> {
  const mod = await import(`../../frontend/Pages/${component}.svelte`);
  const { html, head } = mod.default.render(props);
  return rootLayout(page, { ssrBody: html, ssrHead: head });
}
```

> **Note:** Inertia SSR requires running a separate Node/Bun server that handles
> server-side rendering requests. See the [official Inertia SSR docs](https://inertiajs.com/server-side-rendering)
> for details.

---

## Summary

| Phase | What you get | Effort |
|-------|-------------|--------|
| A — Minimal | `inertia()` helper, Svelte pages, asset serving | ~150 lines |
| B — Sessions | Flash messages, redirect-after-POST | ~200 lines |
| C — CSRF | Secure form submissions | ~50 lines |
| D — SSR | SEO, faster initial load | significant |

Phases A–C give a full AdonisJS-like DX. Phase D is optional and can be deferred
until SEO becomes a requirement.
