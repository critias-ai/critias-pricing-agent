import {createContext} from 'react';
import type {ChatMessage, RunRecord} from '../contracts.js';
export type ThreadValue = {
  messages: readonly ChatMessage[];
  runs: readonly RunRecord[];
  firstByRun: Map<string, string>;
  busy: boolean;
  retry: (question: string) => void;
};
export const ThreadContext = createContext<ThreadValue>({
  messages: [],
  runs: [],
  firstByRun: new Map(),
  busy: false,
  retry: () => {},
});
