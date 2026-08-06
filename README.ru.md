# Hius

[English](README.md)

Модульный, DDD-ориентированный TypeScript/Bun фреймворк — машиночитаемая
архитектура как полноценный артефакт, AI-native изначально. Монорепозиторий
на Bun workspaces.

Впервые здесь? Начните с [**Быстрого старта**](docs/ru/getting-started.md) —
реального, работающего сценария от скаффолдинга домена до того, как
валидатор границ ловит ошибку. [**Архитектура**](docs/ru/architecture.md)
раскрывает идеи, стоящие за этим, подробнее.

## Пакеты

| Пакет | Назначение |
|---|---|
| [`@hius/spec`](packages/spec/README.ru.md) | Zod-схемы модели манифеста (намерение/факт) и Contract Specification |
| [`@hius/core`](packages/core/README.ru.md) | Валидатор, граф зависимостей, contract diff — видит только манифест |
| [`hius`](packages/hius/README.ru.md) | Рантайм: discovery, явная композиция, события/outbox, извлечение через ts-morph, Query AST, Encryption Layer, HTTP |
| [`@hius/shared`](packages/shared/README.ru.md) | Общие типы value-object/утилиты, без бизнес-логики (заглушка — пока не наполнена) |
| [`@hius/cli`](packages/cli/README.ru.md) | Команда `hius` — validate, console, db, generate, contract diff |
| [`@hius/mcp`](packages/mcp/README.ru.md) | Dev/framework MCP-сервер — то же ядро, что у CLI, для агента, разрабатывающего Hius-приложение |
| [`@hius/mcp-adapter`](packages/mcp-adapter/README.ru.md) | Application MCP Adapter — экспонирует контракты развёрнутого приложения как MCP-инструменты |
| [`@hius/rpc`](packages/rpc/README.ru.md) | Фреймворк-агностичный типобезопасный contract-клиент |
| [`@hius/test-harness`](packages/test-harness/README.ru.md) | Хелперы для тестов на реальных зависимостях (Postgres, HTTP, ключи шифрования) для вашего собственного тестового набора |

## Разработка самого Hius

```bash
bun install
bun test
bunx tsc --noEmit
bunx biome check packages/ domains/ apps/
mise run hooks:install   # подключает pre-commit хуки Lefthook
```

Соглашения этого репозитория (язык документации, стиль коммитов) — в
[CLAUDE.md](CLAUDE.md).
