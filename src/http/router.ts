import type { Container } from "@/core/container.ts";
import type { Constructor } from "@/core/types.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "@/domain/errors.ts";
import { createHiusRequest } from "@/http/core/request.ts";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unprocessable,
} from "@/http/core/response.ts";
import type { HiusRequest, RouteDescriptor } from "@/http/core/types.ts";
import type { UnboundRoute } from "@/http/routing/builder.ts";
import { matchPath } from "@/http/routing/matcher.ts";
import { executePipeline } from "@/http/routing/pipeline.ts";
import { ValidationError } from "@/http/validation/validate.ts";

export class Router {
  constructor(
    private readonly routes: RouteDescriptor[],
    private readonly container: Container,
  ) {}

  async handle(raw: Request): Promise<Response> {
    const url = new URL(raw.url);
    const base = createHiusRequest(raw, url);

    for (const route of this.routes) {
      if (route.method !== raw.method) continue;

      const match = matchPath(route.pattern, url.pathname);
      if (!match) continue;

      const req = base.withParams(match.params);

      for (const constraint of route.constraints) {
        if (!(await constraint(req))) return forbidden();
      }

      const handler = this.resolveHandler(route as UnboundRoute);
      try {
        return await executePipeline(route.pipes, handler, req);
      } catch (err) {
        if (err instanceof ValidationError) {
          return unprocessable({ errors: err.errors });
        }
        if (err instanceof NotFoundError) return notFound({ error: err.message });
        if (err instanceof UnauthorizedError) return unauthorized({ error: err.message });
        if (err instanceof ForbiddenError) return forbidden({ error: err.message });
        if (err instanceof ConflictError) return conflict({ error: err.message });
        if (err instanceof UnprocessableError) return unprocessable({ error: err.message });
        if (
          err instanceof SyntaxError ||
          (err instanceof Error && err.message === "Invalid JSON body")
        ) {
          return badRequest({ error: "Invalid JSON body" });
        }
        throw err;
      }
    }

    return notFound();
  }

  private resolveHandler(route: UnboundRoute) {
    return (req: HiusRequest): Promise<Response> => {
      const instance = this.container.resolve(route._controller as Constructor);
      // biome-ignore lint/suspicious/noExplicitAny: dynamic action dispatch
      return (instance as any)[route._action](req) as Promise<Response>;
    };
  }
}
