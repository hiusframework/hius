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
