import {useEffect, useState} from 'react';
import type {RunRecord, Step} from '../contracts.js';
import {useRunSteps} from './steps-store.js';
import {
  formatDuration,
  liveLine,
  runSummary,
  STAGE_LABEL,
  stageViews,
  stepMs,
  toolGroups,
  type StageView,
} from './run-view.js';
function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
export function Stepper({stages}: {stages: StageView[]}) {
  return (
    <ol className="stepper">
      {stages.map(view => (
        <li
          key={view.stage}
          className={`stage ${view.state}`}
          aria-current={view.state === 'running' ? 'step' : undefined}
        >
          <span>{view.label}</span>
          <span className="stage-meta">
            {view.state === 'skipped' ? 'Not needed' : view.ms !== undefined ? formatDuration(view.ms) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function StepRow({step, now}: {step: Step; now: number}) {
  const icon =
    step.state === 'running' ? (
      <span className="dot" aria-hidden="true" />
    ) : (
      <span aria-hidden="true">{step.state === 'retried' ? '↻' : '✓'}</span>
    );
  const label = step.state === 'retried' ? `${step.summary} · retried` : step.summary;
  const line = (
    <>
      {icon}
      <span>{label}</span>
      <span className="step-duration">{formatDuration(stepMs(step, now))}</span>
    </>
  );
  return (
    <li className={`step ${step.state}`}>
      {step.state === 'retried' && step.detail ? (
        <details>
          <summary>{line}</summary>
          <pre>{step.detail}</pre>
        </details>
      ) : (
        line
      )}
    </li>
  );
}
// F4 layout A: stepper, one live line, and the full step list one click away.
export function RunningView({runId, startedAt}: {runId: string; startedAt: string}) {
  const steps = useRunSteps(runId);
  const now = useNow();
  const live = liveLine(steps);
  const groups = toolGroups(steps);
  const total = groups.reduce((n, g) => n + g.steps.length, 0);
  return (
    <section className="running" aria-label="Analysis in progress">
      <Stepper stages={stageViews(steps, now)} />
      <p className="live-line">
        <span className={`dot${live.waiting ? ' waiting' : ''}`} aria-hidden="true" />
        <span>{live.label}</span>
        {live.last && <span className="live-last">· {live.last.summary}</span>}
        <span className="elapsed">{formatDuration(now - Date.parse(startedAt))}</span>
      </p>
      {total > 0 && (
        <details className="step-list">
          <summary>Show all {total} steps</summary>
          {groups.map((group, index) => (
            <div key={`${group.stage}-${index}`}>
              <h4>{STAGE_LABEL[group.stage]}</h4>
              <ol>
                {group.steps.map(step => (
                  <StepRow key={step.stepId} step={step} now={now} />
                ))}
              </ol>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
export function RunSummary({run}: {run: RunRecord}) {
  const steps = useRunSteps(run.id);
  return <p className="run-summary">{runSummary(steps, run)}</p>;
}
