// Public API surface for Hius core

export { Container } from "@/core/container.ts";
export { Injectable, Module } from "@/core/decorators.ts";
export { bootstrapModule } from "@/core/module.ts";
export type { Constructor, InjectableMetadata, ModuleMetadata, Token } from "@/core/types.ts";
// Domain errors
export {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "@/domain/errors.ts";
export type {
  Constraint,
  Handler,
  HiusContext,
  HiusRequest,
  HttpMethod,
  Pipe,
  RouteDescriptor,
} from "@/http/index.ts";
// HTTP layer
export {
  badRequest,
  bootstrapHttp,
  conflict,
  created,
  createHiusRequest,
  defineRoutes,
  forbidden,
  mergeRoutes,
  noContent,
  notFound,
  ok,
  Router,
  serverError,
  unauthorized,
  unprocessable,
} from "@/http/index.ts";
