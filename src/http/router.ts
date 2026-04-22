import type { Container } from "@/core/container.ts";
import type { Constructor } from "@/core/types.ts";
import { createHiusRequest } from "@/http/core/request.ts";
import { forbidden, notFound } from "@/http/core/response.ts";
import type { HiusRequest, RouteDescriptor } from "@/http/core/types.ts";
import type { UnboundRoute } from "@/http/routing/builder.ts";
import { matchPath } from "@/http/routing/matcher.ts";
import { executePipeline } from "@/http/routing/pipeline.ts";

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

      const handler = this.resolveHandler(route as UnboundRoute, req);
      return executePipeline(route.pipes, handler, req);
    }

    return notFound();
  }

  private resolveHandler(route: UnboundRoute, _req: HiusRequest) {
    return (req: HiusRequest): Promise<Response> => {
      const instance = this.container.resolve(route._controller as Constructor);
      // biome-ignore lint/suspicious/noExplicitAny: dynamic action dispatch
      return (instance as any)[route._action](req) as Promise<Response>;
    };
  }
}
