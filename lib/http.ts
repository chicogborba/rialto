/** Small helpers so every API route answers errors the same way: { error: { code, message } }. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  console.error("[api] unhandled", e);
  return Response.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

/** Wrap a route body: HttpError → proper status, anything else → 500 (logged, not leaked). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 100_000) throw new HttpError(413, "too_large", "Request body too large");
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "bad_json", "Body must be valid JSON");
  }
}
