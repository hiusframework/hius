import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from "./errors";
import { matchPath } from "./matcher";
import { executePipeline } from "./pipeline";
import { createHiusRequest } from "./request";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  serverError,
  unauthorized,
  unprocessable,
} from "./response";
import type { RouteDescriptor } from "./types";
import { ValidationError } from "./validate";

export class Router {
  constructor(private readonly routes: RouteDescriptor[]) {}

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

      try {
        return await executePipeline(route.pipes, route.handler, req);
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

        // Anything else is a genuine bug in the handler, not a mapped
        // domain error — log it and return a generic 500 instead of
        // letting it escape as an unhandled rejection out of Bun.serve's
        // fetch callback (the serverError() helper existed but nothing
        // called it).
        console.error("[Hius] unhandled error in route handler:", err);
        return serverError();
      }
    }

    return notFound();
  }
}
