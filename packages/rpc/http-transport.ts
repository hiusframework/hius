import type { Contract } from "@hius/spec";
import type { ValidationIssue } from "hius/http";
import type { z } from "zod";
import { cborCodec, type RpcCodec } from "./codec";
import { RpcError } from "./errors";
import type { RpcTransport } from "./index";

function isValidationIssueArray(value: unknown): value is ValidationIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "path" in item &&
        "code" in item &&
        "message" in item,
    )
  );
}

export type HttpTransportOptions = {
  // Defaults to CBOR — pass `jsonCodec` for a client that's easier to
  // inspect on the wire (e.g. while debugging against curl logs).
  codec?: RpcCodec;
  // Injectable so tests can exercise createHttpTransport without a real
  // server listening, the same seam createLocalTransport's tests use for
  // the handler side. Also how a caller attaches mTLS — see withMtls.
  fetch?: typeof fetch;
};

// Bun's fetch accepts a `tls` option (client certificate + CA) natively,
// via BunFetchRequestInit — a Bun-global ambient type, not something this
// file declares or imports.
type FetchTlsOptions = NonNullable<BunFetchRequestInit["tls"]>;

/**
 * Wraps a fetch function so every call carries the given client
 * certificate — the Fortress-side half of the Fortress↔Citadel mTLS
 * requirement (D15, concept_docs/hius-decisions-log.md): pass the result
 * as `createHttpTransport`'s `fetch` option instead of the global fetch.
 * `@hius/rpc` itself stays transport-agnostic about TLS — this is a thin
 * helper over what Bun's fetch already does natively, not new crypto or
 * certificate handling.
 */
export function withMtls(tls: FetchTlsOptions, fetchFn: typeof fetch = fetch): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: BunFetchRequestInit) =>
    fetchFn(input, { ...init, tls } as BunFetchRequestInit)) as typeof fetch;
}

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
        const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
        const message = record && "error" in record ? String(record.error) : res.statusText;
        const code = record && "code" in record ? String(record.code) : undefined;
        const issues =
          record && "issues" in record && isValidationIssueArray(record.issues)
            ? record.issues
            : undefined;
        throw new RpcError(
          `RPC call to "${contract.name}" failed (${res.status}): ${message}`,
          res.status,
          code,
          issues,
        );
      }

      const decoded = await readBody(res, codec);
      return contract.output.parse(decoded);
    },
  };
}
