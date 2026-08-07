# @hius/rpc

[English](README.md)

RPC / Contract-Client Adapter — фреймворк-агностичный типобезопасный
клиент для вызова доменных операций из любого веб-фреймворка,
генерируемый из тех же [контрактов](../spec/README.ru.md#контракты), что
и [`@hius/mcp-adapter`](../mcp-adapter/README.ru.md). Один и тот же
источник, разное назначение: тот пакет экспонирует контракты как
MCP-инструменты для внешних агентов, этот даёт коду приложения
типобезопасный клиент для прямого вызова.

## Использование

```ts
import { bindContract } from "@hius/spec";
import { createLocalTransport, createRpcClient } from "@hius/rpc";
import ChargeCustomerContract from "./billing/citadel/contracts/charge-customer";
import { chargeCustomer } from "./billing/citadel/use-cases/charge-customer";

const transport = createLocalTransport([
  bindContract(ChargeCustomerContract, async (input) => {
    const result = await chargeCustomer(input);
    return { chargeId: result.id };
  }),
]);
const client = createRpcClient(transport);

const result = await client.call(ChargeCustomerContract, {
  customerId: "cust_1",
  amount: 100,
});
```

`client.call(contract, input)` принимает сам объект контракта, а не
строковое имя — input и output выводятся точно из схем именно этого
контракта в месте вызова, без генерации кода по методу на контракт. И
разбор входных данных (до запуска обработчика), и разбор выходных (после)
одновременно служат границей контракта: обработчик, вернувший лишние
внутренние поля, никогда не доносит их до вызывающей стороны — Zod
отбрасывает поля, которых нет в схеме.

## Транспорты

`RpcTransport` — единственный шов, который задуман заменяемым:

```ts
export type RpcTransport = {
  call<Input extends z.ZodType, Output extends z.ZodType>(
    contract: Contract<Input, Output>,
    input: z.infer<Input>,
  ): Promise<z.infer<Output>>;
};
```

Сегодня реализованы две — `client.call(...)` выглядит одинаково в обоих
случаях:

- **`createLocalTransport(bindings)`** — прямой вызов внутри процесса,
  для случая, когда вызывающий код и связки живут в одном процессе
  (Fortress и Citadel работают как монолит).
- **`createHttpTransport(baseUrl, options?)`** (клиент) +
  **`createHttpRpcServer(bindings)`** (сервер) — настоящий сетевой
  вызов, для случая, когда это не так: отдельно развёрнутый фронтенд,
  либо Fortress и Citadel разнесены по разным контурам. По умолчанию
  кодирует через [CBOR](https://cbor.io) (компактнее и быстрее в
  разборе, чем JSON, при этом по-прежнему без схемы — никакого
  `.proto`-подобного IDL, никакой генерации стабов), с доступным на
  обеих сторонах обычным JSON (`{ codec: jsonCodec }` на клиенте, или
  просто `Content-Type: application/json` — сервер определяет кодек на
  каждый запрос отдельно), чтобы вызов можно было посмотреть обычным
  curl при отладке. `createHttpRpcServer` возвращает route-дескрипторы
  для слияния с `defineRoutes` самого приложения — RPC-эндпоинт — это
  просто ещё несколько роутов на той же HTTP-поверхности Fortress, а не
  отдельный сервер.

  `OPTIONS /rpc` отвечает на вопрос "что здесь можно вызвать": имя,
  версия, описание и JSON-Schema форма input/output каждой связанной
  связки — минимальный встроенный discovery-эндпоинт, полезный для
  всего, что хочет самостоятельно узнать API без вручную поддерживаемого
  списка (внешний клиент, инструмент отладки, будущий шаг генерации
  кода).

Транспорт, проксирующий через gRPC или другой кросс-языковой
wire-формат — третья реализация `RpcTransport`, которую можно добавить,
если в этом появится реальная необходимость: ни `Contract`, ни
`bindContract` при этом не изменятся — так же, как их не пришлось менять
и для добавления HTTP-транспорта.

## mTLS

```ts
import { createHttpTransport, withMtls } from "@hius/rpc";

const transport = createHttpTransport("https://citadel.internal", {
  fetch: withMtls({
    cert: Bun.file("./certs/fortress-client.crt"),
    key: Bun.file("./certs/fortress-client.key"),
    ca: Bun.file("./certs/ca.crt"),
  }),
});
```

`withMtls(tls, fetch?)` оборачивает fetch-функцию так, чтобы каждый вызов
нёс заданный клиентский сертификат — ничего нового, `fetch`'s собственная
опция `tls` уже нативна для Bun; это просто задаёт её один раз, а не на
каждый вызов. Передавайте результат как `fetch`-опцию `createHttpTransport`
вместо глобального `fetch`. Серверная сторона — парная
[`tls`-опция `bootstrapHttp`](../hius/README.ru.md#http-явная-композиция-без-контейнера)
— выставьте там `requestCert: true` плюс `ca`, чтобы требовать и
проверять сертификат, который производит эта функция.

Переиспользован, а не построен с нуля — не случайно, стоит сказать прямо:
этот же транспорт несёт трафик и через границу безопасности
Fortress↔Citadel, когда приложение расщепляется на эту топологию — тот же
контракт, тот же кодек, тот же клиент, mTLS добавлен только на уровне
транспорта. Отдельный wire-протокол для этой границы (например, gRPC)
рассматривался и был отложен — не потому что невозможен, а потому что
означал бы вторую цепочку контракт→wire-формат рядом с этой ради
возможности, которая у этой уже и так есть, плюс зависимость от тулинга
(кодогенерация protobuf, HTTP/2-стек), без которого фреймворк иначе
прекрасно обходится.

## Ошибки

При не-2xx ответе `createHttpTransport` бросает `RpcError` — с `status`
и, если сервер их прислал, теми же `code` и (для ошибки валидации)
структурированными `issues`, что уже несут [доменные ошибки Hius и
`ValidationError`](../hius/README.ru.md#маппинг-ошибок) — а не просто
сплющенное английское сообщение:

```ts
import { RpcError } from "@hius/rpc";

try {
  await client.call(ChargeCustomerContract, input);
} catch (error) {
  if (error instanceof RpcError && error.code === "VALIDATION_FAILED") {
    // error.issues: [{ path: ["amount"], code: "too_small", message: "..." }]
  }
}
```

Доменная ошибка, брошенная внутри обработчика, привязанного через
`bindContract` (например, `ConflictError` из use case), маппится на
подходящий HTTP-статус и несёт свой `code` через сеть точно так же, как
это уже делает обычный HTTP-роутер — она не сплющивается в непрозрачный
500, в отличие от действительно немаппированной ошибки, которая
по-прежнему становится 500.
