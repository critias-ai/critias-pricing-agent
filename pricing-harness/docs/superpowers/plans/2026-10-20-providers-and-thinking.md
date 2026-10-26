# Providers from .env and a thinking-level control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anthropic and Gemini work next to OpenAI and OpenRouter, chosen only by `.env`, and the UI lets the user pick a thinking level per question.

**Architecture:** A pure `chooseProvider(env, stored)` in `src/provider.ts` replaces the `PRICING_PROVIDER`/`PRICING_MODEL` requirement in `loadConfig`. `harness.config.json` loses its `model` block. After the model is resolved, Pi's `getSupportedThinkingLevels` and `clampThinkingLevel` give the model's levels and a default of `medium`; `/api/status` reports them, `POST /api/messages` accepts an optional `thinkingLevel`, and a selector in the composer sends it.

**Tech Stack:** TypeScript, Fastify, `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` 1.0.4, React, Vitest, Playwright.

Spec: [2026-10-20-providers-and-thinking-design.md](../specs/2026-10-20-providers-and-thinking-design.md). All commands run from `pricing-harness/`.

---

### Task 1: Provider choice

**Files:**
- Modify: `src/defaults.ts:2`, `package.json` (dependencies)
- Create: `src/provider.ts`, `tests/unit/provider.test.ts`

- [ ] **Step 1: Make `@earendil-works/pi-ai` a direct dependency**

Run: `npx npm@11 install --save-exact @earendil-works/pi-ai@1.0.4`
Expected: `package.json` lists `"@earendil-works/pi-ai": "1.0.4"`; `package-lock.json` and `npm-shrinkwrap.json` change only by that entry.

- [ ] **Step 2: Write the failing test** (`tests/unit/provider.test.ts`)

```ts
import {describe, expect, it} from 'vitest';
import {chooseProvider} from '../../src/provider.js';
describe('provider choice', () => {
  it('uses the only provider that has a key and a model', () => {
    expect(chooseProvider({ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-sonnet-5-5'}, [])).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-5-5',
    });
    expect(chooseProvider({GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-flash-latest'}, []).provider).toBe('google');
  });
  it('prefers openai, then openrouter, then google, then anthropic', () => {
    const all = {
      OPENAI_API_KEY: 'k', OPENAI_MODEL: 'a',
      OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'b',
      GEMINI_API_KEY: 'k', GEMINI_MODEL: 'c',
      ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'd',
    };
    expect(chooseProvider(all, []).provider).toBe('openai');
    const {OPENAI_API_KEY, ...noOpenai} = all;
    expect(chooseProvider(noOpenai, []).provider).toBe('openrouter');
    const {OPENROUTER_API_KEY, ...noRouter} = noOpenai;
    expect(chooseProvider(noRouter, []).provider).toBe('google');
  });
  it('counts a stored ChatGPT login as the OpenAI key', () => {
    expect(chooseProvider({OPENAI_MODEL: 'gpt-6-luna'}, ['openai'])).toEqual({provider: 'openai', modelId: 'gpt-6-luna'});
    expect(() => chooseProvider({OPENAI_MODEL: 'gpt-6-luna'}, [])).toThrow(/No model provider/);
  });
  it('skips a provider with a key but no model, and one with a model but no key', () => {
    expect(
      chooseProvider({OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm', GEMINI_MODEL: 'g'}, []).provider,
    ).toBe('anthropic');
  });
  it('lets PRICING_PROVIDER and PRICING_MODEL override the choice', () => {
    expect(chooseProvider({PRICING_PROVIDER: 'openrouter', PRICING_MODEL: 'x/y'}, [])).toEqual({
      provider: 'openrouter',
      modelId: 'x/y',
    });
    expect(
      chooseProvider({ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm', PRICING_MODEL: 'other'}, []).modelId,
    ).toBe('other');
    expect(() => chooseProvider({PRICING_PROVIDER: 'other', PRICING_MODEL: 'x'}, [])).toThrow(
      /openai, openrouter, google, anthropic/,
    );
    expect(() => chooseProvider({PRICING_PROVIDER: 'google'}, [])).toThrow(/PRICING_MODEL or GEMINI_MODEL/);
  });
  it('names what to set when nothing is configured', () => {
    expect(() => chooseProvider({}, [])).toThrow(/ANTHROPIC_API_KEY and ANTHROPIC_MODEL/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/provider.test.ts`
