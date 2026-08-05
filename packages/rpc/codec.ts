import { decode as decodeCbor, encode as encodeCbor } from "cbor-x";

// The wire encoding is deliberately separate from the transport and from
// the contract: a contract's Zod schema validates the decoded value the
// same way regardless of which bytes it arrived as, so swapping codecs
// never touches @hius/spec's Contract type. CBOR is the default —
// smaller and faster to parse than JSON for typical mixed payloads,
// still schemaless (no .proto-style IDL, no generated stubs) — with
// JSON kept available so a request can be inspected with plain curl
// while debugging.
export type RpcCodec = {
  contentType: string;
  encode(value: unknown): Uint8Array | string;
  decode(data: ArrayBuffer | Uint8Array | string): unknown;
};

export const cborCodec: RpcCodec = {
  contentType: "application/cbor",
  encode: (value) => encodeCbor(value),
  decode: (data) =>
    decodeCbor(data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)),
};

export const jsonCodec: RpcCodec = {
  contentType: "application/json",
  encode: (value) => JSON.stringify(value),
  decode: (data) => JSON.parse(data as string),
};

// Defaults to JSON for a request with no (or an unrecognized)
// Content-Type — the friendlier default for a bare `curl -d '{...}'`
// while debugging, since a plain request has no way to ask for CBOR.
export function codecFor(contentType: string | null): RpcCodec {
  return contentType?.includes(cborCodec.contentType) ? cborCodec : jsonCodec;
}
