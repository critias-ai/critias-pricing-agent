import {expect, it} from 'vitest';
import {cp, mkdtemp, rm, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
it('validates full bundled pricing references and fingerprints installation-independent bytes', async () => {
  const {validateBundle} = await import('../../src/agent/bundle.js');
  const root = resolve('bundled');
  const a = await validateBundle(root, {requireVisualization: false});
  expect(a.skillNames).toHaveLength(7 + 17); // skills and knowledge cards
  const copy = join(await mkdtemp(join(tmpdir(), 'bundle ')), 'bundled');
  await cp(root, copy, {recursive: true});
  expect((await validateBundle(copy, {requireVisualization: false})).fingerprint).toBe(a.fingerprint);
  await mkdir(join(copy, 'harness-tools/__pycache__'), {recursive: true});
  await writeFile(join(copy, 'harness-tools/__pycache__/generated.pyc'), 'temporary');
  expect((await validateBundle(copy, {requireVisualization: false})).fingerprint).toBe(a.fingerprint);
  await writeFile(join(copy, 'pricing-plugin/skills/knowledge/index.md'), 'changed');
  expect((await validateBundle(copy, {requireVisualization: false})).fingerprint).not.toBe(a.fingerprint);
  await rm(join(copy, 'pricing-plugin/skills/knowledge/index.md'));
  await expect(validateBundle(copy, {requireVisualization: false})).rejects.toThrow(/reference|resource/);
});
// Each skill links the cards it can need directly, not only through the knowledge index (validateBundle checks the links resolve).
const cardLinks: Record<string, string[]> = {
  intake: ['metric-verification', 'retail-economics', 'recurring-metrics', 'hybrid-offers'],
  triage: [
    'price-waterfall',
    'metric-verification',
    'margin-drivers',
    'price-realization',
    'price-change-economics',
    'recurring-metrics',
    'retail-economics',
    'hybrid-offers',
  ],
  scan: [
    'metric-verification',
    'peer-comparisons',
    'discount-governance',
    'evidence-ranking',
    'price-change-economics',
    'price-waterfall',
    'price-realization',
    'retail-economics',
    'experiments-and-promotions',
    'recurring-metrics',
    'renewals-and-migration',
    'recurring-scenarios',
    'segmentation',
  ],
  analyze: [
    'metric-verification',
    'margin-drivers',
    'price-realization',
    'peer-comparisons',
    'price-change-economics',
    'price-waterfall',
    'retail-economics',
    'recurring-metrics',
    'recurring-scenarios',
    'experiments-and-promotions',
  ],
  recommend: [
    'evidence-ranking',
    'price-change-economics',
    'margin-drivers',
    'peer-comparisons',
    'discount-governance',
    'segmentation',
    'value-estimation',
    'offer-architecture',
    'experiments-and-promotions',
    'recurring-scenarios',
    'renewals-and-migration',
  ],
  design: [
    'discount-governance',
    'segmentation',
    'value-estimation',
    'offer-architecture',
    'hybrid-offers',
    'price-waterfall',
    'peer-comparisons',
    'price-change-economics',
    'recurring-scenarios',
  ],
  execute: [
    'price-realization',
    'price-change-economics',
    'discount-governance',
    'renewals-and-migration',
    'experiments-and-promotions',
    'recurring-scenarios',
  ],
};
it('links every knowledge card directly from at least two skills', async () => {
  const {readFile, readdir} = await import('node:fs/promises');
  const skills = resolve('bundled/pricing-plugin/skills');
  const cards = [...(await readdir(join(skills, 'knowledge'))), ...(await readdir(join(skills, 'knowledge/methods')))]
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .map(f => f.slice(0, -3));
  for (const [skill, linked] of Object.entries(cardLinks)) {
    const text = await readFile(join(skills, `pricing-${skill}/SKILL.md`), 'utf8');
    for (const card of linked)
      expect(text, `${skill} → ${card}`).toMatch(new RegExp(`\\]\\(\\.\\./knowledge/(methods/)?${card}\\.md\\)`));
  }
  for (const card of cards)
    expect(Object.values(cardLinks).filter(l => l.includes(card)).length, card).toBeGreaterThanOrEqual(2);
});
