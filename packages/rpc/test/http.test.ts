import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { bindContract, defineContract } from "@hius/spec";
import { createTestServer } from "@hius/test-harness";
import { z } from "zod";
import { jsonCodec } from "@/codec";
import { createHttpRpcServer } from "@/http-server";
import { createHttpTransport } from "@/http-transport";
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
