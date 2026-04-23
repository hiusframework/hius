# Validation & Strong Parameters

Hius provides two complementary tools for handling incoming data:

| Tool | Purpose | On invalid |
|------|---------|-----------|
| `validate()` | Schema validation via Zod | throws → 422 automatically |
| `permit()` / `permitQuery()` | Allow-list filtering | drops unknown fields silently |

Use both together: `permit()` to restrict what enters, `validate()` to enforce what's required.

## `validate()` — Schema validation

Parses the request body against a Zod schema. On failure, the router automatically returns `422 Unprocessable Entity` with field-level errors.

```ts
import { z } from "zod";
import { validate, created } from "hius";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body:  z.string().min(1),
  tags:  z.array(z.string()).optional(),
});

async create(req: HiusRequest): Promise<Response> {
  const data = await validate(req, CreatePostSchema);
  // data is typed: { title: string; body: string; tags?: string[] }
  const post = await this.posts.create(data);
  return created(post);
}
```

### Error response

On invalid input, the router returns:

```json
// 422 Unprocessable Entity
{
  "errors": {
    "title": ["String must contain at least 1 character(s)"],
    "body":  ["Required"]
  }
}
```

### Non-JSON body

If the body cannot be parsed as JSON, the router returns `400 Bad Request`:

```json
{ "error": "Invalid JSON body" }
```

## `permit()` — Strong parameters (body)

Passes only the explicitly listed fields from the request body. Unknown fields are silently dropped — they never reach the controller. Type mismatches are also dropped silently.

```ts
import { permit } from "hius";

async update(req: HiusRequest): Promise<Response> {
  const attrs = await permit(req, {
    title:    "string",
    status:   ["draft", "published", "archived"] as const,
    priority: "number",
    featured: "boolean",
  });
  // attrs: { title?: string; status?: "draft"|"published"|"archived"; priority?: number; featured?: boolean }
  const post = await this.posts.update(req.params.id, attrs);
  return ok(post);
}
```

### Supported types

| Type descriptor | Accepts | Coerces |
|----------------|---------|---------|
| `"string"` | string | — |
| `"number"` | number, numeric string | `"25"` → `25` |
| `"boolean"` | boolean, `"true"`, `"false"` | `"true"` → `true` |
| `"string[]"` | array — non-string elements dropped | — |
| `"number[]"` | array — string elements coerced | `["1","2"]` → `[1,2]` |
| `["a","b"] as const` | enum — only listed strings pass | — |

### Behaviour on bad input

- **Unknown field** → dropped silently
- **Wrong type** → field absent from result (not an error)
- **Invalid enum value** → field absent from result
- **Non-object body** → returns `{}`
- **Invalid JSON** → returns `{}`

## `permitQuery()` — Strong parameters (query string)

Same allow-list logic for URL query parameters. Synchronous — query params are always strings.

```ts
import { permitQuery } from "hius";

async index(req: HiusRequest): Promise<Response> {
  const { page, limit, sort } = permitQuery(req, {
    page:  "number",            // ?page=2   → 2
    limit: "number",            // ?limit=20 → 20
    sort:  ["asc", "desc"] as const, // ?sort=asc → "asc"
  });
  const posts = await this.posts.paginate({ page, limit, sort });
  return ok(posts);
}
```

## Using both together

`permit()` restricts the allow-list; `validate()` enforces required fields and business rules. Compose them:

```ts
async create(req: HiusRequest): Promise<Response> {
  // 1. Strip unknown fields first
  const raw = await permit(req, {
    title:  "string",
    body:   "string",
    status: ["draft", "published"] as const,
  });

  // 2. Validate presence and format
  const data = await validate(
    { ...req, json: async () => raw } as unknown as HiusRequest,
    z.object({
      title:  z.string().min(1),
      body:   z.string().min(10),
      status: z.enum(["draft", "published"]).default("draft"),
    }),
  );

  return created(await this.posts.create(data));
}
```

Or use `validate()` alone with `.strip()` via Zod (Zod strips unknown keys by default):

```ts
// Zod strips unknown keys by default — no need for permit() in simple cases
const data = await validate(req, z.object({
  title: z.string().min(1),
  body:  z.string().min(10),
}));
// 'role', 'isAdmin', etc. are stripped by Zod automatically
```

Use `permit()` when you need explicit field-level type coercion (e.g., query strings where everything arrives as a string) or when you want the allow-list enforced before Zod even sees the data.

## `ValidationError`

If you need to throw validation errors manually:

```ts
import { ValidationError } from "hius";

throw new ValidationError({
  email: ["Email is already taken"],
});
// Router catches this → 422 { errors: { email: ["Email is already taken"] } }
```
