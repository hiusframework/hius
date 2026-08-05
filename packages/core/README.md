# @hius/core

[Русский](README.ru.md)

The boundary validator and the contract semver diff. This package has one
hard rule, enforced by its own dependency shape: it only ever sees the
**manifest** — `@hius/spec`'s types — never the runtime that produced it,
and never a real filesystem. That's what keeps a validation or a diff
runnable in CI without executing any application code. See
[Architecture](../../docs/en/architecture.md#intent-and-fact) for why the
manifest is treated as ground truth.

## `validate()` — the boundary validator

```ts
import { validate } from "@hius/core";

const result = validate(moduleConfigs, extractedManifest);
// { ok: boolean; violations: Violation[] }
```

Compares every domain's hand-written `ModuleConfig` (intent) against the
statically-extracted `ExtractedManifest` (fact) and reports every
divergence as a `Violation`:

| `kind` | When |
|---|---|
| `missing-config` | A domain exists in the manifest with no `module.config.ts` |
| `undeclared-dependency` | A domain imports from another domain not listed in its `allowedDependencies` |
| `circular-dependency` | Two or more domains depend on each other in a cycle |
| `shared-depends-on-domain` | The `shared` domain imports from a regular domain (it must be a leaf) |
| `shared-domain-specific-export` | `shared` exports something whose name references a specific domain |

Every violation's `message` is a corrective error, not just a diagnostic
— it names what to change and where. This is what `hius validate` and
the [dev MCP server](../mcp/README.md)'s `validate_change` tool both run
underneath.

## `diffContracts()` — contract semver diff

```ts
import { diffContracts } from "@hius/core";

const result = diffContracts(beforeContracts, afterContracts);
// { severity: "patch" | "minor" | "major" | null; changes: ContractChange[] }
```

Compares two `Contract[]` snapshots (matched by `name`) and classifies
every change by diffing their JSON Schema shapes (via Zod's
`z.toJSONSchema`):

- **`minor`** — a contract present in `after` but not `before` (a new
  operation).
- **`major`** — a contract removed, a field removed, a field's type
  changed, an optional field turned required, or a new *required* field
  appeared.
- **`patch`** — a new *optional* field, or a required field turned
  optional.

`severity` is the highest severity across every individual change, or
`null` if nothing changed. This is the engine behind `hius contract
diff` — see the [`@hius/cli` README](../cli/README.md) for the command
itself.
