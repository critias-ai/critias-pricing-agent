import {useEffect, useRef, useState} from 'react';
import type {SessionSnapshot} from '../contracts.js';
import type {ActiveRun} from './useSession.js';
import {useRunSteps} from './steps-store.js';
import {stageViews} from './run-view.js';
import {announcement, messageOutcome} from './outcome.js';
export function Announcer({snapshot, activeRun}: {snapshot: SessionSnapshot | null; activeRun: ActiveRun | null}) {
  const steps = useRunSteps(activeRun?.id);
  const stage = activeRun ? stageViews(steps, Date.now()).find(view => view.state === 'running')?.label : undefined;
  const messages = snapshot?.messages ?? [];
  const runs = snapshot?.runs ?? [];
  const index = messages.length - 1;
  const last = messages[index];
  const answerKey = last?.role === 'assistant' ? `${last.id}:${runs.at(-1)?.outcome?.kind ?? ''}` : '';
  const [text, setText] = useState('');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (stage) setText(`${stage} stage started`);
  }, [stage, activeRun?.id]);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = answerKey;
      return;
    }
    if (!answerKey || answerKey === seen.current || !last) return;
    seen.current = answerKey;
    setText(announcement(messageOutcome(messages, runs, index)));
  }, [answerKey]);
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {text}
    </div>
  );
}
