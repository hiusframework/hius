import { SQL } from "bun";
import { ConflictError } from "../errors";

// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = "23505";

const MAX_CAUSE_DEPTH = 5;

// ORMs commonly wrap the driver error in their own error class, with the
// original preserved on the standard `.cause` chain (e.g. drizzle-orm's
// DrizzleQueryError) rather than throwing the driver error directly —
// `instanceof SQL.PostgresError` alone misses it.
function findPostgresError(err: unknown, depth = 0): InstanceType<typeof SQL.PostgresError> | null {
  if (err instanceof SQL.PostgresError) return err;
  if (depth >= MAX_CAUSE_DEPTH || !(err instanceof Error) || !err.cause) return null;
  return findPostgresError(err.cause, depth + 1);
}

/**
 * Runs a write and maps a Postgres unique-constraint violation to
 * ConflictError. An app-level check-then-act (e.g. "does this email
 * already exist?" before inserting) can never be race-safe on its own —
 * two concurrent requests can both pass the check before either writes.
 * The unique index is the actual guarantee; this just translates its
 * violation into the same domain error a pre-check would have thrown,
 * instead of a raw driver error (however deeply an ORM wrapped it)
 * leaking out of the repository.
 */
export async function withUniqueConstraintMapping<T>(
  operation: () => Promise<T>,
  message = "already exists",
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    const pgError = findPostgresError(err);
    // The Postgres SQLSTATE ends up on .errno at runtime, not .code — .code
    // holds a generic "ERR_POSTGRES_SERVER_ERROR" marker instead (confirmed
    // against a real connection; the opposite of what bun-types' own example
    // in its SQL docs suggests). Check both so this keeps working if that
    // ever changes.
    if (pgError && (pgError.errno === UNIQUE_VIOLATION || pgError.code === UNIQUE_VIOLATION)) {
      throw new ConflictError(message);
    }
    throw err;
  }
}
