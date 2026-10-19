import {main} from '../../src/headless.js';
import type {Application} from '../../src/application.js';
let complete!: (value: any) => void;
const record = {id: 'test', state: 'completed'};
const app = {
  view: {subscribe: () => () => {}},
  controller: {
    submit: async () => ({runId: 'test', sessionId: 'test', requestId: 'signal-test'}),
    waitForRun: () => new Promise(r => (complete = r)),
    snapshot: () => ({busy: false}),
    cancel: async () => {
      complete?.({...record, state: 'cancelled'});
    },
    close: async () => {},
  },
  config: {},
  health: {},
  bundle: {},
} as unknown as Application;
await main([], async () => {
  process.stdout.write('READY\n');
  return app;
});
