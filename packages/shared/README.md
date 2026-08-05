# @hius/shared

[Русский](README.ru.md)

The Shared Kernel — common value-object types and utilities every domain
may depend on, with **no business logic and no domain-specific exports**.
Every domain may import from `shared` without declaring it in
`allowedDependencies` (it's implicitly allowed); `shared` itself may not
depend on any domain, and the boundary validator rejects an export whose
name references a specific domain (`BillingInvoiceFormatter` in `shared`
is a validator error, for exactly that reason).

**Current status: placeholder.** This package exists and is wired into
the workspace, but nothing has been built into it yet — there's no
concrete cross-domain type in the framework itself that needed
extracting here first. Once an application built on Hius has a real
value object shared across two or more domains (`Money`, an address
type, that kind of thing), that's what belongs here.

See [Architecture](../../docs/en/architecture.md#intent-and-fact) for
how `shared`'s rules are enforced, not just documented.
