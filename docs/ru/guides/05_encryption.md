# Шифрование

Hius использует явный, ORM-независимый слой шифрования. Никакой магии геттеров, никаких хуков ORM — шифрование происходит только через явные вызовы API.

## Архитектура

```
Repository
  ↓
Query Builder (AST)       ← eq("email", "x@y.com")
  ↓
Query Rewrite Engine      ← → WHERE email_hash = hmac("x@y.com")
  ↓
ORM Adapter (Drizzle)
  ↓
Database
```

Все компоненты находятся в `src/infra/encryption/`.

## Управление ключами

Ключи читаются из переменных окружения через `KeyProvider`:

```ts
import { createEnvKeyProvider } from "@/infra/encryption";

const provider = createEnvKeyProvider();
// читает ENCRYPTION_KEY, HMAC_KEY, KEY_ID из process.env
// опционально читает KEYRING_JSON с историческими ключами для decrypt
```

| Переменная | Описание |
|---|---|
| `ENCRYPTION_KEY` | AES-ключ в base64, 32 байта |
| `HMAC_KEY` | HMAC-ключ в base64, 32 байта |
| `KEY_ID` | Строковый идентификатор текущей версии ключа |
| `KEYRING_JSON` | Опциональный JSON-массив с историческими bundle `{ keyId, encryptionKey, hmacKey }` для ротации ключей |

`KEYRING_JSON` проще всего хранить в `.env` файле. Встраивать сырой JSON прямо в shell-команды или CI variables неудобно и легко ошибиться с кавычками, поэтому лучше держать готовый copy-paste пример в secrets manager или в `.env.example`.

Пример:

```env
KEYRING_JSON=[{"keyId":"v1-2026-04-21","encryptionKey":"q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s=","hmacKey":"u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7s="}]
```

Для тестов используйте `createStaticKeyProvider(bundle)` с фиксированными ключами.

## Шифрование

`CryptoEngine` оборачивает AES-256-GCM с версионированным форматом payload:

```
v1:<keyId>:<base64(iv|ciphertext|tag)>
```

```ts
import { createCryptoEngine, createEnvKeyProvider } from "@/infra/encryption";

const crypto = createCryptoEngine(createEnvKeyProvider());

const payload = crypto.encrypt("alice@example.com");
const plain   = crypto.decrypt(payload); // "alice@example.com"
```

Каждый вызов `encrypt()` использует новый случайный IV — одинаковый plaintext каждый раз даёт разный шифротекст.

`decrypt()` читает `keyId` из payload и запрашивает соответствующий ключ у provider, поэтому старые шифротексты остаются читаемыми после ротации, пока старый ключ остаётся в keyring.

## Blind index

Blind index — это HMAC от plaintext, используемый для поиска по зашифрованным полям без расшифровки.

```ts
import { createBlindIndex, createEnvKeyProvider } from "@/infra/encryption";

const index = createBlindIndex(createEnvKeyProvider());

index.compute("Alice@Example.COM"); // нормализация: lowercase + trim перед хешированием
index.compute("alice@example.com"); // одинаковый результат
```

Перед хешированием значение нормализуется (lowercase + trim), поэтому `Alice@Example.COM` и `alice@example.com` дают одинаковый хеш.

## Field registry

Registry маппит логические имена полей (то, что видит domain) на физические колонки БД:

```ts
import { createFieldRegistry } from "@/infra/encryption";

const registry = createFieldRegistry();

registry.register("users", {
  email: {
    encrypted: true,
    searchable: true,
    field: "email_encrypted",   // колонка с шифротекстом
    hashField: "email_hash",    // колонка с blind index
  },
});
```

## Перезапись запросов

`rewriteQuery` преобразует логические запросы в физические запросы к БД:

```ts
import { eq, rewriteQuery } from "@/infra/encryption";

const query     = eq("email", "alice@example.com");
const rewritten = rewriteQuery(query, "users", registry, blindIndex);
// → { type: "eq", column: "email_hash", value: "a3f9..." }
```

**Правила:**
- `eq` по searchable зашифрованному полю → переписывается в `hashField = blindIndex(value)`
- `eq` по non-searchable зашифрованному полю → **ошибка** (потребовал бы полный скан таблицы)
- `eq` по обычному полю → передаётся без изменений
- `and` / `or` → рекурсивно

## Drizzle adapter

`DrizzleAdapter` выполняет переписанный запрос против Drizzle-таблицы:

```ts
import { DrizzleAdapter, eq, rewriteQuery } from "@/infra/encryption";
import { db } from "@/infra/db/client";
import { users } from "@/infra/db/schema/users";

const adapter = new DrizzleAdapter(db);

const rewritten = rewriteQuery(eq("email", "alice@example.com"), "users", registry, index);
const row = await adapter.findOne(users, rewritten);
```

## Интеграция с репозиторием

`DrizzleUserRepository` принимает `CryptoEngine` и `BlindIndex` как отдельные аргументы конструктора — это разные зоны ответственности, и в будущем они могут использовать разные ключи.

```ts
import { createCryptoEngine, createBlindIndex, createEnvKeyProvider } from "@/infra/encryption";
import { DrizzleUserRepository } from "@/infra/db/repositories/user.repository";
import { db } from "@/infra/db/client";

const provider = createEnvKeyProvider();
const repo = new DrizzleUserRepository(
  db,
  createCryptoEngine(provider),
  createBlindIndex(provider),
);
```

Репозиторий берёт на себя все вызовы encrypt/decrypt/hash. Domain-слой (`UsersService`) получает и передаёт обычные объекты `User` — он никогда не взаимодействует с крипто напрямую.

## Backfill миграция

При миграции существующих plaintext-данных в зашифрованные колонки:

```ts
import { backfillRows } from "@/infra/encryption";

await backfillRows(
  plaintextRows,   // [{ id, plaintext }]
  crypto,
  blindIndex,
  async (results) => {
    // results: [{ id, encrypted, hash }]
    // записать обратно в БД батчами
  },
);
```

## Ограничения

- **Нет частичного поиска** — blind index поддерживает только точное совпадение. `LIKE`, префиксный или полнотекстовый поиск по зашифрованным полям невозможен.
- **Equality leakage** — две строки с одинаковым email дают одинаковый хеш. Атакующий с доступом к БД может подтвердить совпадение email двух пользователей, даже не имея HMAC-ключа.
- **Исторические ключи нужно хранить** — если удалить старый ключ из provider, все payload, зашифрованные этим ключом, перестанут расшифровываться.
- **Нормализация фиксирована** — `blindIndex` всегда применяет lowercase + trim. Изменение нормализации после записи данных сломает существующие поиски.
