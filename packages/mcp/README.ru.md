# @hius/mcp

[English](README.md)

Dev/framework MCP-сервер — для агента (Claude Code, Cursor и т. п.),
разрабатывающего Hius-приложение. Работает поверх того же движка
[`@hius/core`](../core/README.ru.md)/[`hius`](../hius/README.ru.md), что и
CLI. **Никогда не деплоится вместе с приложением** — почему это отдельный
пакет от [`@hius/mcp-adapter`](../mcp-adapter/README.ru.md), который
вместо этого экспонирует собственные операции приложения внешним агентам
в рантайме, см. [Архитектуру](../../docs/ru/architecture.md#два-mcp-поверхности).

## Запуск

```bash
bun packages/mcp/index.ts domains   # appsDir по умолчанию "domains"
```

Либо встроить напрямую:

```ts
import { createServer } from "@hius/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer("domains");
await server.connect(new StdioServerTransport());
```

## Инструменты

| Инструмент | Назначение |
|---|---|
| `get_architecture` | Полный граф всех доменов и их заявленных vs. реальных зависимостей |
| `get_domain(name)` | Context pack одного домена: публичный API, зависимости, файлы, экспорты — без утечки внутренностей других доменов |
| `get_contracts` | Все активные контракты во всех доменах — имя, версия, описание, JSON Schema входа/выхода |
| `where_does_event_go(eventName)` | Все обработчики, подписанные на событие — статическая трассировка вызовов `bus.on(eventName, ...)` по всем доменам, не рантайм-трейс |
| `validate_change` | Тот же движок, что запускает `hius validate`, вызываемый программно — при ошибке структурированное корректирующее сообщение, а не сырое исключение |

Границы домена здесь намеренно работают как граница контекста агента:
`get_domain` никогда не возвращает больше, чем манифест и конфиг именно
этого домена — та же дисциплина, которую валидатор границ применяет к
реальному коду.
