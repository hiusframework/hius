import type { Constraint, Handler, HttpMethod, Pipe, RouteDescriptor } from "./types";

type ScopeOptions = {
  pipe?: string;
  constraints?: Constraint[];
};

export type ResourceHandlers = Partial<{
  index: Handler;
  show: Handler;
  create: Handler;
  update: Handler;
  destroy: Handler;
}>;

class RouteBuilder {
  private readonly routes: RouteDescriptor[] = [];
  private readonly pipelines: Record<string, Pipe[]> = {};

  // Snapshot of the current scope context.
  private readonly prefix: string;
  private readonly currentPipes: Pipe[];
  private readonly currentConstraints: Constraint[];

  constructor(prefix = "", pipes: Pipe[] = [], constraints: Constraint[] = []) {
    this.prefix = prefix;
    this.currentPipes = pipes;
    this.currentConstraints = constraints;
  }

  pipeline(name: string, pipes: Pipe[]): void {
    this.pipelines[name] = pipes;
  }

  scope(
    prefix: string,
    fnOrOpts: ScopeOptions | ((r: RouteBuilder) => void),
    fn?: (r: RouteBuilder) => void,
  ): void {
    let opts: ScopeOptions = {};
    let callback: (r: RouteBuilder) => void;

    if (typeof fnOrOpts === "function") {
      callback = fnOrOpts;
    } else {
      opts = fnOrOpts;
      callback = fn!;
    }

    const scopePipes = opts.pipe
      ? [...this.currentPipes, ...(this.pipelines[opts.pipe] ?? [])]
      : this.currentPipes;
    const scopeConstraints = opts.constraints
      ? [...this.currentConstraints, ...opts.constraints]
      : this.currentConstraints;

    const child = new RouteBuilder(this.prefix + prefix, scopePipes, scopeConstraints);
    // Share the pipeline registry so nested scopes can reference parent pipelines.
    Object.assign(child.pipelines, this.pipelines);

    callback(child);

    this.routes.push(...child.routes);
  }

  resources(name: string, handlers: ResourceHandlers): void {
    // addRoute prepends this.prefix itself — base/member must stay
    // relative, or the prefix ends up doubled (caught by a test after
    // fixing the addRoute prefix bug below removed a startsWith() check
    // that had been silently absorbing this exact double-inclusion).
    const base = `/${name}`;
    const member = `${base}/:id`;

    if (handlers.index) this.addRoute("GET", base, handlers.index);
    if (handlers.show) this.addRoute("GET", member, handlers.show);
    if (handlers.create) this.addRoute("POST", base, handlers.create);
    if (handlers.update) this.addRoute("PATCH", member, handlers.update);
    if (handlers.destroy) this.addRoute("DELETE", member, handlers.destroy);
  }

  get(path: string, handler: Handler): void {
    this.addRoute("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.addRoute("POST", path, handler);
  }

  put(path: string, handler: Handler): void {
    this.addRoute("PUT", path, handler);
  }

  patch(path: string, handler: Handler): void {
    this.addRoute("PATCH", path, handler);
  }

  delete(path: string, handler: Handler): void {
    this.addRoute("DELETE", path, handler);
  }

  // Inline a sub-route function into the current builder context,
  // inheriting the current prefix, pipes, and constraints.
  draw(fn: (r: RouteBuilder) => void): void {
    fn(this);
  }

  private addRoute(method: HttpMethod, path: string, handler: Handler): void {
    this.routes.push({
      method,
      // Always prefix — there's no call site where `path` legitimately
      // already contains the parent scope's prefix. An earlier version
      // guarded this with `path.startsWith(this.prefix)` to (supposedly)
      // avoid double-prefixing, which instead silently dropped the prefix
      // whenever a path happened to start with the same text, e.g.
      // scope("/api") + get("/apikeys") produced "/apikeys" instead of
      // "/api/apikeys".
      pattern: this.prefix + path,
      handler,
      pipes: [...this.currentPipes],
      constraints: [...this.currentConstraints],
    });
  }

  getRoutes(): RouteDescriptor[] {
    return this.routes;
  }
}

export function defineRoutes(fn: (r: RouteBuilder) => void): RouteDescriptor[] {
  const builder = new RouteBuilder();
  fn(builder);
  return builder.getRoutes();
}

// Merge multiple route groups into a single flat array.
// Use when splitting routes across domain-specific files.
export function mergeRoutes(...groups: RouteDescriptor[][]): RouteDescriptor[] {
  return groups.flat();
}

// Exported for use in domain route files: (r: RouteBuilder) => void
export type { RouteBuilder };
