import { Router } from "./router";
import type { RouteDescriptor } from "./types";

// Pulled from Bun.serve's own parameter type rather than naming
// Bun.TLSOptions directly — this stays correct across Bun versions
// without this file having its own opinion about the shape.
type TlsOptions = NonNullable<Parameters<typeof Bun.serve>[0]>["tls"];

type HttpOptions = {
  port?: number;
  // Set to run this server over TLS — pass requestCert: true plus a ca to
  // require and verify a client certificate (mTLS). This is how a
  // Citadel-side server enforces the Fortress↔Citadel transport's mTLS
  // requirement (D15, concept_docs/hius-decisions-log.md) — bootstrapHttp
  // itself has no opinion about mTLS beyond forwarding what Bun.serve
  // already supports natively.
  tls?: TlsOptions;
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
    tls: opts.tls,
    fetch: (req) => router.handle(req),
  });

  console.log(`[Hius] HTTP server running on port ${server.port}`);
  return server;
}
