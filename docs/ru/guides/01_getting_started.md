# Начало работы с Hius

Это руководство охватывает всё необходимое для запуска приложения на Hius.

## Требования

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 14

## Установка

```sh
git clone <repo>
cd hius
bun install
```

## Переменные окружения

Скопируйте пример файла окружения и заполните значения:

```sh
cp .env.example .env
```

Обязательные переменные:

| Переменная                        | Описание                                         |
|-----------------------------------|--------------------------------------------------|
| `DATABASE_URL`                    | Строка подключения к PostgreSQL                  |
| `ENCRYPTION_KEY`                  | AES-ключ в формате base64, 32 байта              |
| `HMAC_KEY`                        | HMAC-ключ в формате base64, 32 байта             |
| `KEY_ID`                          | Идентификатор текущей версии ключа               |
| `KEYRING_JSON`                    | Опциональный JSON-массив исторических ключей для ротации |

### Генерация ключей

```sh
# ENCRYPTION_KEY
openssl rand -base64 32

# HMAC_KEY
openssl rand -base64 32

# KEY_ID — любая строка, например дата или версия
echo "v1-2026-04-21"
```

## Запуск проекта

```sh
# Режим разработки (hot reload)
bun dev

# Запуск конкретного файла
bun run src/index.ts
```

## Запуск тестов

```sh
bun test
```

## Структура проекта

```
src/
  core/              # Модульная система, DI-контейнер
  http/              # HTTP-слой (роутер, пайпы, валидация)
    core/            # HiusRequest, хелперы ответов, типы
    routing/         # DSL builder, path matcher, pipeline
    validation/      # validate(), permit(), permitQuery()
  infra/
    db/
      schema/        # Определения Drizzle-таблиц
      repositories/  # Реализации репозиториев через Drizzle
      client.ts      # Подключение к БД
    encryption/      # Слой шифрования (crypto, blind index, query rewrite)
  domain/            # Чистые доменные типы и интерфейсы
  app/               # Сервисы и контроллеры приложения
  config/            # Валидация переменных окружения
  test/              # Тесты
```

## Следующие шаги

- [Модули и внедрение зависимостей](02_modules_and_di.md)
- [Подключение к базе данных](03_database.md)
- [HTTP Роутинг](08_http_routing.md)
- [Валидация и Strong Parameters](09_validation.md)
- [Инструменты разработки](10_tooling.md)
