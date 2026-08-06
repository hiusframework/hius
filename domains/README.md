# domains/

Reference and test domains built on Hius — proving the framework end to
end. Not published packages; matched by the `domains/*` workspace glob
in the root `package.json`.

This is where a Hius *domain* lives — `citadel/`, `fortress/`,
`module.config.ts`, the file-convention structure `hius validate`
checks. Deployable applications (a web frontend, an API entrypoint) are
a different thing and belong in `apps/` instead — see [apps/README.md](../apps/README.md).
