import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { bindContract, defineContract } from "@hius/spec";
import { createTestServer } from "@hius/test-harness";
import { ConflictError, NotFoundError } from "hius";
import { z } from "zod";
import { jsonCodec } from "@/codec";
import { RpcError } from "@/errors";
import { createHttpRpcServer } from "@/http-server";
import { createHttpTransport, withMtls } from "@/http-transport";
import { createRpcClient } from "@/index";

const ChargeCustomer = defineContract({
  name: "ChargeCustomer",
  version: "1.0.0",
  description: "Charges a customer's saved payment method",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
});

const RefundCustomer = defineContract({
  name: "RefundCustomer",
  version: "1.0.0",
  input: z.object({ chargeId: z.string() }),
  output: z.object({ refundId: z.string() }),
});

let server: ReturnType<typeof createTestServer> | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

describe("HTTP RpcTransport (real server, real network calls)", () => {
  test("calling a bound contract over the wire round-trips through CBOR by default", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url));

    const result = await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });

    expect(result).toEqual({ chargeId: "ch_cust_1" });
  });

  test("the same server also serves plain JSON, for debugging with curl", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
      ]),
    );

    const res = await server.fetch("/rpc/ChargeCustomer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId: "cust_1", amount: 100 }),
    });

    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({ chargeId: "ch_cust_1" });
  });

  test("input that violates the contract's schema is rejected with 400 before the handler runs", async () => {
    let handlerRan = false;
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async () => {
          handlerRan = true;
          return { chargeId: "ch_1" };
        }),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url));

    expect(
      // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input to exercise validation
      client.call(ChargeCustomer, { customerId: "cust_1" } as any),
    ).rejects.toThrow();
    expect(handlerRan).toBe(false);
  });

  test("calling an unbound contract fails with 404, not a silent hang", async () => {
    server = createTestServer(createHttpRpcServer([]));
    const client = createRpcClient(createHttpTransport(server.url));

    expect(client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 })).rejects.toThrow(
      "404",
    );
  });

  test("a handler that throws is reported as a 500, not an unhandled rejection", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async () => {
          throw new Error("payment gateway unreachable");
        }),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url));

    await expect(
      client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 }),
    ).rejects.toThrow("500");
    errorSpy.mockRestore();
  });

  test("OPTIONS /rpc lists every bound contract's name, version, and JSON-Schema shape", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async () => ({ chargeId: "ch_1" })),
        bindContract(RefundCustomer, async () => ({ refundId: "re_1" })),
      ]),
    );

    const res = await server.fetch("/rpc", { method: "OPTIONS" });
    const body = (await res.json()) as {
      contracts: Array<{ name: string; version: string; description?: string; input: unknown }>;
    };

    expect(body.contracts.map((c) => c.name).sort()).toEqual(["ChargeCustomer", "RefundCustomer"]);
    const charge = body.contracts.find((c) => c.name === "ChargeCustomer");
    expect(charge?.version).toBe("1.0.0");
    expect(charge?.description).toBe("Charges a customer's saved payment method");
    expect(charge?.input).toMatchObject({ type: "object" });
  });

  test("a domain error thrown by the handler keeps its code and status across the wire", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async () => {
          throw new NotFoundError("customer");
        }),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url));

    const error = await client
      .call(ChargeCustomer, { customerId: "cust_1", amount: 100 })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).status).toBe(404);
    expect((error as RpcError).code).toBe("NOT_FOUND");
  });

  test("a ConflictError thrown by the handler maps to 409, not a generic 500", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async () => {
          throw new ConflictError("charge already processed");
        }),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url));

    const error = await client
      .call(ChargeCustomer, { customerId: "cust_1", amount: 100 })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).status).toBe(409);
    expect((error as RpcError).code).toBe("CONFLICT");
  });

  test("the server responds to invalid input with structured, locale-independent issues", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
      ]),
    );

    // Goes straight at the HTTP endpoint, bypassing createHttpTransport
    // — the client itself pre-validates input against the same contract
    // before ever sending a request, so invalid input never reaches the
    // server in a same-process test with the client and server sharing
    // one Contract object. This is exactly the scenario a real network
    // boundary can't rule out (an older client on a looser contract
    // version), so the server's own response shape still needs to be
    // right independent of the client that happens to be testing it.
    const res = await server.fetch("/rpc/ChargeCustomer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId: "cust_1" }),
    });
    const body = (await res.json()) as {
      code: string;
      issues: Array<{ path: unknown[]; code: string; message: string }>;
    };

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.issues.some((issue) => issue.path.includes("amount"))).toBe(true);
  });

  test("createHttpTransport surfaces the server's code and issues as RpcError", async () => {
    // Bun's `typeof fetch` includes a `preconnect` static a plain test
    // double never needs — cast rather than stub it out for nothing.
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          issues: [{ path: ["amount"], code: "invalid_type", message: "Required" }],
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    const client = createRpcClient(
      createHttpTransport("http://unused.invalid", { codec: jsonCodec, fetch: fakeFetch }),
    );

    const error = await client
      .call(ChargeCustomer, { customerId: "cust_1", amount: 100 })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).status).toBe(400);
    expect((error as RpcError).code).toBe("VALIDATION_FAILED");
    expect((error as RpcError).issues).toEqual([
      { path: ["amount"], code: "invalid_type", message: "Required" },
    ]);
  });

  test("the client can be configured to speak JSON end to end instead of CBOR", async () => {
    server = createTestServer(
      createHttpRpcServer([
        bindContract(ChargeCustomer, async (input) => ({ chargeId: `ch_${input.customerId}` })),
      ]),
    );
    const client = createRpcClient(createHttpTransport(server.url, { codec: jsonCodec }));

    const result = await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });

    expect(result).toEqual({ chargeId: "ch_cust_1" });
  });
});

// D15 (concept_docs/hius-decisions-log.md): withMtls is the Fortress-side
// half of the Fortress↔Citadel mTLS requirement — a thin wrapper over
// Bun's already-native fetch tls option, not new certificate handling, so
// what's worth proving is that the option actually reaches every call,
// not TLS itself (bootstrapHttp's own tls test covers that end).
describe("withMtls", () => {
  test("attaches the given tls option to every call", async () => {
    const calls: Array<[unknown, RequestInit | undefined]> = [];
    const fakeFetch = (async (input: unknown, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response("ok");
    }) as unknown as typeof fetch;

    const tls = { cert: "cert-pem", key: "key-pem", ca: "ca-pem" };
    const mtlsFetch = withMtls(tls, fakeFetch);

    await mtlsFetch("https://citadel.internal/rpc/ChargeCustomer", {
      method: "POST",
      headers: { "content-type": "application/cbor" },
    });

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] ?? [];
    expect(url).toBe("https://citadel.internal/rpc/ChargeCustomer");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/cbor" },
      tls,
    });
  });

  test("composes with createHttpTransport as its fetch option", async () => {
    const calls: RequestInit[] = [];
    const fakeFetch = (async (_input: unknown, init?: RequestInit) => {
      calls.push(init as RequestInit);
      return new Response(JSON.stringify({ chargeId: "ch_1" }), {
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const tls = { cert: "cert-pem", key: "key-pem", ca: "ca-pem" };
    const client = createRpcClient(
      createHttpTransport("https://citadel.internal", {
        codec: jsonCodec,
        fetch: withMtls(tls, fakeFetch),
      }),
    );

    await client.call(ChargeCustomer, { customerId: "cust_1", amount: 100 });

    expect(calls[0]).toMatchObject({ tls });
  });
});
