import {appendFile} from 'node:fs/promises';
export const MAX_EVENT_STRING_CHARS = 8000;
// Large tool outputs already live in stage files; the event log keeps bounded, parseable lines.
export function truncateLarge(value: unknown, limit = MAX_EVENT_STRING_CHARS): unknown {
  if (typeof value === 'string')
    return value.length > limit ? `${value.slice(0, limit)}…[truncated ${value.length - limit} chars]` : value;
  if (Array.isArray(value)) return value.map(item => truncateLarge(item, limit));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, truncateLarge(item, limit)]));
  return value;
}
export function redactSecrets(value: unknown): string {
  let text = JSON.stringify(value);
  for (const [key, secret] of Object.entries(process.env))
    if (/API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) && secret && secret.length > 8)
      text = text.replaceAll(secret, '[REDACTED]');
  return text;
}
// Node writes large appends in chunks; unserialized concurrent appends interleave lines.
export class EventLog {
  private chain: Promise<void> = Promise.resolve();
  constructor(
    private path: string,
    private serialize: (record: unknown) => string = JSON.stringify,
  ) {}
  append(record: Record<string, unknown>): Promise<void> {
    const line = this.serialize(truncateLarge(record)) + '\n';
    const next = this.chain.then(() => appendFile(this.path, line));
    this.chain = next.catch(() => {});
    return next;
  }
  flush() {
    return this.chain;
  }
}
