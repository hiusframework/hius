# hius

[English](README.md)

Рантайм: discovery, статическое извлечение, явная композиция для HTTP,
шина событий и outbox, Query AST и Encryption Layer. Именно поверх этого
пакета — тонкие обёртки `@hius/cli` и `@hius/mcp`; всё здесь можно
использовать напрямую как библиотеку, без CLI.

Концепции — в [Архитектуре](../../docs/ru/architecture.md); этот README —
карта того, что реально есть в пакете.

## Discovery и извлечение

```ts
import { discoverDomains, extractManifest, loadAllModuleConfigs, validateProject } from "hius";

const result = await validateProject("domains");
```

`discoverDomains` сканирует `domains/*` по файловым/каталоговым соглашениям
(`routes.ts`, `events.ts`, `jobs.ts`, `models/`, `citadel/`, `fortress/`,
`citadel/contracts/`). `extractManifest` прогоняет ts-morph по реальному
графу импортов, производя половину факта в
[модели намерения и факта](../../docs/ru/architecture.md#намерение-и-факт).
`validateProject` объединяет извлечение, загрузку конфигов и `validate()`
из [`@hius/core`](../core/README.ru.md) в один вызов, который выполняет
`hius validate`.

## Контракты

```ts
import { loadContracts, loadAllContracts } from "hius";

const billingContracts = await loadContracts("domains", "billing", ["citadel/contracts/charge-customer.ts"]);
const everyContract = await loadAllContracts("domains");
```

Загружает файлы `citadel/contracts/*.ts` (один вызов `defineContract()`,
default-экспорт, на файл) — то, что читают `hius contract diff` и
генерация [Application MCP Adapter](../mcp-adapter/README.ru.md).

## HTTP — явная композиция, без контейнера

```ts
import { defineRoutes, bootstrapHttp } from "hius";

const routes = defineRoutes((r) => {
  r.get("/health", async () => new Response("ok"));
  r.scope("/invoices", (r) => {
    r.post("/", createInvoice);
    r.get("/:id", showInvoice);
  });
  r.resources("/customers", { index: listCustomers, show: showCustomer });
});

const server = bootstrapHttp(routes, { port: 3000 });
```

Обработчики роутов — обычные функции `(req: HiusRequest) => Promise<Response>`
— никаких декораторов, никакого DI-контейнера, в котором нужно было бы
регистрировать класс контроллера. `permit`/`permitQuery` валидируют тела
запросов и query-параметры по схеме; `pipe`-ы явно композируют сквозную
логику (аутентификация, логирование) на уровне роута или scope.

## События и outbox

```ts
import { createEventBus, writeOutboxEvent, relayOutboxEvents } from "hius";

const bus = createEventBus();
bus.on("invoice.paid", async (payload) => { /* ... */ });

// в той же транзакции, что и изменение состояния, которое это вызвало:
await writeOutboxEvent(db, "invoice.paid", { invoiceId });

// процесс-релей, по интервалу или по внешнему триггеру:
await relayOutboxEvents(db, bus);
```

`createEventBus` — диспетчеризация внутри процесса. Outbox
(`hius_outbox_events`) — то, что делает доставку durable и at-least-once —
почему это значит, что каждый обработчик обязан быть идемпотентным, см.
[Архитектуру](../../docs/ru/architecture.md#события-outbox-и-гарантии-доставки).

## Query AST и Encryption Layer

```ts
import {
  createStaticKeyProvider, createCryptoEngine, createBlindIndex, createFieldRegistry,
  DrizzleAdapter, eq, and, rewriteQuery,
} from "hius";

const registry = createFieldRegistry();
registry.register("users", {
  email: { encrypted: true, searchable: true, field: "email_encrypted", hashField: "email_hash" },
});

const condition = rewriteQuery(eq("email", "alice@example.com"), "users", registry, blindIndex);
const row = await adapter.findOne(usersTable, condition);
```

Репозиторий пишет `eq("email", value)`, не зная, какие поля на самом деле
зашифрованы — `rewriteQuery` обращается к `FieldRegistry` и переписывает
условие в правильный предикат по хеш-колонке, разворачивая в `or` по всем
ключам-кандидатам, если идёт ротация ключей. `KeyProvider`
(`createStaticKeyProvider` для тестов, `createEnvKeyProvider` для реальных
деплоев) может хранить сразу несколько ключей именно по этой причине.

## Маппинг ошибок

```ts
import { withUniqueConstraintMapping, ConflictError } from "hius";

await withUniqueConstraintMapping(() => db.insert(users).values(newUser));
// бросает ConflictError вместо сырой ошибки unique-violation от Postgres
```

`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`,
`UnprocessableError` — словарь, из которого должны браться `publicErrors`
домена (в его `module.config.ts`) — осознанно названные ошибки, которым
разрешено пересекать границу домена, а не утечка сырых исключений
драйвера.
