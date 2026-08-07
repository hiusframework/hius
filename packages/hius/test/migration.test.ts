import { describe, expect, test } from "bun:test";
import { testKeyBundle } from "@hius/test-harness";
import {
  backfillRows,
  createBlindIndex,
  createCryptoEngine,
  createStaticKeyProvider,
  dualRead,
  dualWrite,
  rollbackRows,
  verifyBackfill,
} from "@/index";

const provider = createStaticKeyProvider(testKeyBundle);
const crypto = createCryptoEngine(provider);
const blindIndex = createBlindIndex(provider);

describe("backfillRows", () => {
  test("encrypts every row and writes encrypted + hash", async () => {
    const written: unknown[] = [];
    await backfillRows(
      [{ id: "1", plaintext: "alice@example.com" }],
      crypto,
      blindIndex,
      async (rows) => {
        written.push(...rows);
      },
    );

    expect(written).toHaveLength(1);
    const row = written[0] as { id: string; encrypted: string; hash?: string };
    expect(row.id).toBe("1");
    expect(crypto.decrypt(row.encrypted)).toBe("alice@example.com");
    expect(row.hash).toBe(blindIndex.compute("alice@example.com"));
  });

  test("omits hash when no blind index is given (non-searchable field)", async () => {
    const written: unknown[] = [];
    await backfillRows([{ id: "1", plaintext: "123-45-6789" }], crypto, undefined, async (rows) => {
      written.push(...rows);
    });

    const row = written[0] as { hash?: string };
    expect(row.hash).toBeUndefined();
  });
});

describe("dualWrite", () => {
  test("returns plaintext, a decryptable ciphertext, and a matching hash", () => {
    const result = dualWrite("alice@example.com", crypto, blindIndex);

    expect(result.plaintext).toBe("alice@example.com");
    expect(crypto.decrypt(result.encrypted)).toBe("alice@example.com");
    expect(result.hash).toBe(blindIndex.compute("alice@example.com"));
  });

  test("omits hash when no blind index is given", () => {
    const result = dualWrite("123-45-6789", crypto);
    expect(result.hash).toBeUndefined();
  });
});

describe("verifyBackfill", () => {
  test("ok: true when the encrypted column decrypts to the original plaintext", () => {
    const encrypted = crypto.encrypt("alice@example.com");
    const results = verifyBackfill(
      [{ id: "1", plaintext: "alice@example.com", encrypted }],
      crypto,
    );

    expect(results).toEqual([{ id: "1", ok: true }]);
  });

  test("ok: false, distinct reason for a row that was never backfilled", () => {
    const results = verifyBackfill(
      [{ id: "1", plaintext: "alice@example.com", encrypted: null }],
      crypto,
    );

    expect(results[0]).toMatchObject({
      id: "1",
      ok: false,
      reason: expect.stringContaining("not backfilled"),
    });
  });

  test("ok: false, distinct reason for a ciphertext that fails to decrypt", () => {
    const results = verifyBackfill(
      [{ id: "1", plaintext: "alice@example.com", encrypted: "not-a-real-payload" }],
      crypto,
    );

    expect(results[0]).toMatchObject({
      id: "1",
      ok: false,
      reason: expect.stringContaining("decrypt failed"),
    });
  });

  test("ok: false, distinct reason for a ciphertext that decrypts to the wrong value", () => {
    const encrypted = crypto.encrypt("bob@example.com");
    const results = verifyBackfill(
      [{ id: "1", plaintext: "alice@example.com", encrypted }],
      crypto,
    );

    expect(results[0]).toMatchObject({
      id: "1",
      ok: false,
      reason: expect.stringContaining("does not match plaintext"),
    });
  });
});

describe("dualRead", () => {
  test("prefers the encrypted column when present", () => {
    const encrypted = crypto.encrypt("alice@example.com");
    expect(dualRead({ plaintext: "stale-value", encrypted }, crypto)).toBe("alice@example.com");
  });

  test("falls back to plaintext when the row hasn't been backfilled yet", () => {
    expect(dualRead({ plaintext: "alice@example.com", encrypted: null }, crypto)).toBe(
      "alice@example.com",
    );
  });

  test("throws when neither column has a value", () => {
    expect(() => dualRead({ plaintext: null, encrypted: null }, crypto)).toThrow(
      /neither a plaintext nor an encrypted value/,
    );
  });
});

