import { describe, expect, test } from "bun:test";
import { createHiusRequest } from "@/http/core/request.ts";
import type { HiusRequest, Pipe } from "@/http/core/types.ts";
import { executePipeline } from "@/http/routing/pipeline.ts";

const fakeReq = createHiusRequest(
  new Request("http://localhost/test"),
  new URL("http://localhost/test"),
);

function okResponse(body: string) {
  return new Response(body, { status: 200 });
}

describe("executePipeline", () => {
  test("no pipes: calls handler directly", async () => {
    const handler = async () => okResponse("done");
    const res = await executePipeline([], handler, fakeReq);
    expect(await res.text()).toBe("done");
  });

  test("single pipe wraps handler", async () => {
    const log: string[] = [];
    const pipe: Pipe = async (req, next) => {
      log.push("before");
      const res = await next(req);
      log.push("after");
      return res;
    };
    const handler = async () => {
      log.push("handler");
      return okResponse("ok");
    };

    await executePipeline([pipe], handler, fakeReq);
    expect(log).toEqual(["before", "handler", "after"]);
  });

  test("multiple pipes run in order", async () => {
    const log: string[] = [];
    const makeLogPipe =
      (name: string): Pipe =>
      async (req, next) => {
        log.push(`${name}:before`);
        const res = await next(req);
        log.push(`${name}:after`);
        return res;
      };

    await executePipeline(
      [makeLogPipe("A"), makeLogPipe("B")],
      async () => {
        log.push("handler");
        return okResponse("ok");
      },
      fakeReq,
    );

    expect(log).toEqual(["A:before", "B:before", "handler", "B:after", "A:after"]);
  });

  test("pipe can short-circuit without calling next", async () => {
    const blocker: Pipe = async () => new Response("blocked", { status: 403 });
    const handler = async () => okResponse("should not reach");

    const res = await executePipeline([blocker], handler, fakeReq);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("blocked");
  });

  test("pipe can mutate req before passing to next", async () => {
    let receivedCtx: unknown;
    const enrichPipe: Pipe = async (req, next) => next(req.withCtx({ user: "alice" }));
    const handler = async (req: HiusRequest) => {
      receivedCtx = req.ctx.user;
      return okResponse("ok");
    };

    await executePipeline([enrichPipe], handler, fakeReq);
    expect(receivedCtx).toBe("alice");
  });
});
