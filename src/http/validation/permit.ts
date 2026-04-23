import type { HiusRequest } from "@/http/core/types.ts";

export type ParamType = "string" | "number" | "boolean" | "string[]" | "number[]";
export type ParamSchema = Record<string, ParamType | readonly string[]>;

type InferParam<T> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "string[]"
        ? string[]
        : T extends "number[]"
          ? number[]
          : T extends readonly string[]
            ? T[number]
            : never;

// All permitted fields are optional — unknown fields are silently dropped.
export type PermitResult<T extends ParamSchema> = {
  [K in keyof T]?: InferParam<T[K]>;
};

function coerceValue(value: unknown, type: ParamType | readonly string[]): unknown {
  if (Array.isArray(type)) {
    // Enum literal: value must be one of the allowed strings.
    return typeof value === "string" && (type as readonly string[]).includes(value)
      ? value
      : undefined;
  }

  switch (type) {
    case "string":
      return typeof value === "string" ? value : undefined;

    case "number": {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const n = Number(value);
        return Number.isNaN(n) ? undefined : n;
      }
      return undefined;
    }

    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;

    case "string[]":
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : undefined;

    case "number[]":
      if (!Array.isArray(value)) return undefined;
      return value
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => !Number.isNaN(n));
  }
}

function applySchema<T extends ParamSchema>(
  raw: Record<string, unknown>,
  schema: T,
): PermitResult<T> {
  const result: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(schema)) {
    if (Object.hasOwn(raw, key)) {
      const coerced = coerceValue(raw[key], type);
      if (coerced !== undefined) result[key] = coerced;
    }
  }
  return result as PermitResult<T>;
}

// Permit fields from the JSON request body.
// Unknown fields are silently dropped. Returns {} on non-object or invalid JSON.
export async function permit<T extends ParamSchema>(
  req: HiusRequest,
  schema: T,
): Promise<PermitResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {} as PermitResult<T>;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {} as PermitResult<T>;
  }

  return applySchema(body as Record<string, unknown>, schema);
}

// Permit fields from URL query parameters (synchronous — query params are always strings).
// Unknown params are silently dropped.
export function permitQuery<T extends ParamSchema>(req: HiusRequest, schema: T): PermitResult<T> {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    if (req.query.has(key)) raw[key] = req.query.get(key);
  }
  return applySchema(raw, schema);
}
