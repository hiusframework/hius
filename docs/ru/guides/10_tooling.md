# Инструменты разработки

## Запуск задач: mise

Все основные задачи доступны через `mise run <задача>`:

```sh
mise run dev           # Запустить dev-сервер с hot reload
mise run test          # Запустить все тесты
mise run typecheck     # Проверка типов TypeScript (без эмита)
mise run lint          # Линтер Biome
mise run format        # Форматирование Biome (записывает файлы)
mise run check         # Lint + format проверка (только чтение, для CI)
mise run check:fix     # Lint + format с авто-исправлением (включая unsafe)
mise run ci            # Полный CI-пайплайн: check + typecheck + test + docs:sync

mise run db:generate   # Сгенерировать миграции Drizzle
mise run db:migrate    # Применить ожидающие миграции
mise run db:studio     # Открыть Drizzle Studio (визуальный браузер БД)
mise run db:push       # Применить схему напрямую к БД (только для разработки)

mise run docs:sync     # Проверить синхронизацию EN и RU документации
mise run hooks:install # Установить git-хуки Lefthook
```

## Линтер и форматирование: Biome

Hius использует [Biome](https://biomejs.dev) для линтинга и форматирования.

Конфигурация в `biome.json`. Ключевые правила:

- Двойные кавычки, отступ 2 пробела, ширина строки 100 символов
- `noUnusedImports` — ошибка
- `useImportType` — обязательный `import type` для импортов только типов
- `noExplicitAny` — предупреждение (подавляется через `biome-ignore` там, где неизбежно)

### Запуск вручную

```sh
# Только проверка (без записи) — используется в CI
bunx biome check src/ index.ts

# Проверка + авто-исправление (только безопасные правки)
bunx biome check --write src/ index.ts

# Проверка + авто-исправление (все правки включая unsafe)
bunx biome check --write --unsafe src/ index.ts
```

## Git-хуки: Lefthook

[Lefthook](https://lefthook.dev) запускает линтер и тесты перед каждым коммитом.

### Установка хуков

```sh
mise run hooks:install
# или
bunx lefthook install
```

### Что запускается при `git commit`

Обе задачи выполняются параллельно:

| Хук | Команда |
|-----|---------|
| `lint` | `bunx biome check src/ index.ts drizzle.config.ts` |
| `test` | `bun test` |

`stage_fixed: true` — если Biome автоматически исправляет staged-файлы, исправления добавляются в коммит.

### Пропуск хуков (только в экстренных случаях)

```sh
git commit --no-verify -m "message"
```

Используйте редко. CI-пайплайн (`mise run ci`) проверяет то же самое.

## Проверка типов: tsc

```sh
mise run typecheck
# или
bunx tsc --noEmit
```

Hius использует `strict: true` с path aliases (`@/*` → `src/*`). Смотрите `tsconfig.json`.

## Тест-раннер: bun test

```sh
bun test                               # Все тесты
bun test src/test/http/                # Директория
bun test src/test/http/router.test.ts  # Один файл
bun test --watch                       # Режим слежения
```

Подробнее в [Тестирование](06_testing.md).
