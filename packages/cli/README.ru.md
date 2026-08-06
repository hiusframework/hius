# @hius/cli

[English](README.md)

Команда `hius`. Каждая команда здесь — тонкая обёртка над
[`hius`](../hius/README.ru.md) (рантаймом) и [`@hius/core`](../core/README.ru.md)
— ничто в этом пакете не содержит собственной логики валидации или
извлечения, он лишь даёт им CLI-поверхность и оформленный вывод
([consola](https://github.com/unjs/consola)).

Полный сценарий — в [Быстром старте](../../docs/ru/getting-started.md).
Этот README — справочник по каждой команде.

## `hius validate`

```bash
hius validate [--dir domains]
```

Сравнивает `module.config.ts` каждого домена с его реальным графом
импортов. Завершается ненулевым кодом, печатая корректирующее сообщение
для каждого нарушения, если что-то не совпало.

## `hius console` / `hius console --app <domain>`

JS REPL (на основе `node:readline` — настоящая история, Home/End, `\` или
Shift+Enter для переноса на новую строку) с манифестом приложения,
конфигами модулей, шиной событий и подключением к базе данных, уже
доступными в scope. `--app <domain>` ограничивает контекст одним доменом
вместо всего приложения.

## `hius db`

```bash
hius db                # SQL-консоль (без аргументов — то же, что hius db console)
hius db generate [...] # drizzle-kit generate, аргументы пробрасываются как есть
hius db migrate [...]  # drizzle-kit migrate, аргументы пробрасываются как есть
hius db studio [...]   # drizzle-kit studio, аргументы пробрасываются как есть
```

`generate`/`migrate`/`studio` — тонкие обёртки над `drizzle-kit`
(`bunx drizzle-kit <subcommand> ...`) — drizzle-kit уже сам умеет находить
конфиг, подключаться к базе и обрабатывать интерактивные подтверждения;
переизобретать это означало бы просто получить вторую, худшую копию.
Команды под `hius db` существуют ради обнаруживаемости, не более того.

## `hius generate <subcommand>`

Каждый генератор либо создаёт новые файлы, либо печатает одну строку,
которую нужно вставить в файл, которым вы уже владеете — ни один из них
не патчит существующий файл текстом.

| Подкоманда | Пример | Создаёт |
|---|---|---|
| `domain <name>` | `hius generate domain billing` | `module.config.ts`, `citadel/README.md`, `fortress/README.md` |
| `use-case <domain> <name>` | `hius generate use-case billing ChargeCustomer` | Use case в citadel + тест |
| `endpoint <domain> <method> <path>` | `hius generate endpoint billing POST /invoices` | HTTP-обработчик в fortress + строку `r.post(...)` для добавления |
| `event <domain> <name>` | `hius generate event billing invoice.paid` | Обработчик события в citadel + строку `bus.on(...)` для добавления |
| `mcp-tool <domain> <operation>` | `hius generate mcp-tool billing ChargeCustomer` | Заготовку контракта + строку `bindContract(...)` для добавления |
| `model <domain> <Name> field:type ...` | `hius generate model billing Invoice amount:money status:string` | Drizzle-схему + тест |

Каждая подкоманда принимает `--dir <path>` (по умолчанию `domains`) и
`--force` (перезаписать вместо пропуска существующих файлов).

## `hius contract diff`

```bash
hius contract diff --dir domains --against <baseline domains/ dir>
```

Загружает контракты каждого домена из обеих директорий и запускает
`diffContracts()` из [`@hius/core`](../core/README.ru.md), печатая каждое
изменение с его серьёзностью. Завершается ненулевым кодом только при
`major` (breaking) изменении — `patch`/`minor` носят информационный
характер. Сравнение двух директорий, а не двух git-ref, оставляет саму
команду простой: baseline-checkout (worktree, второй клон) — забота CI,
который указывает на него через `--against`.
