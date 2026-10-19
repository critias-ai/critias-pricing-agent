import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import type {Interface} from 'node:readline';
import {createApplication} from './application.js';
export async function main(args = process.argv.slice(2), factory = createApplication) {
  const app = await factory(undefined, {requireVisualization: !args.includes('--pricing-only')});
  if (args.includes('--status')) {
    process.stdout.write(
      JSON.stringify({
        model: app.config.modelId,
        thinkingLevel: app.config.thinkingLevel,
        health: app.health,
        skills: app.bundle.skillNames,
      }) + '\n',
    );
    await app.controller.close();
    return;
  }
  const output = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
  const unsubscribe = app.view.subscribe(event => output({type: 'event', event}));
  const turn = async (input: {text: string; fileIds?: string[]; requestId?: string}) => {
    const accepted = await app.controller.submit({
      requestId: input.requestId ?? randomUUID(),
      text: input.text,
      fileIds: input.fileIds ?? [],
    });
    output({type: 'accepted', ...accepted});
    const run = await app.controller.waitForRun(accepted.runId);
    output({type: 'turn_end', run, snapshot: app.controller.snapshot()});
    if (run.state === 'failed') process.exitCode = 1;
  };
  let inputLines: Interface | undefined;
  const stop = () => {
    inputLines?.close();
    void app.controller.cancel();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const questionIndex = args.indexOf('--question');
    if (questionIndex >= 0) {
      const question = args[questionIndex + 1];
      if (!question) throw new Error('--question requires text');
      await turn({text: question});
    } else {
      const tasks = new Set<Promise<void>>();
      const lines = (inputLines = createInterface({input: process.stdin, crlfDelay: Infinity}));
      for await (const line of lines) {
        if (!line.trim()) continue;
        let input: any;
        try {
          input = JSON.parse(line);
        } catch {
          output({type: 'error', error: {code: 'INVALID_REQUEST', message: 'Expected JSON line'}});
          continue;
        }
        if (input.type === 'close') {
          await Promise.allSettled(tasks);
          lines.close();
          break;
        }
        if (input.type === 'cancel') {
          await app.controller.cancel();
          continue;
        }
        const task = turn(input.type === 'submit' ? input.request : input).catch(() => {
          output({
            type: 'error',
            error: {
              code: 'REQUEST_FAILED',
              message: 'Question could not be accepted; inspect readiness and busy state',
            },
          });
        });
        tasks.add(task);
        void task.finally(() => tasks.delete(task));
      }
      await Promise.allSettled(tasks);
    }
  } finally {
    inputLines?.close();
    unsubscribe();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await app.controller.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => {
    process.stderr.write(
      `Harness failed: ${error instanceof Error ? error.message : String(error)}\nCheck configuration, dependencies and model credentials.\n`,
    );
    process.exitCode = 1;
  });
