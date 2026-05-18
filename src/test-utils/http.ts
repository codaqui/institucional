export type MockResponse = Pick<Response, "ok" | "status" | "json">;

export function jsonResponse(
  data: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): MockResponse {
  return {
    ok,
    status,
    json: async () => data,
  };
}
