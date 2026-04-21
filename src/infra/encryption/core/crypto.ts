import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyProvider } from "@/infra/encryption/core/key-provider.ts";

// Payload: v1:<keyId>:<base64(iv|ciphertext|tag)>
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface CryptoEngine {
  encrypt(value: string): string;
  decrypt(payload: string): string;
}

export function createCryptoEngine(provider: KeyProvider): CryptoEngine {
  function encrypt(value: string): string {
    const { keyId, encryptionKey } = provider.getActiveKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, ciphertext, tag]);
    return `${VERSION}:${keyId}:${blob.toString("base64")}`;
  }

  function decrypt(payload: string): string {
    const parts = payload.split(":");
    const version = parts[0];
    const keyId = parts[1];
    const encoded = parts[2];

    if (version !== VERSION) {
      throw new Error(`[Hius/Crypto] Unsupported payload version: ${version}`);
    }
    if (!keyId || !encoded) {
      throw new Error("[Hius/Crypto] Malformed payload");
    }

    const key = provider.getKeyById(keyId);
    if (!key) {
      throw new Error(`[Hius/Crypto] Unknown key id: ${keyId}`);
    }

    const blob = Buffer.from(encoded, "base64");
    const iv = blob.subarray(0, IV_BYTES);
    const tag = blob.subarray(blob.length - TAG_BYTES);
    const ciphertext = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", key.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  }

  return { encrypt, decrypt };
}
