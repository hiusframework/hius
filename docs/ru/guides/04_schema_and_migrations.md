# Схема и миграции

## Определение схемы

Схемы находятся в `src/infra/db/schema/`. Каждый файл определяет одну или несколько Drizzle-таблиц с помощью `pgTable`.

### Таблица пользователей

`src/infra/db/schema/users.ts`:

```ts
import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:              uuid("id").primaryKey(),
  email_encrypted: text("email_encrypted").notNull(),
  email_hash:      text("email_hash").notNull().unique(),
  email_det:       text("email_det"),
  name:            text("name"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at:      timestamp("deleted_at", { withTimezone: true }),
});
```

**Соглашения для зашифрованных полей:**

| Поле | Назначение |
|---|---|
| `email_encrypted` | Шифротекст AES-256-GCM — само значение |
| `email_hash` | Blind index HMAC-SHA256 — используется в запросах `WHERE email = ?` |
| `email_det` | Опциональный детерминированный шифротекст — зарезервирован для exact-match сценариев, где допустима утечка дубликатов |

`deleted_at` реализует мягкое удаление — репозитории обязаны фильтровать `WHERE deleted_at IS NULL`.

## Добавление новой схемы

1. Создайте `src/infra/db/schema/your_model.ts`
2. Экспортируйте таблицу и выведенные типы (`$inferSelect`, `$inferInsert`)
3. `drizzle.config.ts` подхватит файл автоматически через glob `./src/infra/db/schema/*.ts`

## Генерация миграций

После изменения файла схемы сгенерируйте миграцию:

```sh
mise run db:generate
```

Drizzle сравнивает текущую схему с последним снимком и создаёт SQL-файл в `drizzle/`.

## Применение миграций

```sh
mise run db:migrate
```

Применяет все ожидающие файлы миграций по порядку. Безопасно запускать повторно — уже применённые миграции пропускаются.

## Dev-шорткат: push без файлов миграций

```sh
mise run db:push
```

Синхронизирует схему напрямую с БД без создания файлов миграций. Использовать только в разработке — никогда против общей или продакшн-базы.

## Просмотр базы данных

```sh
mise run db:studio
```

Открывает Drizzle Studio в браузере — визуальный браузер таблиц с возможностью чтения и записи.
