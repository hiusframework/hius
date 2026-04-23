# HIUS FRAMEWORK — ROADMAP

## Phase 1 — Core Runtime ✅

### Goal: Stable foundation for DI + modules

- [x] Implement DI container (singleton scope)
- [x] Constructor injection support
- [x] Module system (imports/exports)
- [x] Bootstrap lifecycle (`bootstrapModule`)
- [x] Error handling (missing provider, invalid module)
- [ ] Transient scope _(deferred — not needed yet)_
- [ ] Circular dependency detection _(deferred)_

---

## Phase 2 — Domain Reference Implementation 🔶

### Goal: Validate DDD ergonomics

- [x] Users domain (entity, service, repository)
- [x] Manual wiring (no generator)
- [x] Validate developer experience
- [ ] Billing domain (entity, service) _(deferred — validate multi-domain later)_
- [ ] Domain separation (no cross imports) _(deferred — Phase 12)_

---

## Phase 3 — Database Layer ✅

### Goal: Production-ready persistence

- [x] Setup PostgreSQL connection (Bun SQL)
- [x] Integrate Drizzle ORM
- [x] Define schema:
  - [x] users table
  - [x] created_at / updated_at / deleted_at
- [x] Indexing strategy (email_hash unique index)
- [x] Keep the schema ready for future tenant scoping without adding tenant fields yet
- [ ] UUID strategy (v7) _(currently v4 — quick fix when needed)_

---

## Phase 4 — Encryption Layer ✅

### Goal: Secure PII storage

- [x] AES-256-GCM implementation
- [x] Versioned payload (`v1:<keyId>:<base64>`)
- [x] HMAC blind index
- [x] Field normalization (lowercase + trim, extracted to `normalize.ts`)
- [x] KeyProvider (env-based + keyring for rotation via `KEYRING_JSON`)
- [x] Key rotation support (decrypt resolves key by embedded `keyId`)
- [x] Test coverage (crypto correctness, rotation, error cases)
- [ ] Feature flag for deterministic encryption _(hook exists, disabled by default)_

---

## Phase 5 — Repository Layer ✅

### Goal: Clean DDD boundary

- [x] Repository interfaces (domain)
- [x] Drizzle implementations (infra)
- [x] Encryption integration
- [x] Soft delete filtering (`deleted_at IS NULL`)
- [x] Unit tests (in-memory repository)
- [ ] Integration tests (DB) _(Phase 10)_

---

## Phase 6 — Query System ✅

### Goal: ORM-agnostic query abstraction

- [x] Define Query AST (`eq`, `and`, `or`)
- [x] Implement rewrite engine (logical → physical columns)
- [x] Field registry (`registerModel`)
- [x] Error handling (non-searchable encrypted field throws, unsupported op throws)
- [x] Test query transformations

---

## Phase 7 — ORM Adapters ✅

### Goal: Multi-ORM support

- [x] Drizzle adapter (`findOne`, `findMany`)
- [x] Prisma adapter (interface only)
- [x] Mapping logical → physical fields (`getTableColumns`)
- [x] Query execution abstraction

---

## Phase 8 — Migration Engine 🔶

### Goal: Safe data evolution

- [x] Backfill script (`backfillRows`)
- [ ] Dual-read support
- [ ] Dual-write support
- [ ] Rollback strategy
- [ ] Legacy adapter (Lockbox/ARE compatibility)

---

## Phase 9 — HTTP Layer ✅

### Goal: External interface

- [x] `Bun.serve()` setup (native Bun, no Fastify)
- [x] Router DSL (`defineRoutes`, `scope`, `resources`, `pipeline`, `draw`, `mergeRoutes`)
- [x] Controllers (plain classes, no decorators)
- [x] Pipe middleware chain (composable, scope-aware)
- [x] Constraint system (route-level guards)
- [x] Path matching with params (`/users/:id`)
- [x] Response helpers (`ok`, `created`, `notFound`, `forbidden`, etc.)
- [x] Integration with DI container (`bootstrapHttp`)
- [x] Request validation (schema-based, Zod) — `validate()`, `permit()`, `permitQuery()`
- [x] Error handling (domain errors → HTTP status codes) — `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `UnprocessableError`

---

## Phase 10 — Testing Strategy ⬜

### Goal: Reliability

- [x] Unit tests (core DI, modules)
- [x] Encryption tests (crypto correctness, rotation)
- [x] Query rewrite tests
- [x] Repository unit tests (in-memory)
- [x] Integration tests (DB — real PostgreSQL)
- [x] Repository integration tests (create, find, soft delete)
- [ ] e2e tests (HTTP layer — API contracts)
- [ ] e2e tests (frontend, if applicable)

---

## Phase 10.5 — Citadel-Fortresses Architecture ⬜

### Goal: Enforce module isolation (citadel pattern)

- [ ] Module-owned routes (`routes` field in `@Module`)
- [ ] Module-level pipes and constraints (`pipes`, `constraints`, `prefix` in `@Module`)
- [ ] `bootstrapHttp` auto-assembles routes from all modules
- [ ] Scoped DI containers (enforce `exports` — modules only see exported providers)
- [ ] EventBus in core (inter-module communication without direct imports)

---

## Phase 14 — Inertia.js Integration ⬜

### Goal: Full-stack DX (AdonisJS-like)

- [ ] Phase A: `inertia()` helper + root layout + asset serving
- [ ] Phase B: Session middleware + flash messages
- [ ] Phase C: CSRF protection pipe
- [ ] Phase D: SSR support (optional, SEO-driven)

_See `docs/en/guides/07_inertia.md` for implementation plan._

---

## Phase 11 — Code Generator ⬜

### Goal: DX optimization

- [ ] CLI scaffold
- [ ] Module generator
- [ ] Service generator
- [ ] Contract generator

---

## Phase 12 — Domain Boundaries (Packwerk-like) ⬜

### Goal: Enforce architecture

- [ ] Module config system
- [ ] Dependency rules
- [ ] Static analyzer
- [ ] CI integration

---

## Phase 13 — Observability ⬜

### Goal: Production readiness

- [ ] Logging
- [ ] Tracing
- [ ] Metrics
- [ ] Error tracking
