# apps/

Deployable applications — a web frontend, an API entrypoint, anything
that gets built and shipped on its own, as opposed to a `domains/`
directory (business logic + the file-convention structure `hius
validate` checks) or a `packages/` directory (shared library code).
Matched by the `apps/*` workspace glob in the root `package.json`, same
convention as Nx/Turborepo use for the same distinction.

**Current status: placeholder.** This framework repo has no deployable
application of its own — `apps/` exists here for workspace-glob
symmetry and to document the convention. A real Hius application (see
[Architecture](../docs/en/architecture.md)) is where this directory
actually gets used: `apps/api` (the Fortress HTTP entrypoint),
`apps/admin`, `apps/landing`, each a full application in whatever
frontend framework fits it, alongside `domains/` for the business logic
they call into.
