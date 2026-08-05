# @hius/mcp-adapter

[English](README.md)

Application MCP Adapter — экспонирует собственные доменные
[контракты](../spec/README.ru.md#контракты) *развёрнутого* Hius-приложения
как MCP-инструменты, для внешних агентов, вызывающих приложение в
рантайме. Это не то же самое, что [`@hius/mcp`](../mcp/README.ru.md) —
dev/framework MCP, которым пользуется агент во время *разработки*
Hius-приложения — почему это два разных пакета, см.
[Архитектуру](../../docs/ru/architecture.md#два-mcp-поверхности). Этот
пакет живёт в Fortress и деплоится вместе с приложением.

## Использование

```ts
import { bindContract } from "@hius/spec";
import { createMcpAdapter } from "@hius/mcp-adapter";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import ChargeCustomerContract from "./billing/citadel/contracts/charge-customer";
import { chargeCustomer } from "./billing/citadel/use-cases/charge-customer";

const server = createMcpAdapter([
  bindContract(ChargeCustomerContract, async (input) => {
    const result = await chargeCustomer(input);
    return { chargeId: result.id };
  }),
]);

await server.connect(new StdioServerTransport());
```

`createMcpAdapter` регистрирует по одному MCP-инструменту на каждую
связку, именуя его в snake_case из PascalCase-имени контракта
(`ChargeCustomer` → `charge_customer`). Разбор входных данных и валидацию
выходных против собственных Zod-схем контракта берёт на себя сам MCP SDK
— обработчик, который бросает исключение, автоматически становится
результатом инструмента с `isError`, здесь не нужен собственный
try/catch. Поле, которого нет в контракте, никогда не попадёт к
вызывающей стороне: Zod по умолчанию отбрасывает нераспознанные ключи
объекта, так что возврат больше, чем обещает контракт, ничего не
раскрывает.

`bindContract` — из [`@hius/spec`](../spec/README.ru.md) — та же связка,
что использует и [`@hius/rpc`](../rpc/README.ru.md), поскольку оба
адаптера генерируются из одних и тех же контрактов.

## Генерация нового инструмента

```bash
hius generate mcp-tool billing ChargeCustomer
```

Создаёт заготовку контракта и печатает точный сниппет `bindContract(...)`
для добавления — см. [README `@hius/cli`](../cli/README.ru.md).
