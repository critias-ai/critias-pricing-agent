export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new APIError(body.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body ?? {})});
