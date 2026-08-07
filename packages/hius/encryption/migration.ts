import type { BlindIndex } from "./blind-index";
import type { CryptoEngine } from "./crypto";

// Migrating a plaintext column to an encrypted one, without downtime, is a
// deploy-sequenced expand/contract — each stage below is a separate code
// deploy, not a runtime flag this module tracks. Explicit composition all
// the way through: a repository calls a different function from this file
// at each stage, the same way it already calls a different generator
// output at each step of adding an endpoint.
//
//   1. dual-write:  every write calls dualWrite() and persists all three
//                    columns (plaintext, encrypted, hash). Reads still come
//                    from plaintext — this stage changes nothing observable.
//   2. backfill:    backfillRows() encrypts every pre-existing plaintext
//                    row. Safe to run while dual-write is live — new rows
//                    already have all three columns; backfill only needs
//                    the ones written before this deploy.
//   3. verify:      verifyBackfill() decrypts every backfilled row and
//                    confirms it matches the original plaintext, catching
//                    a corrupted encryption/key problem before reads ever
//                    depend on it.
//   4. dual-read:   every read calls dualRead() — prefers the encrypted
//                    column, falls back to plaintext for any row dual-write
//                    hasn't reached yet. Writes still dual-write (rollback
//                    stays free at this stage).
//   5. cutover:     writes stop touching the plaintext column. This is the
//                    one stage rollback isn't free after — see below.
//   6. drop column: a followup schema migration removes the plaintext
//                    column. Outside this module — an ordinary DB migration,
//                    not an encryption-layer concern.
//
// Rollback from stage 1-4: redeploy the code from the stage before it.
// Plaintext was never stopped being written, so nothing is lost — no
// function in this file is even involved.
//
// Rollback from stage 5 (cutover) is the one case that needs help: rows
// written after cutover have no plaintext value at all. rollbackRows()
// decrypts them back — the plaintext column can always be reconstructed as
// long as the encryption key that wrote it still exists, which is exactly
// the property AES-GCM's symmetric decrypt guarantees.

// Describes one row that needs backfilling.
export type BackfillRow = {
  id: string;
  // The plaintext value to encrypt (comes from a legacy plaintext column)
  plaintext: string;
};

// The write function the caller must provide — keeps migration decoupled from any ORM.
export type BackfillWriter = (rows: BackfillResult[]) => Promise<void>;

export type BackfillResult = {
  id: string;
  encrypted: string;
  hash?: string;
};

// Backfill function: reads plaintext rows, writes encrypted (+ hash, for
// searchable fields) columns. blindIndex is optional — a non-searchable
// field (FieldRegistry's `searchable: false`) has no hash column to fill.
//
// The caller is responsible for:
//   - Fetching rows in batches (avoid loading entire table into memory)
//   - Providing a writer that updates the DB
export async function backfillRows(
  rows: BackfillRow[],
  crypto: CryptoEngine,
  blindIndex: BlindIndex | undefined,
  writer: BackfillWriter,
): Promise<void> {
  const results: BackfillResult[] = rows.map((row) => ({
    id: row.id,
    encrypted: crypto.encrypt(row.plaintext),
    hash: blindIndex?.compute(row.plaintext),
  }));

  await writer(results);
}

export type DualWriteResult = {
  plaintext: string;
  encrypted: string;
  hash?: string;
};

/**
 * Stage 1 (dual-write). Call at every insert/update call site while the
 * migration is in flight; persist all three fields the result carries.
 * blindIndex is optional, same reasoning as {@link backfillRows}.
 */
export function dualWrite(
  plaintext: string,
  crypto: CryptoEngine,
  blindIndex?: BlindIndex,
): DualWriteResult {
  return {
    plaintext,
    encrypted: crypto.encrypt(plaintext),
    hash: blindIndex?.compute(plaintext),
  };
}

export type VerifyRow = {
  id: string;
  plaintext: string;
  encrypted: string | null;
};

export type VerifyResult = { id: string; ok: true } | { id: string; ok: false; reason: string };

/**
 * Stage 3 (verify). Pure — no I/O, so it's cheap to run against every
 * backfilled row before trusting dualRead() to prefer the encrypted
 * column. Catches three distinct failure modes as three distinct reasons,
 * not one generic "mismatch": a row backfillRows() never reached, a
 * ciphertext that fails to decrypt at all (wrong/missing key), and a
 * ciphertext that decrypts but to the wrong value (a correctness bug
 * elsewhere, not a crypto failure) — collapsing these into one message
 * would turn a targeted fix into a guessing game.
 */
export function verifyBackfill(rows: VerifyRow[], crypto: CryptoEngine): VerifyResult[] {
  return rows.map((row): VerifyResult => {
    if (row.encrypted === null) {
      return { id: row.id, ok: false, reason: "not backfilled yet — encrypted column is null" };
    }

    let decrypted: string;
    try {
      decrypted = crypto.decrypt(row.encrypted);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id: row.id, ok: false, reason: `decrypt failed: ${message}` };
    }

    if (decrypted !== row.plaintext) {
      return { id: row.id, ok: false, reason: "decrypted value does not match plaintext" };
    }

    return { id: row.id, ok: true };
  });
}

/**
 * Stage 4 (dual-read). Prefers the encrypted column — decrypts and returns
 * it. Falls back to the row's own plaintext column when encrypted is
 * null, so a row dual-write hasn't reached yet (written before that
 * deploy landed, or backfill hasn't gotten to it) still reads correctly
 * instead of throwing. Throws only when neither column has a value, which
 * means the row itself is corrupt, not mid-migration.
 */
export function dualRead(
  row: { plaintext: string | null; encrypted: string | null },
  crypto: CryptoEngine,
): string {
  if (row.encrypted !== null) return crypto.decrypt(row.encrypted);
  if (row.plaintext !== null) return row.plaintext;
  throw new Error("[Hius/Migration] Row has neither a plaintext nor an encrypted value");
}

export type RollbackRow = {
  id: string;
  encrypted: string;
};

export type RollbackResult = {
  id: string;
  plaintext: string;
};

// The write function the caller must provide, symmetric to BackfillWriter.
export type RollbackWriter = (rows: RollbackResult[]) => Promise<void>;

/**
 * Rollback from stage 5 (cutover) — the one stage a redeploy alone can't
 * undo, because rows written after cutover never had a plaintext value to
 * fall back to. Decrypts every row's encrypted column back into
 * plaintext — the mirror image of {@link backfillRows}, and always
 * possible as long as the key that encrypted the row hasn't been
 * destroyed (crypto.decrypt() already resolves the right key by the keyId
 * embedded in the payload, so this works across a key rotation too, not
 * just the single-key case).
 *
 * The caller is responsible for the same batching/writer contract as
 * backfillRows — this only computes the plaintext values, it doesn't
 * touch the database.
 */
export async function rollbackRows(
  rows: RollbackRow[],
  crypto: CryptoEngine,
  writer: RollbackWriter,
): Promise<void> {
  const results: RollbackResult[] = rows.map((row) => ({
    id: row.id,
    plaintext: crypto.decrypt(row.encrypted),
  }));

  await writer(results);
}
