import {expect, it} from 'vitest';
import {join} from 'node:path';
import {
  buildStagePrompt,
  followUpPrompt,
  preloadedMethod,
  recheckPrompt,
} from '../../src/agent/workflow/stage-prompt.js';
import {analystPrompt} from '../../src/agent/workflow/role-prompts.js';
import {resumePrompt, runawayPrompt} from '../../src/agent/workflow/transient-error.js';
const until = Date.parse('2026-10-14T12:00:00.000Z');
it('preloads the routing skill, shared rules and metric verification, but not an analysis skill', () => {
  const text = preloadedMethod(join(process.cwd(), 'bundled'));
  expect(text).toContain('Pricing triage');
  expect(text).toContain('Unresolved basis');
  expect(text).toContain('Bound before holding');
  expect(text).not.toContain('name: pricing-analyze');
  expect(text).not.toMatch(/^---\nname:/m);
});
it('puts the whole task in the first prompt and only the question in a follow-up', () => {
  const first = buildStagePrompt({
    question: 'Review revenue',
    until,
    stageDir: '/w/.pricing/workflow/c/analyst',
    context: '# ctx',
    sources: [
      {relativePath: 'files/a.csv', sha256: 'a', kind: 'csv'},
      {relativePath: 'files/notes.md', sha256: 'n', kind: 'markdown'},
    ],
    profilesPath: '/w/.pricing/source-profiles.json',
    dataFindings: {findingsDir: '/c/findings-1', total: 1, findings: [], gaps: []},
    paths: {root: '/w', cache: '/w/.pricing/data-cache', tmp: '/w/.pricing/tmp'},
    config: {pythonPath: '/py', bundledRoot: '/b', duckdbMemoryLimit: '4GB', duckdbThreads: 4},
  });
  expect(first).toContain('Question: Review revenue');
  expect(first).toContain('/w/.pricing/workflow/c/analyst');
  expect(first).toContain('files/a.csv\nfiles/notes.md');
  expect(first).toContain('read files the query tool saved');
  expect(first).not.toContain('harness_session');
  expect(first).not.toContain('prepare_source');
  expect(first).toContain('/w/.pricing/source-profiles.json');
  expect(first).toContain('name the finding ids and the amount');
  expect(first).toContain('/c/findings-1/findings.json');
  expect(first).not.toContain('Data findings:'.concat('undefined'));
  const withoutFindings = buildStagePrompt({
    ...({} as any),
    question: 'q',
    until,
    stageDir: '/s',
    context: '',
    sources: [],
    profilesPath: '/p',
    paths: {root: '/w', cache: '/c', tmp: '/t'},
    config: {pythonPath: '/py', bundledRoot: '/b', duckdbMemoryLimit: '4GB', duckdbThreads: 4},
  });
  expect(withoutFindings).not.toContain('Data findings');
  expect(followUpPrompt('And Q4?', until)).toMatch(
    /^Follow-up question: And Q4\?\n\nDeadline: 2026-10-14T11:59:00.000Z/,
  );
  expect(recheckPrompt(['12,345.67', '900'])).toBe(
    '<harness-note>\nThese figures in your reply do not appear in any executed output: 12,345.67, 900. Recompute them with a script or remove them. Send your complete reply again, not only the changed part.\n</harness-note>',
  );
});
it('marks every harness message, and tells the analyst the user never sees them', () => {
  for (const text of [recheckPrompt(['900']), resumePrompt, runawayPrompt])
    expect(text).toMatch(/^<harness-note>\n[\s\S]+\n<\/harness-note>$/);
  expect(analystPrompt).toMatch(/<harness-note>[\s\S]*user never sees them/);
});
