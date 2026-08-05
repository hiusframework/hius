# @hius/spec

[Русский](README.ru.md)

Zod schemas and TypeScript types for two things every other Hius package
builds on: the **intent/fact model** and the **Contract Specification**.
This package is deliberately a leaf — it doesn't import from the runtime
(`hius`) or the validator (`@hius/core`) that consume these shapes, so
anything depending on `@hius/spec` never pulls in a real runtime as a
side effect.

See [Architecture](../../docs/en/architecture.md) for the reasoning
behind the intent/fact split and contracts; this README is about the
shapes themselves.

## Intent: `module.config.ts`

```ts
import { defineModuleConfig } from "@hius/spec";

export default defineModuleConfig({
  name: "billing",
  publicApi: ["./citadel/contracts/ChargeCustomer"],
  allowedDependencies: ["users"],
  // publicErrors defaults to []
});
```

`defineModuleConfig` validates at definition time — a typo'd field
fails immediately, at the point you wrote it, not later when something
tries to read a field that isn't there.

## Fact: the extracted manifest

`ExtractedManifestSchema` (and `ExtractedDomainSchema`, `DomainFilesSchema`
within it) is the shape `hius`'s ts-morph-based extraction produces —
what a domain's code actually imports and exports, discovered by walking
the real file tree, not declared by hand. `@hius/core`'s validator
compares this against every domain's `ModuleConfig`.

## Contracts

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

A contract is a named, versioned, Zod-typed input/output pair,
conventionally the default export of a `citadel/contracts/*.ts` file.
`defineContract` validates the name is non-empty, the version is real
semver, and `input`/`output` are actual Zod schema instances — the same
fail-fast-at-authoring-time role `defineModuleConfig` plays for module
configs.

`bindContract(contract, handler)` pairs a contract with the function that
actually serves it — the shape both
[`@hius/mcp-adapter`](../mcp-adapter/README.md) and
[`@hius/rpc`](../rpc/README.md) consume. It's here, not in either
adapter, because both need the exact same pairing:

```ts
import { bindContract } from "@hius/spec";
import ChargeCustomerContract from "./citadel/contracts/charge-customer";

const binding = bindContract(ChargeCustomerContract, async (input) => {
  // input is typed from ChargeCustomerContract's own input schema
  return { chargeId: `ch_${input.customerId}` };
});
```

## What lives where

| Export | What it's for |
|---|---|
| `ModuleConfigSchema` / `ModuleConfig` / `defineModuleConfig` | The hand-written intent per domain |
| `DomainFilesSchema` / `DomainFiles` | File-convention buckets (routes, events, jobs, models, citadel, fortress, contracts) |
| `ExtractedDomainSchema` / `ExtractedManifestSchema` | The statically-extracted fact `@hius/core` validates against |
| `Contract` / `defineContract` | A domain operation's versioned input/output shape |
| `ContractBinding` / `bindContract` | Pairs a contract with its Fortress-side handler |
