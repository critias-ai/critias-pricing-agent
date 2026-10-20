export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
// The launch link carries a per-launch token in the fragment; keep it for this tab and drop it from the address bar.
const fromLink = new URLSearchParams(location.hash.slice(1)).get('token');
if (fromLink) {
  sessionStorage.setItem('pricing-token', fromLink);
  history.replaceState(null, '', location.pathname + location.search);
}
// The link pasted into a tab that is already open changes only the fragment: reload so the new token is used.
addEventListener('hashchange', () => {
  if (new URLSearchParams(location.hash.slice(1)).has('token')) location.reload();
});
export const token = () => sessionStorage.getItem('pricing-token') ?? '';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: {...(options.headers as Record<string, string>), 'X-Pricing-Token': token()},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new APIError(body.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body ?? {})});
