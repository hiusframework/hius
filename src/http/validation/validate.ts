import type { ZodTypeAny, z } from "zod";
import type { HiusRequest } from "@/http/core/types.ts";

export class ValidationError extends Error {
  readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = errors;
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
    const errors = result.error.flatten().fieldErrors as Record<string, string[]>;
    throw new ValidationError(errors);
  }

  return result.data;
}
