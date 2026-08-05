import type { ContractBinding } from "@hius/spec";
import { defineRoutes, type RouteDescriptor } from "hius";
import { z } from "zod";
import { codecFor, type RpcCodec } from "./codec";

async function readRequestBody(request: Request, codec: RpcCodec): Promise<unknown> {
  const raw =
    codec.contentType === "application/json" ? await request.text() : await request.arrayBuffer();
  return codec.decode(raw);
}

function encodedResponse(value: unknown, codec: RpcCodec, status = 200): Response {
  return new Response(codec.encode(value), {
    status,
    headers: { "content-type": codec.contentType },
  });
}

type ContractDescriptor = {
  name: string;
  version: string;
  description?: string;
  input: unknown;
  output: unknown;
};

/**
 * Server side of the HTTP RpcTransport — the counterpart to
 * createHttpTransport. Returns route descriptors meant to be merged into
 * the app's own routes (`mergeRoutes(httpRpcRoutes, ...)`), not a
 * standalone server: an RPC endpoint is just another set of routes on
 * the same Fortress HTTP surface.
 *
 * `POST /rpc/<contract name>` dispatches to the bound handler, decoding
 * the body with whichever codec the request's Content-Type names
 * (falling back to JSON) and responding with the same one. Both the
 * input and the handler's output are re-validated against the
 * contract's own schemas here — never trust a client, regardless of
 * which process it's running in.
 *
 * `OPTIONS /rpc` answers "what can I call here" — every bound
 * contract's name, version, description, and JSON-Schema input/output
 * shape (the same JSON Schema projection `@hius/core`'s diffContracts
 * already treats as the canonical, transport-safe view of a contract).
 * Response encoding follows the Accept header, defaulting to JSON so a
 * bare `curl -X OPTIONS` is readable without a CBOR decoder on hand.
 */
export function createHttpRpcServer(bindings: ContractBinding[]): RouteDescriptor[] {
  const byName = new Map(bindings.map((binding) => [binding.contract.name, binding]));

  const descriptors: ContractDescriptor[] = bindings.map(({ contract }) => ({
    name: contract.name,
    version: contract.version,
    description: contract.description,
    input: z.toJSONSchema(contract.input),
    output: z.toJSONSchema(contract.output),
  }));

  return defineRoutes((r) => {
    r.options("/rpc", async (req) => {
      const codec = codecFor(req.raw.headers.get("accept"));
      return encodedResponse({ contracts: descriptors }, codec);
    });

    r.post("/rpc/:contract", async (req) => {
      const codec = codecFor(req.raw.headers.get("content-type"));
      const binding = byName.get(req.params.contract ?? "");

      if (!binding) {
        return encodedResponse(
          { error: `No handler bound for contract "${req.params.contract}"` },
          codec,
          404,
        );
      }

      let input: unknown;
      try {
        input = binding.contract.input.parse(await readRequestBody(req.raw, codec));
      } catch (error) {
        return encodedResponse(
          { error: error instanceof Error ? error.message : String(error) },
          codec,
          400,
        );
      }

      try {
        const output = binding.contract.output.parse(await binding.handler(input));
        return encodedResponse(output, codec);
      } catch (error) {
        console.error(`[Hius] RPC handler for "${binding.contract.name}" threw:`, error);
        return encodedResponse({ error: "Internal Server Error" }, codec, 500);
      }
    });
  });
}
