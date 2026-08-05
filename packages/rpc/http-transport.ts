import type { Contract } from "@hius/spec";
import type { z } from "zod";
import { cborCodec, type RpcCodec } from "./codec";
import type { RpcTransport } from "./index";

export type HttpTransportOptions = {
  // Defaults to CBOR — pass `jsonCodec` for a client that's easier to
  // inspect on the wire (e.g. while debugging against curl logs).
  codec?: RpcCodec;
  // Injectable so tests can exercise createHttpTransport without a real
  // server listening, the same seam createLocalTransport's tests use for
  // the handler side.
  fetch?: typeof fetch;
};

async function readBody(response: Response, codec: RpcCodec): Promise<unknown> {
  const raw =
    codec.contentType === "application/json" ? await response.text() : await response.arrayBuffer();
  return codec.decode(raw);
}

/**
 * A network RpcTransport: encodes the input with `options.codec`
 * (CBOR by default), POSTs it to `${baseUrl}/rpc/<contract name>`, and
 * decodes the response the same way. Input is parsed against the
 * contract before it's sent (fail fast, no wasted round trip on
 * obviously-invalid input) — the server independently validates again on
 * arrival, the same way `createHttpRpcServer` never trusts a client
 * regardless of which process sent the request.
 */
export function createHttpTransport(
  baseUrl: string,
  options: HttpTransportOptions = {},
): RpcTransport {
  const codec = options.codec ?? cborCodec;
  const fetchFn = options.fetch ?? fetch;

  return {
    async call<Input extends z.ZodType, Output extends z.ZodType>(
      contract: Contract<Input, Output>,
      input: z.infer<Input>,
    ): Promise<z.infer<Output>> {
      const parsedInput = contract.input.parse(input);
      const res = await fetchFn(`${baseUrl}/rpc/${encodeURIComponent(contract.name)}`, {
        method: "POST",
        headers: { "content-type": codec.contentType },
        body: codec.encode(parsedInput),
      });

      if (!res.ok) {
        const body = await readBody(res, codec).catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
        throw new Error(`RPC call to "${contract.name}" failed (${res.status}): ${message}`);
      }

      const decoded = await readBody(res, codec);
      return contract.output.parse(decoded);
    },
  };
}
