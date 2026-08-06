# Быстрый старт

[English](../en/getting-started.md)

Здесь — сквозной пример: скаффолдинг домена, добавление use case и HTTP-эндпоинта,
их связывание и то, как валидатор границ ловит ошибку до того, как она станет
багом. Все команды ниже реальные — скопируйте и запустите, результат будет
именно таким, как показано.

## Требования

- [Bun](https://bun.com) — единственный рантайм, на который рассчитан Hius.
- PostgreSQL — только если хотите попробовать примеры с шифрованием полей и
  миграциями дальше по тексту. Всё остальное в этом руководстве работает без
  базы данных.

## Установка CLI

```bash
bun add -g hius @hius/cli
```

Это даёт команду `hius`. Всё, что она делает, доступно и как библиотечный
импорт (`import { validateProject } from "hius"`), если вам удобнее
скриптовать, а не работать интерактивно — CLI — это тонкая обёртка, а не
единственный способ работы с фреймворком.

## Скаффолдинг домена

```bash
hius generate domain billing
```

```
✔ domains/billing/module.config.ts
✔ domains/billing/citadel/README.md
✔ domains/billing/fortress/README.md
```

Это и есть форма, с которой начинается любой домен Hius:

```
domains/billing/
  module.config.ts   # что этот домен экспонирует и от чего может зависеть
  citadel/            # бизнес-логика, не зависящая от фреймворка
  fortress/            # код, осведомлённый о фреймворке — HTTP, адаптеры
```

**Citadel и Fortress** — две половины каждого домена. Citadel — это чистый
TypeScript, который ничего не импортирует ни из `hius`, ни из какого-либо
фреймворка — это бизнес-логика, и она остаётся тестируемой без HTTP, базы
данных и самого фреймворка, потому что даже не знает об их существовании.
Fortress — это место для HTTP-обработчиков, адаптеров баз данных и всего
прочего, что зависит от фреймворка. Валидатор границ (ниже) следит за этим
разделением на уровне статического анализа — это не просто соглашение об
именовании.

`module.config.ts` изначально пустой и ничем не ограниченный:

```ts
export default {
  name: "billing",
  publicApi: [],
  allowedDependencies: [],
};
```

Это **декларация намерения** домена — что ему разрешено импортировать, и
какие из его собственных экспортов публичны. Здесь ничего не выводится
автоматически — вы пишете это руками, а валидатор сверяет с реальным кодом.

## Добавляем use case и эндпоинт

```bash
hius generate use-case billing ChargeCustomer
hius generate endpoint billing POST /invoices
```

```
✔ domains/billing/citadel/use-cases/charge-customer.ts
✔ domains/billing/citadel/use-cases/test/charge-customer.test.ts
✔ domains/billing/fortress/http/post-invoices.ts
ℹ Wire it in: r.post("/invoices", postInvoices);
```

Обратите внимание: генератор не трогал `routes.ts` сам — вместо этого он
вывел строку, которую нужно добавить. Hius никогда не патчит текстом файл,
который уже принадлежит вам: генераторы либо создают новые файлы, либо
подсказывают одну строку для вставки. Добавьте эту строку в
`domains/billing/routes.ts` сами (создайте файл, если это первый роут домена):

```ts
import { defineRoutes } from "hius";
import { postInvoices } from "./fortress/http/post-invoices";

export const routes = defineRoutes((r) => {
  r.post("/invoices", postInvoices);
});
```

Здесь нет ни контейнера внедрения зависимостей, ни декораторов —
`postInvoices` — обычная функция, `r.post` принимает её напрямую. Так
работает любая точка связывания в Hius: явная композиция, без необходимости
трассировать контейнер, чтобы понять, что на самом деле вызывается.

## Валидатор ловит реальную ошибку

Допустим, `ChargeCustomer` должен найти пользователя, и вы обращаетесь к
домену `users` прямо из `billing`:

```bash
hius generate domain users
```

```ts
// domains/billing/citadel/use-cases/charge-customer.ts
import { findUser } from "../../../users/citadel/service";
```

Ничто не мешает написать такой импорт — но `module.config.ts` домена
`billing` никогда не заявлял, что ему разрешено зависеть от `users`.
Запускаем валидатор:

```bash
hius validate
```

```
ERROR  [Hius] boundary violation in billing:
  depends on users, which is not in its allowed dependencies
  → add users to module.config's allowedDependencies for billing
  → or route through a public contract/event if this dependency shouldn't exist
  (module.config for billing allows: (none))
```

Это и есть **модель намерения и факта**: `module.config.ts` — то, что вы
*задекларировали* (намерение), а `hius validate` статически извлекает то,
что код *на самом деле* импортирует (факт), обходя реальный граф импортов.
Любое расхождение — ошибка с готовым решением прямо в сообщении, а не
предупреждение линтера, которое можно проигнорировать. Исправляем,
декларируя зависимость:

```ts
export default {
  name: "billing",
  publicApi: [],
  allowedDependencies: ["users"],
};
```

```bash
hius validate
```

```
✔ validate: no boundary violations
```

Та же проверка работает как `validate_change` в [dev MCP-сервере](../../packages/mcp/README.ru.md) —
агент-разработчик получает точно такую же корректирующую ошибку до того, как
изменение вообще до вас дойдёт.

## События

```bash
hius generate event billing invoice.paid
```

```
✔ domains/billing/citadel/handlers/on-invoice-paid.ts
ℹ Wire it in: bus.on("invoice.paid", onInvoicePaid);
```

Сгенерированный обработчик несёт напоминание, которое стоит воспринимать
всерьёз: доставка через outbox — at-least-once, поэтому обработчик обязан
быть идемпотентным — безопасным при повторном запуске с тем же payload. Как
шина событий и outbox работают вместе — см. [`hius`](../../packages/hius/README.ru.md).

## Контракты, MCP-инструменты и RPC-клиент

```bash
hius generate mcp-tool billing charge-customer
```

```
✔ domains/billing/citadel/contracts/charge-customer.ts
ℹ Import the contract as ChargeCustomerContract, then wire it in:
bindContract(ChargeCustomerContract, async (input) => {
  throw new Error("ChargeCustomer is not implemented yet");
});
```

**Контракт** (`defineContract` из `@hius/spec`) — именованная, версионированная
пара input/output на Zod-схемах — единственный артефакт, из которого
генерируются и [Application MCP Adapter](../../packages/mcp-adapter/README.ru.md),
и [RPC-клиент](../../packages/rpc/README.ru.md). Ни один из адаптеров не
пишется вручную под каждую операцию — оба читают один и тот же контракт.
`hius contract diff` сравнивает две версии контрактов домена и
классифицирует каждое изменение как patch, minor или major — точные правила
см. в [README пакета cli](../../packages/cli/README.ru.md).

## Консоль и база данных

```bash
hius console                 # JS REPL с манифестом, конфигами и db приложения в scope
hius console --app billing   # в контексте одного домена
hius db                      # SQL-консоль
hius db generate             # drizzle-kit generate через hius
hius db migrate               # drizzle-kit migrate через hius
```

## Тестирование

[`@hius/test-harness`](../../packages/test-harness/README.ru.md) даёт вашим
собственным тестам те же строительные блоки на реальных зависимостях, что
использует и сам фреймворк: реальное подключение к Postgres с teardown,
фиксированный тестовый ключ шифрования и реальный HTTP-сервер на случайном
порту для end-to-end тестов. Никаких моков — это осознанное решение, почему
именно так — см. README пакета.

## Что дальше

- [Архитектура](architecture.md) — Citadel/Fortress, модель намерения и
  факта, принцип адаптеров подробнее.
- У каждого пакета в `packages/` есть собственный README с деталями,
  специфичными именно для него.
