import type { ZodTypeAny, z } from "zod";
import type { HiusRequest } from "./types";

// A single field-level failure, kept close to Zod's own issue shape
// rather than flattened into an English sentence: `code` (Zod's own
// issue code, e.g. "invalid_format", "too_small") and `path` are
// locale-independent and stable enough to key a translation catalog by
// — `message` is Zod's own English text, kept only as the guaranteed
// fallback content an app can always fall back to, the same role
// Rails' default-locale translation plays when a more specific one is
// missing. Hius doesn't ship a catalog or resolve a locale into one —
// see resolveLocale in ./locale for the (also app-driven) piece that
// would feed a locale into that lookup.
export type ValidationIssue = {
  path: (string | number)[];
  code: string;
  message: string;
};

export class ValidationError extends Error {
  readonly code = "VALIDATION_FAILED";
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Validation failed");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

// Parses and validates the request body against a Zod schema.
// Throws ValidationError on invalid input — the Router catches it and returns 422.
// Throws a plain Error on unparseable JSON — the Router returns 400.
export async function validate<T extends ZodTypeAny>(
  req: HiusRequest,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new Error("Invalid JSON body");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path as (string | number)[],
      code: issue.code,
      message: issue.message,
    }));
    throw new ValidationError(issues);
  }

  return result.data;
}
