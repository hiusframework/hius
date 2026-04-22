import type { Constructor } from "@/core/types.ts";
import type { Constraint, Handler, HttpMethod, Pipe, RouteDescriptor } from "@/http/core/types.ts";

type ScopeOptions = {
  pipe?: string;
  constraints?: Constraint[];
};

// Internal route record — handler is bound at bootstrap time.
type RawRoute = {
  method: HttpMethod;
  pattern: string;
  controller: Constructor;
  action: string;
  pipes: Pipe[];
  constraints: Constraint[];
};

class RouteBuilder {
  private readonly raw: RawRoute[] = [];
  private readonly pipelines: Record<string, Pipe[]> = {};

  // Snapshot of the current scope context.
  private prefix: string;
  private currentPipes: Pipe[];
  private currentConstraints: Constraint[];

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

    this.raw.push(...child.raw);
  }

  resources(name: string, controller: Constructor): void {
    const base = `${this.prefix}/${name}`;
    const member = `${base}/:id`;

    this.addRoute("GET", base, controller, "index");
    this.addRoute("GET", member, controller, "show");
    this.addRoute("POST", base, controller, "create");
    this.addRoute("PATCH", member, controller, "update");
    this.addRoute("DELETE", member, controller, "destroy");
  }

  get(path: string, controller: Constructor, action: string): void {
    this.addRoute("GET", path, controller, action);
  }

  post(path: string, controller: Constructor, action: string): void {
    this.addRoute("POST", path, controller, action);
  }

  put(path: string, controller: Constructor, action: string): void {
    this.addRoute("PUT", path, controller, action);
  }

  patch(path: string, controller: Constructor, action: string): void {
    this.addRoute("PATCH", path, controller, action);
  }

  delete(path: string, controller: Constructor, action: string): void {
    this.addRoute("DELETE", path, controller, action);
  }

  // Inline a sub-route function into the current builder context,
  // inheriting the current prefix, pipes, and constraints.
  draw(fn: (r: RouteBuilder) => void): void {
    fn(this);
  }

  private addRoute(
    method: HttpMethod,
    path: string,
    controller: Constructor,
    action: string,
  ): void {
    this.raw.push({
      method,
      pattern: this.prefix ? (path.startsWith(this.prefix) ? path : this.prefix + path) : path,
      controller,
      action,
      pipes: [...this.currentPipes],
      constraints: [...this.currentConstraints],
    });
  }

  getRaw(): RawRoute[] {
    return this.raw;
  }
}

// Converts raw routes into RouteDescriptors with unbound handlers.
// Handlers are bound to real controller instances at bootstrap time.
export function defineRoutes(fn: (r: RouteBuilder) => void): RouteDescriptor[] {
  const builder = new RouteBuilder();
  fn(builder);

  return builder.getRaw().map((raw) => ({
    method: raw.method,
    pattern: raw.pattern,
    pipes: raw.pipes,
    constraints: raw.constraints,
    // Placeholder — replaced by bootstrapHttp with a container-resolved handler.
    handler: null as unknown as Handler,
    _controller: raw.controller,
    _action: raw.action,
  })) as unknown as RouteDescriptor[];
}

// Merge multiple route groups into a single flat array.
// Use when splitting routes across domain-specific files.
export function mergeRoutes(...groups: RouteDescriptor[][]): RouteDescriptor[] {
  return groups.flat();
}

// Exported for use in domain route files: (r: RouteBuilder) => void
export type { RouteBuilder };

// Internal: raw route shape with controller/action before DI binding.
export type UnboundRoute = RouteDescriptor & {
  _controller: Constructor;
  _action: string;
};
