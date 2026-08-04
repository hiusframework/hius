import type { BlindIndex } from "./blind-index";
import type { CryptoEngine } from "./crypto";

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
  hash: string;
};

// Backfill function: reads plaintext rows, writes encrypted + hash columns.
//
// Usage pattern (dual-write migration):
//   1. Deploy code that writes both plaintext + encrypted columns
//   2. Run backfillRows() to encrypt existing plaintext rows
//   3. Verify encrypted data is correct
//   4. Drop plaintext column in a follow-up migration
//
// Dual-read/dual-write and rollback support for this migration workflow
// don't exist yet — only the backfill step. Don't build build-time network
// splitting against an encrypted field until they do.
//
// The caller is responsible for:
//   - Fetching rows in batches (avoid loading entire table into memory)
//   - Providing a writer that updates the DB
export async function backfillRows(
  rows: BackfillRow[],
  crypto: CryptoEngine,
  blindIndex: BlindIndex,
  writer: BackfillWriter,
): Promise<void> {
  const results: BackfillResult[] = rows.map((row) => ({
    id: row.id,
    encrypted: crypto.encrypt(row.plaintext),
    hash: blindIndex.compute(row.plaintext),
  }));

  await writer(results);
}
