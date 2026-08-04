import { Router } from "./router";
import type { RouteDescriptor } from "./types";

type HttpOptions = {
  port?: number;
};

// Returns the Bun server handle — the caller needs it for graceful
// shutdown (server.stop()) and, when opts.port is 0 (let the OS pick a
// free port, e.g. for tests running in parallel), for discovering which
// port actually got bound (server.port). An earlier version returned
// void and discarded the handle, which made port: 0 unusable in practice
// even though the port itself was assigned correctly.
export function bootstrapHttp(
  routes: RouteDescriptor[],
  opts: HttpOptions = {},
): ReturnType<typeof Bun.serve> {
  const router = new Router(routes);

  const server = Bun.serve({
    port: opts.port ?? 3000,
    fetch: (req) => router.handle(req),
  });

  console.log(`[Hius] HTTP server running on port ${server.port}`);
  return server;
}
