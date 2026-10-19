import {existsSync} from 'node:fs';
import {fork, type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {Counter, WorkflowBudget} from './budget.js';
import {killTree} from './kill-tree.js';
import type {StageRequest, StageResult, Runner} from './contracts.js';
export class StageRunner implements Runner {
  private children = new Set<ChildProcess>();
  constructor(private options: {workerPath?: string; graceMs?: number} = {}) {}
  get activeCount() {
    return this.children.size;
  }
  execute(
    request: StageRequest,
    budget: WorkflowBudget,
    signal: AbortSignal,
    onEvent: (event: Record<string, any>) => void,
  ): Promise<StageResult> {
    budget.check();
    if (signal.aborted) return Promise.reject(new Error('cancelled'));
    return new Promise((resolve, reject) => {
      const compiled = fileURLToPath(new URL('./worker.js', import.meta.url));
      const path =
        this.options.workerPath ??
        (existsSync(compiled) ? compiled : fileURLToPath(new URL('./worker.ts', import.meta.url)));
      const worker = fork(path, [], {
        detached: process.platform !== 'win32',
        execArgv: path.endsWith('.ts') ? ['--import', 'tsx'] : [],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });
      this.children.add(worker);
      let terminal = false,
        stopping = false;
      let force: NodeJS.Timeout | undefined;
      let diagnostic = '';
      let stoppingReason = 'cancelled';
      worker.stderr?.on('data', b => {
        diagnostic = (diagnostic + b.toString()).slice(-2000);
      });
      const kill = () => {
        try {
          if (process.platform !== 'win32' && worker.pid) process.kill(-worker.pid, 'SIGKILL');
          else killTree(worker, 'SIGKILL');
        } catch {
          /* Already stopped. */
        }
      };
      const finish = (error?: Error, value?: StageResult) => {
        if (terminal) return;
        terminal = true;
        clearTimeout(deadline);
        clearTimeout(force);
        signal.removeEventListener('abort', abort);
        kill();
        this.children.delete(worker);
        error ? reject(error) : resolve(value!);
      };
      const stop = (reason: string) => {
        if (terminal || stopping) return;
        stopping = true;
        stoppingReason = reason;
        worker.send?.({type: 'abort'});
        force = setTimeout(() => finish(new Error(reason)), this.options.graceMs ?? 2000);
      };
      const abort = () => stop('cancelled');
      signal.addEventListener('abort', abort, {once: true});
      const deadline = setTimeout(() => stop('deadline exhausted'), budget.remaining().milliseconds);
      worker.on('message', (raw: any) => {
        if (terminal) return;
        // Cancellation stops work/publication, but the SDK can still settle usage
        // for the already-authorized in-flight attempt during the bounded grace.
        if (stopping) {
          if (raw.type === 'event' && raw.event.type === 'usage') {
            budget.usage(raw.event.usage);
            onEvent(raw.event);
          }
          return;
        }
        if (raw.type === 'gate') {
          try {
            budget.debit(raw.kind as Counter);
            onEvent({type: 'debit', kind: raw.kind});
            worker.send({type: 'allow', id: raw.id});
          } catch (e) {
            stop((e as Error).message);
          }
          return;
        }
        if (raw.type === 'event') {
          try {
            if (raw.event.type === 'usage') budget.usage(raw.event.usage);
            if (raw.event.type === 'operation') budget.observe(raw.event.operation, raw.event.result);
            onEvent(raw.event);
          } catch (e) {
            stop((e as Error).message);
          }
          return;
        }
        if (raw.type === 'result') finish(undefined, raw.result);
        if (raw.type === 'error') finish(new Error(raw.message));
      });
      worker.on('error', error => finish(error));
      worker.on('exit', code =>
        finish(new Error(stopping ? stoppingReason : `stage worker exited (${code}); ${diagnostic}`)),
      );
      worker.send({type: 'start', request});
    });
  }
}
