export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

// Arbitrary per-request context (current user, tenant, etc.)
export type HiusContext = Record<string, unknown>;

export type HiusRequest = {
  readonly raw: Request;
  readonly method: HttpMethod;
  readonly pathname: string;
  readonly params: Record<string, string>;
  readonly query: URLSearchParams;
  readonly ctx: HiusContext;

  withParams(params: Record<string, string>): HiusRequest;
  withCtx(extra: HiusContext): HiusRequest;
  json<T = unknown>(): Promise<T>;
};

// Middleware function — must call next() to continue the chain.
export type Pipe = (
  req: HiusRequest,
  next: (req: HiusRequest) => Promise<Response>,
) => Promise<Response>;

// Returns true to allow the request, false to reject with 403.
export type Constraint = (req: HiusRequest) => boolean | Promise<boolean>;

export type Handler = (req: HiusRequest) => Promise<Response>;

// A route ready for dispatch. `handler` is a plain function — bound to
// its dependencies by explicit composition at the call site, not resolved
// through a container.
export type RouteDescriptor = {
  method: HttpMethod;
  pattern: string;
  handler: Handler;
  pipes: Pipe[];
  constraints: Constraint[];
};
