import { bootstrapModule } from "@/core/module.ts";
import type { Constructor } from "@/core/types.ts";
import type { RouteDescriptor } from "@/http/core/types.ts";
import { Router } from "@/http/router.ts";

type HttpOptions = {
  port?: number;
};

export function bootstrapHttp(
  module: Constructor,
  routes: RouteDescriptor[],
  opts: HttpOptions = {},
): void {
  const container = bootstrapModule(module);
  const router = new Router(routes, container);

  Bun.serve({
    port: opts.port ?? 3000,
    fetch: (req) => router.handle(req),
  });

  console.log(`[Hius] HTTP server running on port ${opts.port ?? 3000}`);
}
