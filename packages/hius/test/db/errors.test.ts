import { expect, test } from "bun:test";
import { SQL } from "bun";
import { withUniqueConstraintMapping } from "@/db/errors";
import { ConflictError } from "@/errors";

// A real connection's PostgresError puts the Postgres SQLSTATE on .errno,
// not .code (.code holds a generic "ERR_POSTGRES_SERVER_ERROR" marker
// instead) — confirmed against the local test database; bun-types' own
// SQL docs example suggests the opposite. Fixtures here match what a real
// connection actually produces, not the documented shape.
function uniqueViolation(message: string): InstanceType<typeof SQL.PostgresError> {
  return new SQL.PostgresError(message, { code: "ERR_POSTGRES_SERVER_ERROR", errno: "23505" });
}

test("maps a Postgres unique-violation (errno 23505) to ConflictError", async () => {
  const operation = async () => {
    throw uniqueViolation("duplicate key value violates unique constraint");
  };

  expect(withUniqueConstraintMapping(operation)).rejects.toThrow(ConflictError);
});

test("uses the provided message on the mapped ConflictError", async () => {
  const operation = async () => {
    throw uniqueViolation("duplicate key");
  };

  try {
    await withUniqueConstraintMapping(operation, "email already taken");
    expect.unreachable();
  } catch (err) {
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toBe("email already taken");
  }
});

test("maps a Postgres unique-violation wrapped in another error's .cause (e.g. an ORM's own error class)", async () => {
  // Regression: drizzle-orm wraps the driver error in DrizzleQueryError,
  // preserving the original on .cause rather than throwing it directly —
  // `instanceof SQL.PostgresError` alone misses it.
  class WrappingError extends Error {
    constructor(cause: Error) {
      super("query failed");
      this.cause = cause;
    }
  }
  const operation = async () => {
    throw new WrappingError(uniqueViolation("duplicate key"));
  };

  expect(withUniqueConstraintMapping(operation)).rejects.toThrow(ConflictError);
});

test("a different Postgres error code passes through unmapped", async () => {
  const operation = async () => {
    throw new SQL.PostgresError("null value in column violates not-null constraint", {
      code: "ERR_POSTGRES_SERVER_ERROR",
      errno: "23502", // not_null_violation, not unique_violation
    });
  };

  expect(withUniqueConstraintMapping(operation)).rejects.toThrow(SQL.PostgresError);
});

test("a non-Postgres error passes through unmapped", async () => {
  const operation = async () => {
    throw new TypeError("something unrelated");
  };

  expect(withUniqueConstraintMapping(operation)).rejects.toThrow(TypeError);
});

test("returns the operation's result on success", async () => {
  const result = await withUniqueConstraintMapping(async () => 42);
  expect(result).toBe(42);
});
