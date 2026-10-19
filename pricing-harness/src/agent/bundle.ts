import {readFile, readdir, stat, realpath} from 'node:fs/promises';
import {resolve, relative, join, dirname} from 'node:path';
import {createHash} from 'node:crypto';
export type BundleInfo = {
  fingerprint: string;
  pricingVersion: string;
  pricingCommit: string;
  visualizationVersion: string;
  skillPaths: string[];
  skillNames: string[];
};
export const pricingNames = [
  'pricing-intake',
  'pricing-analyze',
  'pricing-scan',
  'pricing-recommend',
  'pricing-design',
  'pricing-execute',
  'pricing-triage',
];
export async function validateBundle(root: string, options = {requireVisualization: true}): Promise<BundleInfo> {
  root = await realpath(root);
  const versions = JSON.parse(await readFile(join(root, 'versions.json'), 'utf8'));
  const plugin = JSON.parse(await readFile(join(root, 'pricing-plugin/plugin.json'), 'utf8'));
  if (plugin.version !== versions.pricingVersion) throw new Error('Pricing version mismatch');
  await readFile(join(root, 'pricing-plugin/LICENSE'));
  const skillNames = [...pricingNames, ...(options.requireVisualization ? ['analysis-visualize'] : [])];
  const skillPaths = skillNames.map(name =>
    join(root, name === 'analysis-visualize' ? 'harness-skills' : 'pricing-plugin/skills', name),
  );
  // Knowledge cards are listed beside the skills (name and description in the system prompt), so the agent sees every
  // card it can read, on every turn, without going through the index. The index itself has no frontmatter.
  const knowledge = join(root, 'pricing-plugin/skills/knowledge');
  for (const dir of [knowledge, join(knowledge, 'methods')])
    for (const file of (await readdir(dir)).sort())
      if (file.endsWith('.md') && file !== 'index.md') {
        skillNames.push(file.slice(0, -3));
        skillPaths.push(join(dir, file));
      }
  for (let i = 0; i < skillPaths.length; i++) {
    const file = skillPaths[i].endsWith('.md') ? skillPaths[i] : join(skillPaths[i], 'SKILL.md');
    const text = await readFile(file, 'utf8');
    if (!text.startsWith('---\n') || !text.includes(`name: ${skillNames[i]}`) || !/^description:/m.test(text))
      throw new Error(`Invalid skill metadata: ${skillNames[i]}`);
  }
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      if (entry.name === '__pycache__' || entry.name.endsWith('.pyc') || entry.name.endsWith('.partial')) continue;
      if (entry.isSymbolicLink()) throw new Error('Bundle symlink rejected');
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(root);
  const hash = createHash('sha256');
  for (const path of files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)))) {
    const bytes = await readFile(path);
    hash.update(relative(root, path)).update('\0').update(String(bytes.length)).update('\0').update(bytes);
    if (path.endsWith('.md')) {
      const content = bytes.toString('utf8');
      for (const match of content.matchAll(/\]\(([^)\s]+)(?:[^)]*)\)/g)) {
        const link = match[1]!.split('#')[0]!;
        if (!link || /^[a-z]+:|^\//i.test(link)) continue;
        const target = resolve(dirname(path), link);
        if (relative(root, target).startsWith('..')) throw new Error(`Bundle reference escapes root: ${link}`);
        try {
          await stat(target);
        } catch {
          throw new Error(`Missing bundled reference resource: ${relative(root, path)} -> ${link}`);
        }
      }
    }
  }
  return {
    fingerprint: hash.digest('hex'),
    pricingVersion: versions.pricingVersion,
    pricingCommit: versions.pricingCommit,
    visualizationVersion: versions.visualizationVersion,
    skillPaths,
    skillNames,
  };
}
