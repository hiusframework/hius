import { describe, expect, test } from "bun:test";
import { createBlindIndex } from "@/infra/encryption/core/blind-index.ts";
import { createCryptoEngine } from "@/infra/encryption/core/crypto.ts";
import {
  createEnvKeyProvider,
  createStaticKeyProvider,
} from "@/infra/encryption/core/key-provider.ts";
import { and, eq } from "@/infra/encryption/query/ast.ts";
import { rewriteQuery } from "@/infra/encryption/query/rewrite.ts";
import { createFieldRegistry } from "@/infra/encryption/registry/field-registry.ts";

const keyBundle = {
  keyId: "test-v1",
  encryptionKey: Buffer.from("a".repeat(32), "utf8"),
  hmacKey: Buffer.from("b".repeat(32), "utf8"),
};
const provider = createStaticKeyProvider(keyBundle);
const crypto = createCryptoEngine(provider);
const blindIndex = createBlindIndex(provider);

// ---------------------------------------------------------------------------
// Test 1: Encryption roundtrip
// ---------------------------------------------------------------------------
describe("CryptoEngine", () => {
  test("encrypt → decrypt returns original value", () => {
    const original = "secret@example.com";
    expect(crypto.decrypt(crypto.encrypt(original))).toBe(original);
  });

  test("each encrypt call produces a unique ciphertext (random IV)", () => {
    const value = "same@input.com";
    expect(crypto.encrypt(value)).not.toBe(crypto.encrypt(value));
  });

  test("decrypt throws on malformed payload", () => {
    expect(() => crypto.decrypt("bad_payload")).toThrow();
  });

  test("decrypt throws on unsupported version", () => {
    expect(() => crypto.decrypt("v99:key:abc")).toThrow(/Unsupported payload version/);
  });

  test("decrypt uses the key id embedded in the payload", () => {
    const oldKey = {
      keyId: "old-key",
      encryptionKey: Buffer.from("c".repeat(32), "utf8"),
      hmacKey: Buffer.from("d".repeat(32), "utf8"),
    };
    const oldCrypto = createCryptoEngine(createStaticKeyProvider(oldKey));
    const rotatedCrypto = createCryptoEngine(createStaticKeyProvider(keyBundle, [oldKey]));

    const payload = oldCrypto.encrypt("legacy@example.com");
    expect(rotatedCrypto.decrypt(payload)).toBe("legacy@example.com");
  });

  test("decrypt throws on unknown key id", () => {
    expect(() => crypto.decrypt("v1:missing-key:abc")).toThrow(/Unknown key id/);
  });

  test("static key provider rejects duplicate key ids", () => {
    expect(() => createStaticKeyProvider(keyBundle, [{ ...keyBundle }])).toThrow(
      /conflicts with active key/,
    );
  });
});

describe("createEnvKeyProvider", () => {
  test("rejects KEYRING_JSON entries that conflict with active KEY_ID", () => {
    const previousEnv = {
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      HMAC_KEY: process.env.HMAC_KEY,
      KEY_ID: process.env.KEY_ID,
      KEYRING_JSON: process.env.KEYRING_JSON,
    };

    process.env.ENCRYPTION_KEY = Buffer.from("a".repeat(32), "utf8").toString("base64");
    process.env.HMAC_KEY = Buffer.from("b".repeat(32), "utf8").toString("base64");
    process.env.KEY_ID = "active-key";
    process.env.KEYRING_JSON = JSON.stringify([
      {
        keyId: "active-key",
        encryptionKey: Buffer.from("c".repeat(32), "utf8").toString("base64"),
        hmacKey: Buffer.from("d".repeat(32), "utf8").toString("base64"),
      },
    ]);

    try {
      expect(() => createEnvKeyProvider()).toThrow(/conflicts with active KEY_ID/);
    } finally {
      process.env.ENCRYPTION_KEY = previousEnv.ENCRYPTION_KEY;
      process.env.HMAC_KEY = previousEnv.HMAC_KEY;
      process.env.KEY_ID = previousEnv.KEY_ID;
      process.env.KEYRING_JSON = previousEnv.KEYRING_JSON;
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: Blind index
// ---------------------------------------------------------------------------
describe("BlindIndex", () => {
  test("same input → same hash", () => {
    expect(blindIndex.compute("alice@example.com")).toBe(blindIndex.compute("alice@example.com"));
  });

  test("different input → different hash", () => {
    expect(blindIndex.compute("a@x.com")).not.toBe(blindIndex.compute("b@x.com"));
  });

  test("normalizes: trims and lowercases before hashing", () => {
    expect(blindIndex.compute("  Alice@Example.COM  ")).toBe(
      blindIndex.compute("alice@example.com"),
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: Query rewrite — encrypted searchable field
// ---------------------------------------------------------------------------
describe("rewriteQuery", () => {
  function makeRegistry() {
    const registry = createFieldRegistry();
    registry.register("users", {
      email: {
        encrypted: true,
        searchable: true,
        field: "email_encrypted",
        hashField: "email_hash",
      },
      ssn: {
        encrypted: true,
        searchable: false,
        field: "ssn_encrypted",
      },
    });
    return registry;
  }

  test("eq on searchable encrypted field rewrites to hash column", () => {
    const registry = makeRegistry();
    const result = rewriteQuery(eq("email", "alice@example.com"), "users", registry, blindIndex);
    expect(result).toEqual({
      type: "eq",
      column: "email_hash",
      value: blindIndex.compute("alice@example.com"),
    });
  });

  test("eq on plain field passes through unchanged", () => {
    const registry = makeRegistry();
    const result = rewriteQuery(eq("id", "123"), "users", registry, blindIndex);
    expect(result).toEqual({ type: "eq", column: "id", value: "123" });
  });

  test("and/or recurse correctly", () => {
    const registry = makeRegistry();
    const result = rewriteQuery(
      and(eq("id", "1"), eq("email", "x@y.com")),
      "users",
      registry,
      blindIndex,
    );
    expect(result.type).toBe("and");
    if (result.type === "and") {
      expect(result.conditions[0]).toEqual({ type: "eq", column: "id", value: "1" });
      expect(result.conditions[1]).toMatchObject({ type: "eq", column: "email_hash" });
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4: Error cases
  // ---------------------------------------------------------------------------
  test("eq on encrypted non-searchable field throws", () => {
    const registry = makeRegistry();
    expect(() => rewriteQuery(eq("ssn", "123-45-6789"), "users", registry, blindIndex)).toThrow(
      /not searchable/,
    );
  });

  test("eq on unknown model field passes through (treated as plain)", () => {
    const registry = makeRegistry();
    const result = rewriteQuery(eq("name", "Alice"), "users", registry, blindIndex);
    expect(result).toEqual({ type: "eq", column: "name", value: "Alice" });
  });
});
