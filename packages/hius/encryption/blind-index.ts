import { createHmac } from "node:crypto";
import type { KeyProvider } from "./key-provider";
import { normalizeBlindIndexInput } from "./normalize";

export interface BlindIndex {
  // Hash under the active key — use for writes, so every new row is
  // indexed under the current key.
  compute(value: string): string;
  // Hash under every known key (active first, then retired ones still
  // accepted for reads) — use for searches, so equality lookups keep
  // matching rows hashed before a key rotation until they're backfilled
  // onto the active key.
  computeAllCandidates(value: string): string[];
}

export function createBlindIndex(provider: KeyProvider): BlindIndex {
  function hashWith(hmacKey: Buffer, value: string): string {
    return createHmac("sha256", hmacKey)
      .update(normalizeBlindIndexInput(value), "utf8")
      .digest("hex");
  }

  function compute(value: string): string {
    return hashWith(provider.getActiveKey().hmacKey, value);
  }

  function computeAllCandidates(value: string): string[] {
    return provider.getAllKeys().map((key) => hashWith(key.hmacKey, value));
  }

  return { compute, computeAllCandidates };
}
