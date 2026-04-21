import { createHmac } from "node:crypto";
import type { KeyProvider } from "@/infra/encryption/core/key-provider.ts";
import { normalizeBlindIndexInput } from "@/infra/encryption/core/normalize.ts";

export interface BlindIndex {
  compute(value: string): string;
}
export function createBlindIndex(provider: KeyProvider): BlindIndex {
  function compute(value: string): string {
    const { hmacKey } = provider.getActiveKey();
    return createHmac("sha256", hmacKey)
      .update(normalizeBlindIndexInput(value), "utf8")
      .digest("hex");
  }

  return { compute };
}
