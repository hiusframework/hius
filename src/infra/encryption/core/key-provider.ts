export interface KeyBundle {
  keyId: string;
  encryptionKey: Buffer; // 32 bytes
  hmacKey: Buffer; // 32 bytes
}

export interface KeyProvider {
  getActiveKey(): KeyBundle;
  getKeyById(keyId: string): KeyBundle | null;
}

type SerializedKeyBundle = {
  keyId: string;
  encryptionKey: string;
  hmacKey: string;
};

// Reads keys from environment variables.
// Keys must be base64-encoded 32-byte values.
export function createEnvKeyProvider(): KeyProvider {
  function decodeBase64Key(keyName: string, value: string): Buffer {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length !== 32) {
      throw new Error(`[Hius/KeyProvider] ${keyName} must decode to exactly 32 bytes`);
    }
    return decoded;
  }

  function deserializeKeyBundle(source: string, raw: SerializedKeyBundle): KeyBundle {
    if (!raw.keyId || !raw.encryptionKey || !raw.hmacKey) {
      throw new Error(
        `[Hius/KeyProvider] ${source} entries must include keyId, encryptionKey, and hmacKey`,
      );
    }

    return {
      keyId: raw.keyId,
      encryptionKey: decodeBase64Key(`${source}.encryptionKey`, raw.encryptionKey),
      hmacKey: decodeBase64Key(`${source}.hmacKey`, raw.hmacKey),
    };
  }

  function readActiveKey(): KeyBundle {
    const raw = {
      encKey: process.env.ENCRYPTION_KEY,
      hmacKey: process.env.HMAC_KEY,
      keyId: process.env.KEY_ID,
    };

    if (!raw.encKey || !raw.hmacKey || !raw.keyId) {
      throw new Error("[Hius/KeyProvider] Missing ENCRYPTION_KEY, HMAC_KEY, or KEY_ID env vars");
    }

    return {
      keyId: raw.keyId,
      encryptionKey: decodeBase64Key("ENCRYPTION_KEY", raw.encKey),
      hmacKey: decodeBase64Key("HMAC_KEY", raw.hmacKey),
    };
  }

  function readKeyring(): KeyBundle[] {
    const raw = process.env.KEYRING_JSON;
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("[Hius/KeyProvider] KEYRING_JSON must be valid JSON");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("[Hius/KeyProvider] KEYRING_JSON must be a JSON array");
    }

    return parsed.map((entry, index) =>
      deserializeKeyBundle(`KEYRING_JSON[${index}]`, entry as SerializedKeyBundle),
    );
  }

  const activeKey = readActiveKey();
  const keys = new Map<string, KeyBundle>();
  keys.set(activeKey.keyId, activeKey);

  for (const key of readKeyring()) {
    if (key.keyId === activeKey.keyId) {
      throw new Error(
        `[Hius/KeyProvider] KEYRING_JSON contains keyId "${key.keyId}" which conflicts with active KEY_ID`,
      );
    }
    if (keys.has(key.keyId)) {
      throw new Error(`[Hius/KeyProvider] KEYRING_JSON contains duplicate keyId: "${key.keyId}"`);
    }
    keys.set(key.keyId, key);
  }

  return {
    getActiveKey: () => activeKey,
    getKeyById: (keyId: string) => keys.get(keyId) ?? null,
  };
}

// In-memory key provider for testing — never use in production.
export function createStaticKeyProvider(
  activeKey: KeyBundle,
  additionalKeys: KeyBundle[] = [],
): KeyProvider {
  const keys = new Map<string, KeyBundle>();
  keys.set(activeKey.keyId, activeKey);

  for (const key of additionalKeys) {
    if (key.keyId === activeKey.keyId) {
      throw new Error(
        `[Hius/KeyProvider] Static keyring contains keyId "${key.keyId}" which conflicts with active key`,
      );
    }
    if (keys.has(key.keyId)) {
      throw new Error(`[Hius/KeyProvider] Static keyring contains duplicate keyId: "${key.keyId}"`);
    }
    keys.set(key.keyId, key);
  }

  return {
    getActiveKey: () => activeKey,
    getKeyById: (keyId: string) => keys.get(keyId) ?? null,
  };
}