describe("rollbackRows", () => {
  test("decrypts every row back to plaintext", async () => {
    const encrypted = crypto.encrypt("alice@example.com");
    const written: unknown[] = [];

    await rollbackRows([{ id: "1", encrypted }], crypto, async (rows) => {
      written.push(...rows);
    });

    expect(written).toEqual([{ id: "1", plaintext: "alice@example.com" }]);
  });

  test("decrypts rows encrypted under a retired key after rotation", async () => {
    const oldKey = {
      keyId: "old-key",
      encryptionKey: Buffer.from("c".repeat(32), "utf8"),
      hmacKey: Buffer.from("d".repeat(32), "utf8"),
    };
    const oldCrypto = createCryptoEngine(createStaticKeyProvider(oldKey));
    const rotatedCrypto = createCryptoEngine(createStaticKeyProvider(testKeyBundle, [oldKey]));
    const encrypted = oldCrypto.encrypt("legacy@example.com");

    const written: unknown[] = [];
    await rollbackRows([{ id: "1", encrypted }], rotatedCrypto, async (rows) => {
      written.push(...rows);
    });

    expect(written).toEqual([{ id: "1", plaintext: "legacy@example.com" }]);
  });
});

// Simulates the full expand/contract lifecycle described at the top of
// migration.ts against an in-memory fake table — not a real Postgres
// table, deliberately: every function in this file is ORM-agnostic by
// design (the writer callback is where a real adapter would plug in), so
// the interesting thing to prove end-to-end is the stage sequence and its
// data-loss properties, not that an UPDATE statement works.
describe("full migration lifecycle", () => {
  type Row = {
    id: string;
    plaintext: string | null;
    encrypted: string | null;
    hash: string | null;
  };

  test("dual-write → backfill → verify → dual-read → cutover → rollback loses no data", async () => {
    const table = new Map<string, Row>();

    // Pre-existing rows, from before the migration — plaintext only.
    table.set("1", { id: "1", plaintext: "alice@example.com", encrypted: null, hash: null });
    table.set("2", { id: "2", plaintext: "bob@example.com", encrypted: null, hash: null });

    // Stage 1 (dual-write): a new row arrives after this deploy — gets all
    // three columns immediately, never touches backfill.
    const written = dualWrite("carol@example.com", crypto, blindIndex);
    table.set("3", { id: "3", ...written, hash: written.hash ?? null });

    // Stage 2 (backfill): catch up the two pre-existing rows.
    const toBackfill = [...table.values()]
      .filter((row) => row.encrypted === null)
      .map((row) => ({ id: row.id, plaintext: row.plaintext as string }));
    await backfillRows(toBackfill, crypto, blindIndex, async (results) => {
      for (const result of results) {
        const row = table.get(result.id);
        if (row) {
          row.encrypted = result.encrypted;
          row.hash = result.hash ?? null;
        }
      }
    });
    expect([...table.values()].every((row) => row.encrypted !== null)).toBe(true);

    // Stage 3 (verify): every row's ciphertext must round-trip to its
    // recorded plaintext before reads are allowed to depend on it.
    const verifyRows = [...table.values()].map((row) => ({
      id: row.id,
      plaintext: row.plaintext as string,
      encrypted: row.encrypted,
    }));
    const verification = verifyBackfill(verifyRows, crypto);
    expect(verification.every((result) => result.ok)).toBe(true);

    // Stage 4 (dual-read): every row reads correctly regardless of how it
    // got its encrypted column (backfilled vs. written that way from the
    // start).
    for (const [id, expected] of [
      ["1", "alice@example.com"],
      ["2", "bob@example.com"],
      ["3", "carol@example.com"],
    ] as const) {
      const row = table.get(id);
      if (!row) throw new Error(`missing row ${id}`);
      expect(dualRead(row, crypto)).toBe(expected);
    }

    // Stage 5 (cutover): a new row arrives after this deploy — plaintext
    // is never written at all now.
    const cutoverEncrypted = crypto.encrypt("dave@example.com");
    table.set("4", { id: "4", plaintext: null, encrypted: cutoverEncrypted, hash: null });
    expect(dualRead(table.get("4") as Row, crypto)).toBe("dave@example.com");

    // Rollback from cutover: row 4 has no plaintext to fall back to — this
    // is the one case a redeploy alone can't fix. rollbackRows recovers it.
    const rollbackTargets = [...table.values()]
      .filter((row) => row.plaintext === null)
      .map((row) => ({ id: row.id, encrypted: row.encrypted as string }));
    expect(rollbackTargets).toEqual([{ id: "4", encrypted: cutoverEncrypted }]);

    await rollbackRows(rollbackTargets, crypto, async (results) => {
      for (const result of results) {
        const row = table.get(result.id);
        if (row) row.plaintext = result.plaintext;
      }
    });

    // After rollback every row has its plaintext restored — no data lost,
    // including the row that was written after cutover.
    expect([...table.values()].map((row) => row.plaintext).sort()).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
      "dave@example.com",
    ]);
  });
});
