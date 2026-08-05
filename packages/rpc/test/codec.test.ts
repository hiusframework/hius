import { expect, test } from "bun:test";
import { cborCodec, codecFor, jsonCodec } from "@/codec";

test("cborCodec round-trips through actual CBOR bytes", () => {
  const value = { name: "ChargeCustomer", amount: 100, tags: ["a", "b"] };
  const encoded = cborCodec.encode(value);

  expect(encoded).toBeInstanceOf(Uint8Array);
  expect(cborCodec.decode(encoded)).toEqual(value);
});

test("jsonCodec round-trips through actual JSON text", () => {
  const value = { name: "ChargeCustomer", amount: 100 };
  const encoded = jsonCodec.encode(value);

  expect(typeof encoded).toBe("string");
  expect(encoded).toBe(JSON.stringify(value));
  expect(jsonCodec.decode(encoded as string)).toEqual(value);
});

test("cbor encodes more compactly than JSON for the same payload", () => {
  const value = { customerId: "cust_1", amount: 100, note: "a fairly ordinary message" };
  const cborBytes = cborCodec.encode(value) as Uint8Array;
  const jsonBytes = jsonCodec.encode(value) as string;

  expect(cborBytes.byteLength).toBeLessThan(jsonBytes.length);
});

test("codecFor picks cbor only when Content-Type says so", () => {
  expect(codecFor("application/cbor")).toBe(cborCodec);
  expect(codecFor("application/cbor; charset=utf-8")).toBe(cborCodec);
});

test("codecFor defaults to json for anything else, including no header", () => {
  expect(codecFor("application/json")).toBe(jsonCodec);
  expect(codecFor(null)).toBe(jsonCodec);
  expect(codecFor("text/plain")).toBe(jsonCodec);
});
