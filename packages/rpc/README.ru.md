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

На сегодня реализован только `createLocalTransport` — прямой вызов внутри
процесса, для случая, когда Fortress и Citadel работают в одном процессе.
Транспорт, проксирующий через границу развёрнутых контуров
Fortress/Citadel — вторая реализация `RpcTransport`, которую можно
добавить, как только этот протокол будет определён; `client.call(...)`
выглядит одинаково в обоих случаях.
