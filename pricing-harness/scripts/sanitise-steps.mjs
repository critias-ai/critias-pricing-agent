// Usage: node scripts/sanitise-steps.mjs <steps.jsonl> > tests/fixtures/recorded-steps.jsonl
// Replaces machine-specific run, step, home-directory, and temporary workspace identifiers.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';

export function sanitiseSteps(content, home = homedir()) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const steps = lines.map(line => JSON.parse(line));
  const runIds = new Set(steps.map(step => step.runId).filter(Boolean));
  const stepIds = new Map();

  return steps.map(step => {
    if (!stepIds.has(step.stepId)) stepIds.set(step.stepId, `step-${stepIds.size + 1}`);
    let text = JSON.stringify({...step, runId: 'recorded-run', stepId: stepIds.get(step.stepId)});
    for (const runId of runIds) text = text.replaceAll(runId, 'recorded-run');
    if (home) text = text.replaceAll(home, '~');
    text = text.replace(/\/Users(?:\/[A-Za-z0-9._-]+)*(?:…)?/g, '[path]');
    text = text.replace(/\/private\/tmp\/pricing-assistant-ui-steps-[^/\s"']+(?:\/workspace)?/g, '~/workspace');
    return text;
  });
}

const inputPath = process.argv[2];
if (!inputPath) {
  process.stderr.write('Usage: node scripts/sanitise-steps.mjs <steps.jsonl>\n');
  process.exitCode = 1;
} else {
  const content = readFileSync(inputPath, 'utf8');
  for (const line of sanitiseSteps(content)) process.stdout.write(line + '\n');
}
