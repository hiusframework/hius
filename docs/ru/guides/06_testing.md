# Тестирование

Hius использует `bun test` как тест-раннер. Без Jest и Vitest.

## Запуск тестов

```sh
# Все тесты
bun test

# Один файл
bun test src/test/encryption.test.ts

# Watch-режим
bun test --watch
```

Bun автоматически загружает `.env.test` при запуске тестов — укажите там `DATABASE_URL` и крипто-ключи. Подробнее о настройке — в [Начале работы](01_getting_started.md).

## Структура тестов

```
src/test/
  users.test.ts       # Unit-тесты UsersService (in-memory репозиторий)
  encryption.test.ts  # Тесты всего слоя шифрования
```

## Что тестируется

### `encryption.test.ts`

| Тест | Что проверяет |
|---|---|
| encrypt → decrypt | Roundtrip AES-256-GCM |
| уникальный шифротекст | Случайный IV при каждом вызове |
| детерминизм blind index | Одинаковый вход → одинаковый хеш |
| нормализация blind index | `Alice@Example.COM` = `alice@example.com` |
| ротация ключей | Расшифровка старым ключом через keyring |
| неизвестный key id | Выбрасывает ошибку |
| query rewrite (searchable) | `eq("email", ...)` → колонка `email_hash` |
| query rewrite (обычное поле) | Передаётся без изменений |
| query rewrite (non-searchable) | Выбрасывает ошибку |
| рекурсия `and` / `or` | Составные условия переписываются корректно |

### `users.test.ts`

Использует in-memory репозиторий — реальная БД не нужна.

| Тест | Что проверяет |
|---|---|
| createUser + findByEmail | Сервис создаёт и находит по email |
| getByEmail (не найден) | Возвращает `null` для неизвестного email |
| getById | Сервис находит по id |

## Паттерн in-memory репозитория

Для unit-тестов без реальной БД реализуйте `UserRepository` через обычный массив:

```ts
function makeInMemoryRepo(): UserRepository {
  const store: User[] = [];
  return {
    async create(user) { store.push(user); },
    async findById(id) { return store.find((u) => u.id === id) ?? null; },
    async findByEmail(email) { return store.find((u) => u.email === email) ?? null; },
  };
}
```

## Интеграционные тесты

> 🚧 Не реализованы — отслеживается в [Roadmap Phase 10](../../ROADMAP.md).

Интеграционные тесты потребуют реальную PostgreSQL-базу. План:
- `.env.test` с отдельной базой `hius_test`
- `mise run db:migrate` против тестовой БД перед запуском сьюта
- Тестирование полного стека: `UsersService` → `DrizzleUserRepository` → шифрование → PostgreSQL