Expected: FAIL, cannot find `../../src/provider.js`.

- [ ] **Step 4: Implement** (`src/defaults.ts` line 2 becomes the first line below; create `src/provider.ts`)

```ts
export const PROVIDERS = ['openai', 'openrouter', 'google', 'anthropic'] as const;
```

```ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {PROVIDERS} from './defaults.js';
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_ENV: Record<Provider, {key: string; model: string}> = {
  openai: {key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL'},
  openrouter: {key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL'},
  google: {key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL'},
  anthropic: {key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL'},
};
// Pi keeps saved logins (such as "Sign in with ChatGPT") in auth.json, keyed by provider.
export function storedCredentialProviders(): string[] {
  try {
    return Object.keys(JSON.parse(readFileSync(join(getAgentDir(), 'auth.json'), 'utf8')));
  } catch {
    return [];
  }
}
const set = (value: string | undefined) => value?.trim() || undefined;
// Which provider answers is decided by .env alone: the first of PROVIDERS with a key and a model.
// PRICING_PROVIDER and PRICING_MODEL override it (evals, scripted runs, the launcher's model argument).
export function chooseProvider(env: NodeJS.ProcessEnv, stored: string[] = storedCredentialProviders()) {
  const modelFor = (p: Provider) => set(env.PRICING_MODEL) ?? set(env[PROVIDER_ENV[p].model]);
  const explicit = set(env.PRICING_PROVIDER);
  if (explicit) {
    if (!(PROVIDERS as readonly string[]).includes(explicit))
      throw new Error(`PRICING_PROVIDER must be one of ${PROVIDERS.join(', ')}`);
    const modelId = modelFor(explicit as Provider);
    if (!modelId) throw new Error(`PRICING_MODEL or ${PROVIDER_ENV[explicit as Provider].model} is required`);
    return {provider: explicit as Provider, modelId};
  }
  for (const provider of PROVIDERS) {
    const modelId = modelFor(provider);
    if (modelId && (set(env[PROVIDER_ENV[provider].key]) || stored.includes(provider))) return {provider, modelId};
  }
  throw new Error(
    'No model provider is configured. Set a key and a model in .env, for example ANTHROPIC_API_KEY and ANTHROPIC_MODEL ' +
      '(or OPENAI_*, OPENROUTER_*, GEMINI_*).',
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/unit/provider.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json npm-shrinkwrap.json src/defaults.ts src/provider.ts tests/unit/provider.test.ts
git commit -m "feat: choose the model provider from .env keys and models"
```

---

### Task 2: Config reads the provider from .env only

**Files:**
- Modify: `src/runtime.ts:50-69`, `src/settings.ts`, `harness.config.json`, `scripts/start-macos.sh:7-8`, `scripts/start-windows.ps1:4-7`
- Test: `tests/unit/runtime.test.ts`, `tests/unit/settings.test.ts`, `tests/unit/defaults.test.ts`

- [ ] **Step 1: Update the tests**

`tests/unit/runtime.test.ts`: replace the two tests that name the old messages.

```ts
  it('requires a model for the chosen provider and an absolute interpreter', () => {
    expect(() => loadConfig({...env, PRICING_MODEL: ''})).toThrow(/PRICING_MODEL or OPENROUTER_MODEL/);
    expect(() => loadConfig({...env, PRICING_PYTHON: 'python'})).toThrow(/absolute/);
  });
```

and in the "bounded local defaults" test replace the last line with:

```ts
    expect(() => loadConfig({...env, PRICING_PROVIDER: 'other'})).toThrow(/openai, openrouter, google, anthropic/);
```

Add:

```ts
  it('picks the provider from per-provider keys and models', () => {
    const {PRICING_PROVIDER, PRICING_MODEL, ...rest} = env;
    const config = loadConfig({...rest, ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-sonnet-5-5'});
    expect(config.provider).toBe('anthropic');
    expect(config.modelId).toBe('claude-sonnet-5-5');
  });
```

