import { afterEach, describe, expect, test } from "bun:test";
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
});
