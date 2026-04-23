// Domain errors — thrown by services and controllers, mapped to HTTP at the router boundary.
// These errors are part of the domain language and carry no HTTP knowledge.

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnprocessableError";
  }
}
