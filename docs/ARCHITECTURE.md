# HIUS FRAMEWORK — FULL ARCHITECTURE SPEC

## 1. Overview

Hius is a backend framework designed for:

- Domain-Driven Design (DDD)
- Event-driven systems
- LLM-friendly development
- Explicit architecture (no magic)

---

## 2. Core Architecture

```
Service → Repository → Encryption → ORM → Database
```

---

## 3. Design Principles

- Explicit over implicit
- No ORM magic
- Infrastructure isolation
- Deterministic behavior (LLM-friendly)
- Contracts-first design

---

## 4. Core Components

### 4.1 DI Container

- Constructor injection
- Scoped providers
- No global state

### 4.2 Module System

- Explicit dependencies
- No circular imports
- Bounded contexts

---

## 5. Database Layer

### Stack

- PostgreSQL
- Drizzle ORM
- Bun SQL driver

### Requirements

- UUID v7
- Soft delete (`deleted_at`)
- Multi-tenant ready (`tenant_id`)

---

## 6. Encryption System

### Goals

- Protect PII
- Enable queryability
- Avoid ORM coupling

---

### Crypto

- AES-256-GCM
- Random IV
- Authenticated encryption

Payload:

```
v1:<keyId>:<base64(iv|ciphertext|tag)>
```

---

### Blind Index

- HMAC-SHA256
- deterministic
- normalized input

---

### Key Management

Interface:

```
KeyProvider → { keyId, encryptionKey, hmacKey }
```

Default:

- env-based

Future:

- KMS
- multi-tenant keys

---

## 7. Query System

### AST

```
eq(field, value)
and([...])
or([...])
```

---

### Rewrite Engine

Rules:

- encrypted + searchable → use hash
- encrypted + not searchable → throw
- unsupported → throw

---

## 8. Field Registry

Central config:

```
registerModel("users", {
  email: {
    encrypted: true,
    searchable: true,
    field: "email_encrypted",
    hashField: "email_hash"
  }
})
```

---

## 9. ORM Layer

### Drizzle Adapter

- query execution
- field mapping

### Prisma Adapter

- interface only

---

## 10. Repository Pattern

- Domain defines interface
- Infra implements
- Encryption handled internally

---

## 11. Migration Strategy

### Steps

1. Dual read
2. Dual write
3. Backfill
4. Cleanup

Supports:

- Lockbox
- ActiveRecord Encryption

---

## 12. Boundary Enforcement

Inspired by Packwerk:

- module configs
- dependency rules
- static analysis

---

## 13. Testing

- Unit (services)
- Integration (DB)
- Crypto validation
- Query rewrite

---

## 14. Performance Considerations

- encryption overhead (low)
- hash index lookup (fast)
- no partial search support
- equality leakage (known tradeoff)

---

## 15. Future Extensions

- key rotation
- multi-tenant encryption
- deterministic encryption
- RBAC-based decryption
- event system
