const JSON_HEADERS = { "Content-Type": "application/json" };

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export const ok = (data: unknown): Response => json(data, 200);
export const created = (data: unknown): Response => json(data, 201);
export const noContent = (): Response => new Response(null, { status: 204 });
export const badRequest = (data: unknown): Response => json(data, 400);
export const unauthorized = (data?: unknown): Response =>
  json(data ?? { error: "Unauthorized" }, 401);
export const forbidden = (data?: unknown): Response => json(data ?? { error: "Forbidden" }, 403);
export const notFound = (data?: unknown): Response => json(data ?? { error: "Not Found" }, 404);
export const conflict = (data: unknown): Response => json(data, 409);
export const unprocessable = (data: unknown): Response => json(data, 422);
export const serverError = (): Response => json({ error: "Internal Server Error" }, 500);
