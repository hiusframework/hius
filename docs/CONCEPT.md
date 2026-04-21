# HIUS FRAMEWORK — CONCEPT & PHILOSOPHY

## 1. Overview

Hius is a backend framework designed as a **control plane for modern distributed systems**.

It combines:

- Domain-Driven Design (DDD)
- Event-driven architecture
- Modular monolith → microservices evolution
- LLM-friendly development principles
- Explicit, no-magic architecture

---

## 2. Core Philosophy

### 2.1 No Magic

Inspired by frustrations with frameworks like:

- Ruby on Rails
- Django

Hius enforces:

- explicit behavior
- visible dependencies
- no hidden side effects

---

### 2.2 Developer Experience (DX First)

Borrowing from:

- Rails (convention)
- NestJS (structure)
- Django (batteries included)

But:

- without implicit behavior
- without tight coupling

---

### 2.3 LLM-Friendly Architecture

System must be:

- predictable
- deterministic
- easy to analyze statically

Why:

- AI-assisted development
- automated refactoring
- code generation

---

## 3. Architectural Pillars

---

### 3.1 Domain-Driven Design (DDD)

Hius enforces:

- Bounded contexts = modules
- Domain isolation
- Explicit interfaces

Structure:

```
domain/
  users/
  billing/
```

Rules:

- no cross-domain imports
- communication via contracts/events

---

### 3.2 Modular Monolith First

Start as:

```
Monolith → Event-driven → Microservices
```

Benefits:

- fast iteration
- lower infra cost
- easier debugging

---

### 3.3 Event-Driven Architecture

Default communication:

- async events
- eventual consistency

Example:

```
UserCreated → BillingService
```

Benefits:

- decoupling
- scalability
- resilience

---

### 3.4 Repository Pattern

- domain defines interfaces
- infra implements

```
Service → Repository → DB
```

---

### 3.5 Explicit Infrastructure Layer

Infra includes:

- DB
- Encryption
- Messaging
- External APIs

Domain NEVER depends on infra.

---

## 4. Lessons from Existing Frameworks

---

### 4.1 Rails

Take:

- convention over configuration
- productivity

Avoid:

- magic
- hidden callbacks
- tight ActiveRecord coupling

---

### 4.2 NestJS

Take:

- modular structure
- DI system

Avoid:

- decorator-heavy magic
- implicit runtime behavior

---

### 4.3 Django

Take:

- batteries included

Avoid:

- monolithic patterns
- ORM lock-in

---

### 4.4 Packwerk (Shopify)

Take:

- domain boundaries enforcement
- dependency control

Implement:

- module config
- static analyzer

---

## 5. System Components

---

### 5.1 Core Runtime

- DI container
- module system
- lifecycle management

---

### 5.2 DB Layer

- PostgreSQL
- Drizzle ORM
- repository abstraction

---

### 5.3 Encryption System

Inspired by:

- Lockbox
- BlindIndex
- ActiveRecord Encryption

Features:

- AES-GCM
- blind index
- query rewrite
- ORM-agnostic

---

### 5.4 Query System

- AST-based queries
- rewrite engine
- field registry

---

### 5.5 ORM Adapters

- Drizzle (primary)
- Prisma (future)

---

### 5.6 CLI Tooling

Inspired by:

- Rails generators
- Nest CLI

Commands:

```
hius generate module
hius generate service
hius dev
hius deploy
```

Goals:

- reduce boilerplate
- enforce structure

---

### 5.7 Code Generation

- templates
- idempotent generation
- LLM-compatible

---

### 5.8 Boundary Enforcement

Packwerk-inspired:

- module configs
- dependency validation
- CI checks

---

## 6. Development Workflow

1. Generate module
2. Implement domain logic
3. Define contracts
4. Add events
5. Write tests
6. Deploy

---

## 7. Testing Strategy

- unit tests (domain)
- integration tests (DB)
- contract tests

---

## 8. Observability

- structured logging
- tracing
- metrics

---

## 9. Migration Strategy

- dual read/write
- backfill
- rollback

Supports:

- Lockbox
- ActiveRecord Encryption

---

## 10. Future Vision

- multi-tenant systems
- multi-cloud deployment
- AI-assisted development
- WASM runtime

---

## 11. Key Insight

Hius is not just a framework.

It is:

> A system for building systems

---

## 12. Positioning

Hius =

- not Rails
- not NestJS
- not Django

It is:

- control plane
- DDD-first platform
- event-first backend system
