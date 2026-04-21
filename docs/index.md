# Hius Guides

Hius — TypeScript-first backend framework для DDD и event-driven архитектур.
Оптимизирован для LLM-friendly разработки и контроля над распределёнными системами.

## С чего начать

- [Getting Started](guides/01_getting_started.md) — установка, первое приложение, запуск

## Ядро

- [Modules & Dependency Injection](guides/02_modules_and_di.md) — модульная система, DI-контейнер, жизненный цикл

## База данных

- [Database Setup](guides/03_database.md) — подключение к PostgreSQL, Drizzle ORM, переменные окружения
- [Schema & Migrations](guides/04_schema_and_migrations.md) — описание схемы, создание таблиц, миграции

## Безопасность

- [Encryption](guides/05_encryption.md) — AES-256-GCM, blind index, детерминированное шифрование

## Тестирование

- [Testing](guides/06_testing.md) — Bun test runner, in-memory репозитории, тестирование шифрования

---

> Guides описывают **текущее состояние** реализации. По мере добавления фич (HTTP, CLI, events) появятся новые разделы.
