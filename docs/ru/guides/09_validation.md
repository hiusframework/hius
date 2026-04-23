# Валидация и Strong Parameters

Hius предоставляет два дополняющих инструмента для обработки входящих данных:

| Инструмент | Назначение | При ошибке |
|-----------|-----------|-----------|
| `validate()` | Валидация схемы через Zod | бросает → автоматически 422 |
| `permit()` / `permitQuery()` | Фильтрация по allow-list | неизвестные поля молча дропаются |

Используйте оба вместе: `permit()` ограничивает что входит, `validate()` проверяет что обязательно.

## `validate()` — Валидация схемы

Разбирает тело запроса по Zod-схеме. При ошибке роутер автоматически возвращает `422 Unprocessable Entity` с ошибками по полям.

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
  // data типизирован: { title: string; body: string; tags?: string[] }
  const post = await this.posts.create(data);
  return created(post);
}
```

### Ответ при ошибке

При невалидных данных роутер возвращает:

```json
// 422 Unprocessable Entity
{
  "errors": {
    "title": ["String must contain at least 1 character(s)"],
    "body":  ["Required"]
  }
}
```

### Невалидный JSON

Если тело нельзя разобрать как JSON, роутер возвращает `400 Bad Request`:

```json
{ "error": "Invalid JSON body" }
```

## `permit()` — Strong parameters (тело запроса)

Пропускает только явно перечисленные поля из тела запроса. Неизвестные поля молча дропаются — до контроллера они не доходят. Несоответствие типов также дропается.

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

### Поддерживаемые типы

| Дескриптор | Принимает | Приведение |
|------------|----------|------------|
| `"string"` | string | — |
| `"number"` | number, числовая строка | `"25"` → `25` |
| `"boolean"` | boolean, `"true"`, `"false"` | `"true"` → `true` |
| `"string[]"` | массив — не-строки дропаются | — |
| `"number[]"` | массив — строки приводятся | `["1","2"]` → `[1,2]` |
| `["a","b"] as const` | enum — только перечисленные строки | — |

### Поведение при некорректных данных

- **Неизвестное поле** → дропается молча
- **Неверный тип** → поле отсутствует в результате (не ошибка)
- **Невалидное значение enum** → поле отсутствует в результате
- **Тело не объект** → возвращает `{}`
- **Невалидный JSON** → возвращает `{}`

## `permitQuery()` — Strong parameters (строка запроса)

Та же логика allow-list для параметров URL. Синхронный — query-параметры всегда строки.

```ts
import { permitQuery } from "hius";

async index(req: HiusRequest): Promise<Response> {
  const { page, limit, sort } = permitQuery(req, {
    page:  "number",                  // ?page=2   → 2
    limit: "number",                  // ?limit=20 → 20
    sort:  ["asc", "desc"] as const,  // ?sort=asc → "asc"
  });
  const posts = await this.posts.paginate({ page, limit, sort });
  return ok(posts);
}
```

## Совместное использование

`permit()` ограничивает allow-list; `validate()` проверяет обязательные поля и бизнес-правила. Можно использовать Zod напрямую — он по умолчанию дропает неизвестные ключи:

```ts
// Zod стрипает неизвестные ключи по умолчанию — permit() не нужен в простых случаях
const data = await validate(req, z.object({
  title: z.string().min(1),
  body:  z.string().min(10),
}));
// 'role', 'isAdmin' и т.д. стрипаются Zod автоматически
```

Используйте `permit()` когда нужно явное приведение типов по полям (например, query-строки где всё приходит как string) или когда хотите проверить allow-list до того, как Zod увидит данные.

## `ValidationError`

Если нужно бросить ошибки валидации вручную:

```ts
import { ValidationError } from "hius";

throw new ValidationError({
  email: ["Email уже занят"],
});
// Роутер перехватывает → 422 { errors: { email: ["Email уже занят"] } }
```
