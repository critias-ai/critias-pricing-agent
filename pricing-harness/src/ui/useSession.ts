import {useEffect, useRef, useState} from 'react';
import type {HarnessEvent, SessionSnapshot} from '../contracts.js';
import {api} from './api.js';
import {reduceEvent} from './state.js';
import {stepsStore} from './steps-store.js';
export type ActiveRun = {id: string; startedAt: string};
export function useSession() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null),
    [connected, setConnected] = useState(false),
    [live, setLive] = useState<ActiveRun | null>(null),
    [error, setError] = useState('');
  const current = useRef<SessionSnapshot | null>(null);
  useEffect(() => {
    let alive = true,
      synced = false,
      generation = 0,
      buffer: HarnessEvent[] = [];
    const source = new EventSource('/api/events');
    const apply = (event: HarnessEvent) => {
      if (!current.current) return;
      const next = reduceEvent(current.current, event);
      // Stale or duplicate events, such as those buffered during the handshake, must not
      // overwrite newer step states seeded from the snapshot.
      if (next === current.current) return;
      current.current = next;
      if (event.type === 'error') setError(event.payload.message);
      if (event.type === 'step') stepsStore.apply(event.payload);
      if (event.type === 'status' && event.runId && event.payload.startedAt)
        setLive(old => (old?.id === event.runId ? old : {id: event.runId!, startedAt: event.payload.startedAt!}));
      if (event.type === 'settled' && !event.payload.snapshot.activeRun) setLive(null);
      if (event.type !== 'step') setSnapshot(next);
    };
    const handshake = async () => {
      const ticket = ++generation;
      synced = false;
      buffer = [];
      try {
        const state = await api<SessionSnapshot>('/session');
        if (!alive || ticket !== generation) return;
        current.current = state;
        stepsStore.seed(state.activeSteps);
        setLive(null);
        setSnapshot(state);
        synced = true;
        for (const event of buffer) apply(event);
        buffer = [];
        setConnected(true);
      } catch {
        if (alive) {
          setConnected(false);
          setError('Connection unavailable. Reconnect to recover the current conversation.');
        }
      }
    };
    source.onopen = () => {
      void handshake();
    };
    source.onerror = () => {
      generation++;
      synced = false;
      setConnected(false);
    };
    source.onmessage = message => {
      try {
        const event = JSON.parse(message.data) as HarnessEvent;
        if (!synced) {
          buffer.push(event);
          return;
        }
        if (event.type === 'hello') return;
        if (
          current.current &&
          event.type !== 'settled' &&
          (event.serverInstanceId !== current.current.serverInstanceId || event.sessionId !== current.current.sessionId)
        ) {
          void handshake();
          return;
        }
        apply(event);
      } catch {
        setError('An event could not be read; reconnect to recover.');
      }
    };
    return () => {
      alive = false;
      source.close();
      generation++;
    };
  }, []);
  const replace = (next: SessionSnapshot) => {
    current.current = next;
    stepsStore.seed(next.activeSteps);
    if (!next.activeRun) setLive(null);
    setSnapshot(next);
  };
  const run = snapshot?.activeRun;
  const activeRun: ActiveRun | null = run ? {id: run.id, startedAt: run.startedAt} : live;
  return {snapshot, activeRun, connected, error, setError, replace};
}
