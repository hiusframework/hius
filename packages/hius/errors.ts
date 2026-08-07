// Domain errors — thrown by domain logic, mapped to HTTP at the router boundary.
// These errors are part of the domain language and carry no HTTP knowledge.
//
// `code` is a stable, locale-independent identifier — `message` stays
// English and human-readable (the fallback content an app can always
// fall back to showing, same guarantee Rails' I18n gives via its
// default-locale translations). Hius doesn't ship a translation catalog
// or resolve a request's locale into one of these — that's an app
// concern, deliberately: the framework's job stops at handing back a
// `code` stable enough to key a catalog lookup by, not at doing the
// lookup itself.

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";

  constructor(message = "unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";

  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  readonly code = "CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends Error {
  readonly code = "UNPROCESSABLE";

  constructor(message: string) {
    super(message);
    this.name = "UnprocessableError";
  }
}