`tests/unit/settings.test.ts`: remove `model: {...}` from `settings`, give `base` an explicit model (`PRICING_PROVIDER: 'openrouter', PRICING_MODEL: 'explicit/model'`), and replace the test "loads model and budgets from one file..." with:

```ts
it('loads budgets and runtime limits from one file and lets the environment override them', () => {
  const path = fixture(settings);
  const config = loadConfig({...base, PRICING_CONFIG_FILE: path});
  expect(config.port).toBe(4318);
  expect(config.duckdbMemoryLimit).toBe('2GB');
  expect(config.workflowLimits).toEqual({milliseconds: 600000, model: 100, tool: 60});
  expect(
    loadConfig({...base, PRICING_CONFIG_FILE: path, PRICING_ANALYSIS_SECONDS: '900'}).workflowLimits.milliseconds,
  ).toBe(900000);
});
it('no longer accepts a model in the file', () => {
  const path = fixture({schemaVersion: 1, model: {provider: 'openrouter', id: 'x'}});
  expect(() => loadConfig({...base, PRICING_CONFIG_FILE: path})).toThrow(/Unknown settings key: config.model/);
});
```

Fix any other assertion in that file that reads `config.modelId` or `config.thinkingLevel` from the file (delete it). `tests/unit/defaults.test.ts` keeps its explicit `PRICING_PROVIDER`; it needs no change unless it asserts `PROVIDERS`.

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run tests/unit/runtime.test.ts tests/unit/settings.test.ts tests/unit/defaults.test.ts`
Expected: FAIL on the changed assertions.

- [ ] **Step 3: Implement**

`src/runtime.ts`: add `import {chooseProvider} from './provider.js';`, drop `PROVIDERS` from the `defaults.js` import, and replace the lines from `const provider = required('PRICING_PROVIDER');` through its `if (!(PROVIDERS...` check with:

```ts
  const {provider, modelId} = chooseProvider(env);
```

then change `provider,` / `modelId: required('PRICING_MODEL'),` in the returned object to `provider,` / `modelId,`.

`src/settings.ts`: in `HarnessSettings` delete the `model?` line; in `readHarnessSettings` remove `'model'` from the top-level key list and delete `if (s.model !== undefined) model(s.model, 'model');`; keep the local `model` helper (used by `evaluation.model`); in `settingsForRuntime` delete the `for (const [key, value] of Object.entries(settings?.model ?? {}))` loop.

`harness.config.json`: delete the whole `"model": {...},` block (keep `evaluation.model`).

`scripts/start-macos.sh`: delete `export PRICING_PROVIDER=openrouter` (keep the line that exports `PRICING_MODEL="$2"`); change the usage text to `[model-id]`.

`scripts/start-windows.ps1`: delete `$env:PRICING_PROVIDER = 'openrouter'`; change the usage text to `[model-id]`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/runtime.test.ts tests/unit/settings.test.ts tests/unit/defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime.ts src/settings.ts harness.config.json scripts tests/unit
git commit -m "feat: provider and model come only from .env"
```

---

### Task 3: Supported thinking levels and the medium default

**Files:**
- Modify: `src/runtime.ts` (add `thinkingChoices`), `src/application.ts`
- Test: `tests/unit/runtime.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/unit/runtime.test.ts`)

```ts
import {thinkingChoices} from '../../src/runtime.js';
describe('thinking levels', () => {
  const choices = async (provider: string, modelId: string, requested?: string) => {
    const {model} = await resolveModel({provider, modelId, maxOutputTokens: 8000} as HarnessConfig);
    return thinkingChoices(model, requested);
  };
  it('lists the levels each model supports and defaults to medium', async () => {
    const gemini = await choices('google', 'gemini-flash-latest');
    expect(gemini.levels).toEqual(['minimal', 'low', 'medium', 'high']);
    expect(gemini.defaultLevel).toBe('medium');
    const claude = await choices('anthropic', 'claude-sonnet-5-5');
    expect(claude.levels).not.toContain('off');
    expect(claude.defaultLevel).toBe('medium');
  });
  it('keeps an explicit level and falls back when a model lacks medium', async () => {
    expect((await choices('google', 'gemini-flash-latest', 'high')).defaultLevel).toBe('high');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/runtime.test.ts -t "thinking levels"`
Expected: FAIL, `thinkingChoices` is not exported.

- [ ] **Step 3: Implement**

In `src/runtime.ts` add to the imports `import {clampThinkingLevel, getSupportedThinkingLevels} from '@earendil-works/pi-ai';` and, below `resolveModel`:

```ts
// The levels the model accepts, and the level to start at: PRICING_THINKING_LEVEL if set, else medium or the nearest
// level the model supports.
export function thinkingChoices(model: NonNullable<CreateAgentSessionOptions['model']>, requested?: string) {
  return {
    levels: getSupportedThinkingLevels(model) as string[],
    defaultLevel: (requested ?? clampThinkingLevel(model, 'medium')) as NonNullable<HarnessConfig['thinkingLevel']>,
  };
}
```

In `src/application.ts`: change the signature line to `export async function createApplication(config0: HarnessConfig = loadConfig(), options = {requireVisualization: true}) {`, then right after `const {runtime: modelRuntime, model} = await resolveModel(config0);` add:

```ts
  const {levels: thinkingLevels, defaultLevel} = thinkingChoices(model, config0.thinkingLevel);
  const config: HarnessConfig = {...config0, thinkingLevel: defaultLevel};
```

and move the earlier uses of `config` (openWorkspace, openFileStore, validateBundle, checkRuntime) to `config0`. Add `thinkingChoices` to the import from `./runtime.js`, pass `thinkingLevels` into `new RunController({...})`, and return `{config, paths, files, bundle, health, view, controller, thinkingLevels}`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime.ts src/application.ts tests/unit/runtime.test.ts
git commit -m "feat: supported thinking levels and a medium default"
```

---

### Task 4: Per-question level on the server

**Files:**
- Modify: `src/contracts.ts:99`, `src/agent/runs.ts` (options, `submit`, `start`), `src/routes/chat.ts` (`/api/status`)
- Test: `tests/unit/runs.test.ts`

- [ ] **Step 1: Write the failing test** (add to `tests/unit/runs.test.ts`, reusing its controller helper)

Read how that file builds a `RunController` first (`grep -n "new RunController" tests/unit/runs.test.ts`), then add a test that builds it with `thinkingLevels: ['low', 'medium']` and checks:

```ts
await expect(controller.submit({requestId: 'r1', text: 'hi', fileIds: [], thinkingLevel: 'xhigh'})).rejects.toMatchObject({
  code: 'INVALID_REQUEST',
});
await expect(controller.submit({requestId: 'r2', text: 'hi', fileIds: [], thinkingLevel: 'low'})).resolves.toMatchObject({
  requestId: 'r2',
});
```

and that the workflow runner receives `config.thinkingLevel === 'low'` for the second request (the file's fake runner already records its request; assert on `request.config.thinkingLevel`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/runs.test.ts`
Expected: FAIL, `xhigh` is accepted.

- [ ] **Step 3: Implement**

`src/contracts.ts:99`: `export type SubmitRequest = {requestId: string; text: string; fileIds: string[]; thinkingLevel?: string};`

`src/agent/runs.ts`: add `thinkingLevels?: readonly string[];` to the constructor options type; in `submit`, extend the validation `if` with

```ts
      (input.thinkingLevel !== undefined &&
        (typeof input.thinkingLevel !== 'string' || !(this.options.thinkingLevels ?? []).includes(input.thinkingLevel))) ||
```

placed before the closing of the condition (and change its message to `'Provide requestId, a question, fileIds and, optionally, a supported thinking level'`); in `start`, after `const {files, paths, config, view} = this.options;` add

```ts
    const runConfig = input.thinkingLevel
      ? {...config, thinkingLevel: input.thinkingLevel as NonNullable<typeof config.thinkingLevel>}
      : config;
```

and use `runConfig` in the `new WorkflowOrchestrator({config: runConfig, ...})` call and for `createSourceProfiler`/`createFindingDetector` leave `config`.

`src/routes/chat.ts` `/api/status`: replace the `thinkingLevel: app.config.thinkingLevel,` line with

```ts
    thinkingLevel: app.config.thinkingLevel,
    thinkingLevels: app.thinkingLevels,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/runs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/contracts.ts src/agent/runs.ts src/routes/chat.ts tests/unit/runs.test.ts
git commit -m "feat: accept a supported thinking level per question"
```

---

### Task 5: The selector in the composer

**Files:**
- Modify: `src/ui/Composer.tsx`, `src/ui/App.tsx`, `src/ui/styles.css:96`
- Test: `tests/browser/app.spec.ts`

- [ ] **Step 1: Write the failing browser test** (append to `tests/browser/app.spec.ts`)

```ts
test('the thinking level is chosen beside Send and travels with the question', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  const select = page.getByLabel('Thinking level');
  await expect(select).toBeVisible();
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await select.selectOption('low');
  const body = page.waitForRequest(r => r.url().endsWith('/api/messages') && r.method() === 'POST');
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  expect((await body).postDataJSON().thinkingLevel).toBe('low');
});
```

(If the fixture server's model does not offer `low`, use the first option other than the default; read `tests/browser/fixture-server.ts` for its model.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/browser/app.spec.ts -g "thinking level"`
Expected: FAIL, no element labelled "Thinking level".

- [ ] **Step 3: Implement**

`src/ui/Composer.tsx`: change the props to `{uploading, upload, levels, level, setLevel}` (types `string[]`, `string`, `(level: string) => void`) and add, before the `<AuiIf ... isRunning>` blocks:

```tsx
          {levels.length > 1 && (
            <label className="thinking">
              <span>Thinking</span>
              <select aria-label="Thinking level" value={level} onChange={event => setLevel(event.target.value)}>
                {levels.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
```

`src/ui/App.tsx`: extend `Status` with `thinkingLevel?: string; thinkingLevels?: string[];`, then add

```tsx
  const levels = status?.thinkingLevels ?? [],
    [level, setLevelState] = useState('');
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
```

change `ask` to `submit({requestId: crypto.randomUUID(), text, fileIds: [], thinkingLevel: level || undefined})`, and render `<Composer uploading={uploading} upload={picked => void upload(picked)} levels={levels} level={level} setLevel={setLevel} />`.

`src/ui/styles.css` after line 99:

```css
.thinking{display:flex;align-items:center;gap:var(--space-2);font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-muted)}
.thinking select{font:inherit;color:inherit;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:2px var(--space-2)}
```

(Use the variable names already defined in `styles.css`; check with `grep -n "^\s*--color" src/ui/styles.css | head` and substitute any that do not exist.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test tests/browser/app.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/browser/app.spec.ts
git commit -m "feat: thinking-level selector beside Send"
```

---

### Task 6: Docs and full check

**Files:**
- Modify: `.env.example`, `README.md`, `docs/local-setup.md`, `docs/open-items.md` (if it mentions the old variables); site `critias.ai/content/pages/install.md`

- [ ] **Step 1: Rewrite `.env.example`**

```
# Credentials stay local. Never commit .env or paste credentials.
# Set a key and a model for the provider you use. The app picks the first provider that has both,
# in this order: OpenAI, OpenRouter, Gemini, Anthropic.
# OpenAI also works with a stored "Sign in with ChatGPT" login: set only OPENAI_MODEL.
OPENAI_API_KEY=
OPENAI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
# Optional: force one provider and model, for example in scripts.
# PRICING_PROVIDER=anthropic
# PRICING_MODEL=claude-sonnet-5-5
# Optional starting thinking level (the UI selector overrides it per question). Default: medium.
# PRICING_THINKING_LEVEL=medium
```

Keep the rest of the existing file (workspace and limits comments) below it unchanged.

- [ ] **Step 2: Update the README and local setup**

Run `grep -n "OPENROUTER\|PRICING_PROVIDER\|PRICING_MODEL\|harness.config.json\|model.provider" README.md docs/local-setup.md docs/*.md` and rewrite each hit: the model is chosen in `.env` (four providers, first configured wins), `harness.config.json` holds only budgets and runtime limits, the thinking level is chosen in the UI.

- [ ] **Step 3: Update the site install page**

In the site repository's `content/pages/install.md`, make the same change to the "Choose a model" step, keeping its Windows variant, then run `npm test` there.

- [ ] **Step 4: Full check**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run && npx playwright test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: configure providers in .env; thinking level in the UI"
```
