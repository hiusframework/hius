// A narrower entry point than the full `hius` barrel — just the HTTP
// layer, nothing that touches encryption, the database, or discovery.
// Exists so a consumer that only needs routing (like @hius/rpc's HTTP
// transport) doesn't transitively pull in modules with a top-level
// `import ... from "bun"` (db/errors.ts) merely by importing from
// "hius" — those fail to load under runtimes that don't recognize
// Bun's own module namespace, e.g. Vite's SSR dev module runner, which
// a SvelteKit frontend's dev server runs under even when the vite
// process itself was launched via `bun run dev`.
//
// bootstrapHttp is deliberately not re-exported here even though it's
// pure HTTP-layer code — it calls Bun.serve directly, and a consumer
// without @types/bun in its own tsconfig (svelte-check, for one) fails
// to typecheck a global it has no ambient declaration for, even if it
// never actually calls the function. Import bootstrapHttp from "hius"
// itself in whatever process actually runs the server.

export {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "./errors";
export type { ResourceHandlers, RouteBuilder } from "./http/builder";
export { defineRoutes, mergeRoutes } from "./http/builder";
export { matchPath } from "./http/matcher";
export type { ParamSchema, ParamType, PermitResult } from "./http/permit";
export { permit, permitQuery } from "./http/permit";
export { executePipeline } from "./http/pipeline";
export { createHiusRequest } from "./http/request";
export {
  badRequest,
  conflict,
  created,
  forbidden,
  noContent,
  notFound,
  ok,
  serverError,
  unauthorized,
  unprocessable,
} from "./http/response";
export { Router } from "./http/router";
export type {
  Constraint,
  Handler,
  HiusContext,
  HiusRequest,
  HttpMethod,
  Pipe,
  RouteDescriptor,
} from "./http/types";
export { ValidationError, validate } from "./http/validate";
