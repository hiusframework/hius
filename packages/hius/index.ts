export const PACKAGE_NAME = "hius" as const;

export type {
  Contract,
  DomainFiles,
  ExtractedDomain,
  ExtractedManifest,
  ModuleConfig,
} from "@hius/spec";
export { defineContract, defineModuleConfig } from "@hius/spec";
export { loadAllContracts, loadContracts } from "./contracts";
export { withUniqueConstraintMapping } from "./db/errors";
// Explicit composition and ts-morph extraction land here alongside
// discovery, the HTTP layer, and the Query AST/Encryption Layer.
export * from "./discovery";
export type { BlindIndex } from "./encryption/blind-index";
export { createBlindIndex } from "./encryption/blind-index";
export type { CryptoEngine } from "./encryption/crypto";
export { createCryptoEngine } from "./encryption/crypto";
export { DrizzleAdapter } from "./encryption/drizzle-adapter";
export type {
  FieldConfig,
  FieldRegistry,
  ModelConfig,
} from "./encryption/field-registry";
export { createFieldRegistry } from "./encryption/field-registry";
export type { KeyBundle, KeyProvider } from "./encryption/key-provider";
export { createEnvKeyProvider, createStaticKeyProvider } from "./encryption/key-provider";
export type { BackfillResult, BackfillRow, BackfillWriter } from "./encryption/migration";
export { backfillRows } from "./encryption/migration";
export {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "./errors";
export type { EventSubscriber } from "./event-tracing";
export { whereDoesEventGo } from "./event-tracing";
export type { EventBus, EventHandler } from "./events/bus";
export { createEventBus } from "./events/bus";
export type { RelayResult } from "./events/outbox";
export { relayOutboxEvents, writeOutboxEvent } from "./events/outbox";
export { outboxEvents } from "./events/schema";
export { domainFiles, extractManifest } from "./extraction";
export type { ResourceHandlers, RouteBuilder } from "./http/builder";
export { defineRoutes, mergeRoutes } from "./http/builder";
export { resolveLocale } from "./http/locale";
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
export { bootstrapHttp } from "./http/server";
export type {
  Constraint,
  Handler,
  HiusContext,
  HiusRequest,
  HttpMethod,
  Pipe,
  RouteDescriptor,
} from "./http/types";
export type { ValidationIssue } from "./http/validate";
export { ValidationError, validate } from "./http/validate";
export { loadAllModuleConfigs, loadModuleConfig } from "./module-config";
export type { Query, RewrittenCondition } from "./query/ast";
export { and, eq, or } from "./query/ast";
export { rewriteQuery } from "./query/rewrite";
export { validateProject } from "./validate-project";
