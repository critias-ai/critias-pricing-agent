export type ModelTimingRecord = {
  requestIndex: number;
  gateWaitMs: number;
  timeToFirstTokenMs: number | null;
  generationMs: number | null;
  totalMs: number;
  outputTokens: number | null;
  outputTokensPerSecond: number | null;
};
// Time to first token covers provider queueing, transport and prompt processing; generation covers streamed output.
export class ModelTiming {
  private index = 0;
  private current?: {startedAt: number; gateWaitMs: number; firstTokenAt?: number};
  start(now: number, gateWaitMs: number) {
    this.current = {startedAt: now, gateWaitMs};
  }
  token(now: number) {
    if (this.current && this.current.firstTokenAt === undefined) this.current.firstTokenAt = now;
  }
  end(now: number, outputTokens: unknown): ModelTimingRecord | undefined {
    const c = this.current;
    if (!c) return undefined;
    this.current = undefined;
    const ttft = c.firstTokenAt !== undefined ? c.firstTokenAt - c.startedAt : null,
      generation = c.firstTokenAt !== undefined ? now - c.firstTokenAt : null;
    const tokens = typeof outputTokens === 'number' && Number.isFinite(outputTokens) ? outputTokens : null;
    return {
      requestIndex: ++this.index,
      gateWaitMs: c.gateWaitMs,
      timeToFirstTokenMs: ttft,
      generationMs: generation,
      totalMs: now - c.startedAt,
      outputTokens: tokens,
      outputTokensPerSecond:
        tokens !== null && generation ? Math.round((tokens / (generation / 1000)) * 10) / 10 : null,
    };
  }
}
