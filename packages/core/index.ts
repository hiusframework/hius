import { PACKAGE_NAME as SPEC_PACKAGE_NAME } from "@hius/spec";

// Placeholder — validator, graph, and contract diff land here. Must never
// import from `hius` (the runtime) — this package works only against the
// extracted manifest, never the runtime that produced it.
export const PACKAGE_NAME = "@hius/core" as const;
export { SPEC_PACKAGE_NAME };
