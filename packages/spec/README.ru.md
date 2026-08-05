# @hius/spec

[English](README.md)

Zod-схемы и TypeScript-типы для двух вещей, на которых строятся все
остальные пакеты Hius: **модель намерения и факта** и **Contract
Specification**. Пакет намеренно остаётся листом — он не импортирует ни
рантайм (`hius`), ни валидатор (`@hius/core`), которые потребляют эти
формы, поэтому всё, что зависит от `@hius/spec`, никогда не тянет за собой
реальный рантайм как побочный эффект.

Рассуждения о разделении намерения и факта, а также о контрактах — в
[Архитектуре](../../docs/ru/architecture.md); этот README — про сами формы.

## Намерение: `module.config.ts`

```ts
import { defineModuleConfig } from "@hius/spec";

export default defineModuleConfig({
  name: "billing",
  publicApi: ["./citadel/contracts/ChargeCustomer"],
  allowedDependencies: ["users"],
  // publicErrors по умолчанию []
});
```

`defineModuleConfig` валидирует уже в момент определения — опечатка в поле
падает сразу, в том месте, где вы её написали, а не позже, когда что-то
попытается прочитать несуществующее поле.

## Факт: извлечённый манифест

`ExtractedManifestSchema` (и вложенные в неё `ExtractedDomainSchema`,
`DomainFilesSchema`) — это форма, которую производит извлечение через
ts-morph в `hius`: что код домена реально импортирует и экспортирует,
обнаруженное обходом настоящего дерева файлов, а не заявленное вручную.
Валидатор `@hius/core` сравнивает это с `ModuleConfig` каждого домена.

## Контракты

```ts
import { defineContract } from "@hius/spec";
import { z } from "zod";

export default defineContract({
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
});
```

Контракт — именованная, версионированная пара input/output на Zod-схемах,
по соглашению — default-экспорт файла `citadel/contracts/*.ts`.
`defineContract` проверяет, что имя не пустое, версия — настоящий semver, а
`input`/`output` — реальные экземпляры Zod-схем — та же роль fail-fast в
момент написания, что `defineModuleConfig` играет для конфигов модулей.

`bindContract(contract, handler)` связывает контракт с функцией, которая
его реально обслуживает — форма, которую потребляют и
[`@hius/mcp-adapter`](../mcp-adapter/README.ru.md), и
[`@hius/rpc`](../rpc/README.ru.md). Она здесь, а не в одном из адаптеров,
потому что обоим нужна ровно одна и та же пара:

```ts
import { bindContract } from "@hius/spec";
import ChargeCustomerContract from "./citadel/contracts/charge-customer";

const binding = bindContract(ChargeCustomerContract, async (input) => {
  // input типизирован из собственной input-схемы ChargeCustomerContract
  return { chargeId: `ch_${input.customerId}` };
});
```

## Что где лежит

| Экспорт | Для чего |
|---|---|
| `ModuleConfigSchema` / `ModuleConfig` / `defineModuleConfig` | Написанное вручную намерение каждого домена |
| `DomainFilesSchema` / `DomainFiles` | Категории по файловым соглашениям (routes, events, jobs, models, citadel, fortress, contracts) |
| `ExtractedDomainSchema` / `ExtractedManifestSchema` | Статически извлечённый факт, с которым сверяется `@hius/core` |
| `Contract` / `defineContract` | Версионированная форма input/output одной операции домена |
| `ContractBinding` / `bindContract` | Связывает контракт с его обработчиком на стороне Fortress |
