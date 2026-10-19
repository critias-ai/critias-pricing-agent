import {createHash} from 'node:crypto';
export type Counter = 'model' | 'tool' | 'retry';
export type Limits = {milliseconds: number; model: number; tool: number};
export class WorkflowBudget {
  readonly started: number;
  private counts: Record<Counter, number> = {model: 0, tool: 0, retry: 0};
  private last = '';
  private repeats = 0;
  private cost = 0;
  private complete = true;
  private usageCount = 0;
  private reason?: string;
  constructor(
    readonly limits: Limits,
    private now: () => number = Date.now,
    started?: number,
  ) {
    this.started = started ?? now();
  }
  check() {
    if (this.reason) throw new Error(this.reason);
    if (this.remaining().milliseconds <= 0) this.stop('deadline exhausted');
  }
  private stop(reason: string): never {
    this.reason = reason;
    throw new Error(reason);
  }
  debit(kind: Counter) {
    this.check();
    if (kind === 'model' && (!this.complete || this.usageCount < this.counts.model))
      this.stop('missing SDK usage/cost; further model attempts stopped');
    const maximum = kind === 'retry' ? 2 : this.limits[kind];
    if (this.counts[kind] >= maximum) this.stop(`${kind} budget exhausted`);
    this.counts[kind]++;
  }
  remaining() {
    return {
      milliseconds: Math.max(0, this.limits.milliseconds - (this.now() - this.started)),
      model: this.limits.model - this.counts.model,
      tool: this.limits.tool - this.counts.tool,
    };
  }
  observe(operation: string, result: string) {
    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');
    const key = createHash('sha256')
      .update(normalize(operation) + '\0' + normalize(result))
      .digest('hex');
    this.repeats = key === this.last ? this.repeats + 1 : 1;
    this.last = key;
    if (this.repeats >= 3) this.stop('no progress: 3 identical operation/result pairs');
  }
  usage(raw: unknown) {
    this.usageCount++;
    const u = raw as {input?: number; output?: number; cost?: {total?: number}} | undefined;
    if (
      !u ||
      !Number.isFinite(u.input) ||
      !Number.isFinite(u.output) ||
      !Number.isFinite(u.cost?.total) ||
      u.cost!.total! < 0
    ) {
      this.complete = false;
      return;
    }
    this.cost += u.cost!.total!;
  }
  metrics() {
    return {
      limits: this.limits,
      elapsedMs: this.now() - this.started,
      counters: {...this.counts},
      remaining: this.remaining(),
      estimatedCostUSD: this.cost,
      usageComplete: this.complete && this.usageCount === this.counts.model,
      stoppingReason: this.reason,
    };
  }
}
