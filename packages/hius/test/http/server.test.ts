import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { defineRoutes } from "@/http/builder";
import { bootstrapHttp } from "@/http/server";

let server: ReturnType<typeof bootstrapHttp> | undefined;

afterEach(() => {
  server?.stop(true);
  server = undefined;
});

describe("bootstrapHttp", () => {
  // Regression: bootstrapHttp used to return void and discard the Bun
  // server handle, so port: 0 (let the OS assign a free port — needed to
  // run tests in parallel without colliding on a fixed port) was
  // unusable in practice: the port got bound correctly, but nothing
  // exposed *which* port, and there was no handle to call .stop() on for
  // cleanup between tests.
  test("returns a server handle exposing the actually-bound port for port: 0", () => {
    const routes = defineRoutes((r) => r.get("/health", async () => new Response("ok")));
    server = bootstrapHttp(routes, { port: 0 });

    expect(server.port).toBeGreaterThan(0);
  });

  test("the returned handle serves requests on the assigned port", async () => {
    const routes = defineRoutes((r) => r.get("/health", async () => new Response("ok")));
    server = bootstrapHttp(routes, { port: 0 });

    const res = await fetch(`http://localhost:${server.port}/health`);
    expect(await res.text()).toBe("ok");
  });

  test("the returned handle can be stopped for graceful shutdown", async () => {
    const routes = defineRoutes((r) => r.get("/health", async () => new Response("ok")));
    server = bootstrapHttp(routes, { port: 0 });
    const port = server.port;

    server.stop(true);
    server = undefined;

    expect(fetch(`http://localhost:${port}/health`)).rejects.toThrow();
  });

  // D15 (concept_docs/hius-decisions-log.md) picked @hius/rpc's HTTP
  // transport for Fortress↔Citadel specifically because mTLS is just
  // Bun.serve's own native tls option — this proves opts.tls actually
  // reaches Bun.serve rather than being silently dropped, with a real
  // self-signed cert rather than a mocked TLS layer.
  describe("tls option", () => {
    test("passing tls terminates the connection over HTTPS", async () => {
      const certDir = await mkdtemp(join(tmpdir(), "hius-server-tls-"));
      try {
        const keyPath = join(certDir, "key.pem");
        const certPath = join(certDir, "cert.pem");
        await $`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${keyPath} -out ${certPath} -days 1 -subj /CN=localhost`.quiet();

        const routes = defineRoutes((r) => r.get("/health", async () => new Response("ok")));
        server = bootstrapHttp(routes, {
          port: 0,
          tls: { key: Bun.file(keyPath), cert: Bun.file(certPath) },
        });

        // Self-signed — the client has to opt out of chain verification
        // to reach it at all, same as any self-signed cert in a test.
        const res = await fetch(`https://localhost:${server.port}/health`, {
          tls: { rejectUnauthorized: false },
        });
        expect(await res.text()).toBe("ok");
      } finally {
        await rm(certDir, { recursive: true, force: true });
      }
    });
  });
});
