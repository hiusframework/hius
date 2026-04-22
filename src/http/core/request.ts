import type { HiusContext, HiusRequest, HttpMethod } from "@/http/core/types.ts";

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
    return this.raw.json() as Promise<T>;
  }
}

export function createHiusRequest(raw: Request, url: URL): HiusRequest {
  return new HiusRequestImpl(raw, url.pathname, {}, url.searchParams, {});
}
