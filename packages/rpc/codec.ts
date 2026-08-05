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
  // Explicitly Uint8Array<ArrayBuffer>, not the bare `Uint8Array`
  // (which TS defaults to Uint8Array<ArrayBufferLike>) — that default
  // isn't assignable to fetch's BodyInit under standard DOM lib types,
  // only under Bun's own more permissive ambient fetch typings.
  encode(value: unknown): Uint8Array<ArrayBuffer> | string;
  decode(data: ArrayBuffer | Uint8Array | string): unknown;
};

export const cborCodec: RpcCodec = {
  contentType: "application/cbor",
  // cbor-x returns a Node Buffer (Uint8Array<ArrayBufferLike>) — copied
  // into a plain Uint8Array<ArrayBuffer> so this is assignable to
  // fetch's BodyInit under every consumer's TS lib config, not just
  // Bun's own (a real mismatch: this package typechecks clean inside
  // the Bun-only hius workspace but not from a SvelteKit app pulling in
  // standard DOM lib types, where BodyInit is stricter about which
  // Uint8Array<T> it accepts).
  encode: (value) => new Uint8Array(encodeCbor(value)),
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
