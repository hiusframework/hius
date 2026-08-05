# @hius/core

[English](README.md)

Валидатор границ и semver-diff контрактов. У пакета одно жёсткое правило,
закреплённое собственной формой зависимостей: он видит только
**манифест** — типы `@hius/spec` — никогда не рантайм, который его
породил, и никогда не настоящую файловую систему. Именно это позволяет
запускать валидацию или diff в CI без выполнения кода приложения. Почему
манифест считается источником истины — см.
[Архитектуру](../../docs/ru/architecture.md#намерение-и-факт).

## `validate()` — валидатор границ

```ts
import { validate } from "@hius/core";

const result = validate(moduleConfigs, extractedManifest);
// { ok: boolean; violations: Violation[] }
```

Сравнивает написанный вручную `ModuleConfig` (намерение) каждого домена со
статически извлечённым `ExtractedManifest` (факт) и сообщает о каждом
расхождении как о `Violation`:

| `kind` | Когда |
|---|---|
| `missing-config` | Домен есть в манифесте, но у него нет `module.config.ts` |
| `undeclared-dependency` | Домен импортирует из другого домена, не указанного в `allowedDependencies` |
| `circular-dependency` | Два или более доменов зависят друг от друга по циклу |
| `shared-depends-on-domain` | Домен `shared` импортирует из обычного домена (он обязан быть листом) |
| `shared-domain-specific-export` | `shared` экспортирует что-то, чьё имя ссылается на конкретный домен |

`message` каждого нарушения — корректирующая ошибка, а не просто
диагностика: она называет, что и где изменить. Именно это выполняют под
капотом и `hius validate`, и инструмент `validate_change`
[dev MCP-сервера](../mcp/README.ru.md).

## `diffContracts()` — semver-diff контрактов

```ts
import { diffContracts } from "@hius/core";

const result = diffContracts(beforeContracts, afterContracts);
// { severity: "patch" | "minor" | "major" | null; changes: ContractChange[] }
```

Сравнивает два снимка `Contract[]` (сопоставляя по `name`) и
классифицирует каждое изменение, сравнивая их формы JSON Schema (через
`z.toJSONSchema` из Zod):

- **`minor`** — контракт есть в `after`, но не было в `before` (новая
  операция).
- **`major`** — контракт удалён, поле удалено, изменился тип поля,
  опциональное поле стало обязательным, либо появилось новое
  *обязательное* поле.
- **`patch`** — новое *опциональное* поле, либо обязательное поле стало
  опциональным.

`severity` — максимальная серьёзность среди всех отдельных изменений, либо
`null`, если изменений не было. Это и есть движок, на котором работает
`hius contract diff` — про саму команду см. [README `@hius/cli`](../cli/README.ru.md).
