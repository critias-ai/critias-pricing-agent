import {useEffect, useMemo, useState} from 'react';
import {AssistantRuntimeProvider, useExternalStoreRuntime} from '@assistant-ui/react';
import type {ChatMessage, RunAccepted, SessionSnapshot, SourceFile, SubmitRequest} from '../contracts.js';
import {useSession} from './useSession.js';
import {api, post, APIError} from './api.js';
import {Thread} from './Thread.js';
import {ThreadContext, type ThreadValue} from './thread-context.js';
import {Composer} from './Composer.js';
import {Sources} from './Sources.js';
import {Announcer} from './Announcer.js';
import {Conversations} from './Conversations.js';
import {appendText, firstAssistantIdByRun, toThreadMessage} from './thread-messages.js';
// Vendored from the Critias design system logo files; keep in sync, do not edit here.
import wordmarkInk from './critias-wordmark-ink.svg';
import wordmarkMarble from './critias-wordmark-marble.svg';
type Status = {
  modelId: string;
  thinkingLevel?: string;
  thinkingLevels?: string[];
  health: {agent: {ready: boolean; detail: string}; python: {ready: boolean; detail: string}};
};
const NO_MESSAGES: ChatMessage[] = [];
export function App() {
  const {snapshot, activeRun, connected, error, setError, replace} = useSession();
  const [status, setStatus] = useState<Status | null>(null),
    [files, setFiles] = useState<SourceFile[]>([]),
    [uploading, setUploading] = useState(false),
    [uncertain, setUncertain] = useState<SubmitRequest | null>(null),
    [sidebar, setSidebar] = useState(false);
  const levels = status?.thinkingLevels ?? [],
    [level, setLevelState] = useState('');
  // The level is remembered per conversation in this browser; a new conversation starts at the server's default.
  const levelKey = `critias.thinking.${snapshot?.sessionId ?? ''}`;
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(levelKey);
    } catch {}
    setLevelState(saved && levels.includes(saved) ? saved : (status?.thinkingLevel ?? ''));
  }, [levelKey, status]);
  const setLevel = (next: string) => {
    setLevelState(next);
    try {
      localStorage.setItem(levelKey, next);
    } catch {}
  };
  useEffect(() => {
    if (connected) {
      void api<Status>('/status')
        .then(setStatus)
        .catch(e => setError(e.message));
      void api<{files: SourceFile[]}>('/files')
        .then(v => setFiles(v.files))
        .catch(e => setError(e.message));
    }
  }, [connected]);
  // B7: fileIds is always empty, which the server treats as "every workspace source".
  const submit = async (request: SubmitRequest) => {
    setError('');
    try {
      await post<RunAccepted>('/messages', request);
      setUncertain(null);
    } catch (e) {
      setError((e as Error).message);
      const rejected = e instanceof APIError && e.status < 500;
      setUncertain(rejected ? null : request);
      // assistant-ui clears the composer on send; a rejected question goes back so it isn't lost.
      if (rejected) runtime.thread.composer.setText(request.text);
    }
  };
  const ask = (text: string) =>
    submit({requestId: crypto.randomUUID(), text, fileIds: [], thinkingLevel: level || undefined});
  const upload = async (picked: File[]) => {
    setUploading(true);
    setError('');
    try {
      for (const file of picked) {
        const form = new FormData();
        form.append('file', file);
        const source = await api<SourceFile>('/files', {method: 'POST', body: form});
        setFiles(old => [...old, source]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const act = async (path: string) => {
    try {
      replace(await post<SessionSnapshot>(path));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const switchTo = (path: string) => {
    setUncertain(null);
    setError('');
    setSidebar(false);
    void act(path);
  };
  const ready = !!(status?.health.agent.ready && status?.health.python.ready);
  const messages = snapshot?.messages ?? NO_MESSAGES;
  const runs = useMemo(
    () => (snapshot?.runs ?? []).filter(run => run.sessionId === snapshot?.sessionId),
    [snapshot?.runs, snapshot?.sessionId],
  );
  const busy = snapshot?.busy ?? false;
  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages,
    isRunning: busy,
    isDisabled: !connected || !ready || !!uncertain,
    convertMessage: toThreadMessage,
    onNew: async message => {
      await ask(appendText(message));
    },
    onCancel: async () => {
      await act('/cancel');
    },
  });
  const thread = useMemo<ThreadValue>(
    () => ({messages, runs, firstByRun: firstAssistantIdByRun(messages), busy, retry: q => void ask(q)}),
    [messages, runs, busy],
  );
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadContext.Provider value={thread}>
        <div className={`app${sidebar ? ' sidebar-open' : ''}`}>
          <Conversations
            current={snapshot?.sessionId}
            disabled={busy || !connected}
            refresh={`${connected}-${snapshot?.sessionId}-${runs.length}-${busy}`}
            open={id => switchTo(`/conversations/${encodeURIComponent(id)}/open`)}
            start={() => switchTo('/session/new')}
          />
          {sidebar && (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="Close conversations"
              onClick={() => setSidebar(false)}
            />
          )}
          <div className="workspace">
            <header className="topbar">
              <div className="brand">
                <picture>
                  <source srcSet={wordmarkMarble} media="(prefers-color-scheme: dark)" />
                  <img src={wordmarkInk} alt="Critias" />
                </picture>
                <span>{status?.modelId ?? 'Connecting to workspace'}</span>
              </div>
              <div className="header-actions">
                <span className={`connection ${connected ? 'online' : ''}`}>
                  {connected ? 'Connected' : 'Reconnecting…'}
                </span>
                <button
                  type="button"
                  className="sidebar-toggle"
                  aria-expanded={sidebar}
                  onClick={() => setSidebar(open => !open)}
                >
                  Conversations
                </button>
              </div>
            </header>
            <main className="chat-panel">
              {!ready && status && (
                <div className="notice">
                  {!status.health.agent.ready ? status.health.agent.detail : status.health.python.detail}
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  <span>{error}</span>
                  {uncertain ? (
                    <>
                      <button type="button" disabled={!connected} onClick={() => void submit(uncertain)}>
                        Retry same request
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runtime.thread.composer.setText(uncertain.text);
                          setUncertain(null);
                          setError('');
                        }}
                      >
                        Keep editing
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setError('')}>
                      Dismiss
                    </button>
                  )}
                </div>
              )}
              <Thread activeRun={activeRun} />
              <Composer
                uploading={uploading}
                upload={picked => void upload(picked)}
                levels={levels}
                level={level}
                setLevel={setLevel}
              />
            </main>
            <footer className="bottom-bar">
              <Sources files={files} />
              <details className="bar-section">
                <summary>Recent analysis · {runs.length} requests</summary>
                <ul className="runs">
                  {runs
                    .slice(-5)
                    .reverse()
                    .map(run => (
                      <li key={run.id}>
                        <strong>{run.outcome?.kind ?? run.state}</strong>
                        <span>{new Date(run.startedAt).toLocaleTimeString()}</span>
                      </li>
                    ))}
                </ul>
              </details>
            </footer>
            <Announcer snapshot={snapshot} activeRun={activeRun} />
          </div>
        </div>
      </ThreadContext.Provider>
    </AssistantRuntimeProvider>
  );
}
