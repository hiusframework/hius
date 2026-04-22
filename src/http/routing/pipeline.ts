import type { Handler, HiusRequest, Pipe } from "@/http/core/types.ts";

// Composes pipes right-to-left around the handler.
// Pipe order: [A, B] → A wraps B wraps handler.
export function executePipeline(
  pipes: Pipe[],
  handler: Handler,
  req: HiusRequest,
): Promise<Response> {
  const chain = pipes.reduceRight<Handler>((next, pipe) => (r) => pipe(r, next), handler);
  return chain(req);
}
