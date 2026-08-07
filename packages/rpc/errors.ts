import type { ValidationIssue } from "hius/http";

// Thrown by createHttpTransport on a non-2xx response — carries the
// same locale-independent `code` (and, for a validation failure, the
// same structured `issues`) the server attached to the error response,
// so a caller can translate by code instead of pattern-matching
// `.message` (English, meant for logs/debugging, not for display).
export class RpcError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly issues?: ValidationIssue[];

  constructor(message: string, status: number, code?: string, issues?: ValidationIssue[]) {
    super(message);
    this.name = "RpcError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}
