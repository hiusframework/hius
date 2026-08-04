import type { HiusContext, HiusRequest, HttpMethod } from "./types";

// A Request's body stream can only be read once — a second .json() call
// throws "Body already used". Multiple HiusRequest wrapper instances get
// derived from the same underlying `raw` via withParams/withCtx (e.g. one
// per pipe in a chain), so the cache is keyed on `raw` itself rather than
// held per-instance: whichever wrapper reads the body first, every other
// wrapper for that same request sees the same (in-flight or resolved)
// parse instead of re-consuming the stream.
const bodyCache = new WeakMap<Request, Promise<unknown>>();

class HiusRequestImpl implements HiusRequest {
  readonly raw: Request;
  readonly method: HttpMethod;
  readonly pathname: string;
  readonly params: Record<string, string>;
  readonly query: URLSearchParams;
  readonly ctx: HiusContext;

  constructor(
    raw: Request,
    pathname: string,
    params: Record<string, string>,
    query: URLSearchParams,
    ctx: HiusContext,
  ) {
    this.raw = raw;
    this.method = raw.method as HttpMethod;
    this.pathname = pathname;
    this.params = params;
    this.query = query;
    this.ctx = ctx;
  }

  withParams(params: Record<string, string>): HiusRequest {
    return new HiusRequestImpl(this.raw, this.pathname, params, this.query, this.ctx);
  }

  withCtx(extra: HiusContext): HiusRequest {
    return new HiusRequestImpl(this.raw, this.pathname, this.params, this.query, {
      ...this.ctx,
      ...extra,
    });
  }

  json<T = unknown>(): Promise<T> {
    let cached = bodyCache.get(this.raw);
    if (!cached) {
      cached = this.raw.json();
      bodyCache.set(this.raw, cached);
    }
    return cached as Promise<T>;
  }
}

export function createHiusRequest(raw: Request, url: URL): HiusRequest {
  return new HiusRequestImpl(raw, url.pathname, {}, url.searchParams, {});
}
