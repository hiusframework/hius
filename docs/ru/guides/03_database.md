# Подключение к базе данных

## Стек

- **PostgreSQL** >= 14
- **Drizzle ORM** с адаптером `bun-sql`
- **Bun SQL** — встроенный PostgreSQL-клиент, без дополнительных пакетов

## Переменные окружения

Установите `DATABASE_URL` в файле `.env`:

```
DATABASE_URL=postgres://user:password@localhost:5432/hius_dev
```

Для тестов установите в `.env.test` (Bun загружает его автоматически при `bun test`):

```
DATABASE_URL=postgres://user:password@localhost:5432/hius_test
```

`src/config/env.ts` проверяет наличие `DATABASE_URL` при старте и немедленно выбрасывает ошибку, если переменная отсутствует.

## Инициализация клиента

Клиент находится в `src/infra/db/client.ts`:

```ts
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema/users.ts";

export const sql = new SQL(process.env["DATABASE_URL"]!);
export const db = drizzle({ client: sql, schema });

export type Db = typeof db;
```

Bun загружает `.env` автоматически — пакет `dotenv` не нужен.

Тип `Db` экспортируется, чтобы репозитории могли принимать его как аргумент конструктора без привязки к глобальному экземпляру `db`.

## Конфигурация Drizzle

`drizzle.config.ts` в корне проекта управляет генерацией миграций и Drizzle Studio:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Доступные команды

| Команда | Что делает |
|---|---|
| `mise run db:generate` | Генерирует файлы миграций из изменений схемы |
| `mise run db:migrate` | Применяет ожидающие миграции к базе данных |
| `mise run db:push` | Применяет схему напрямую без файлов миграций (только для разработки) |
| `mise run db:studio` | Открывает Drizzle Studio в браузере |

## Следующие шаги

- [Схема и миграции](04_schema_and_migrations.md)
