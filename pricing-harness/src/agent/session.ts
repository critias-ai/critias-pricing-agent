import {join} from 'node:path';
import {
  DefaultResourceLoader,
  SettingsManager,
  SessionManager,
  createAgentSession,
  createBashToolDefinition,
  type ToolDefinition,
  type AgentSession,
  type ModelRuntime,
  type CreateAgentSessionOptions,
  type ExtensionFactory,
} from '@earendil-works/pi-coding-agent';
import {openWorkspace} from '../workspace.js';
import {toShellPath as sh, type HarnessConfig} from '../runtime.js';
import type {BundleInfo} from './bundle.js';
export type AgentHandle = {session: AgentSession; manager: SessionManager; bundle: BundleInfo};
export function analysisEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !/(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name)),
  );
}
// Compact well before the window edge: a conversation grows about 45k tokens per turn, and a request
// cancelled at the edge for compaction is the failure this avoids.
const compactionReserve = (model: {contextWindow?: number}) => Math.round((model.contextWindow ?? 200000) * 0.4);
export async function createPricingSession(options: {
  config: HarnessConfig;
  bundle: BundleInfo;
  modelRuntime: ModelRuntime;
  model: NonNullable<CreateAgentSessionOptions['model']>;
  fresh: boolean;
  stage?: {
    directory: string;
    systemPrompt: string;
    tools: ToolDefinition[];
    toolNames: string[];
    extensions?: ExtensionFactory[];
  };
}): Promise<AgentHandle> {
  const {config, bundle, modelRuntime, model} = options;
  const paths = await openWorkspace(config.workspaceRoot);
  const agentDir = options.stage ? join(options.stage.directory, 'pi') : join(paths.metadata, 'pi');
  const settingsManager = SettingsManager.inMemory({
    packages: [],
    extensions: [],
    skills: [],
    prompts: [],
    themes: [],
    ...(options.stage
      ? {
          retry: {enabled: false, maxRetries: 0, provider: {maxRetries: 0, timeoutMs: 120000}},
          cacheWarming: 'off',
          compaction: {enabled: true, reserveTokens: compactionReserve(model), keepRecentTokens: 20000},
        }
      : {}),
  });
  const prompt = `You are a local pricing analysis assistant. Read .pricing/context.md and relevant registered documentation before analysing. Confirm material business mappings, metric, currency, calendar, exclusions and comparisons. Do not invent reusable facts; record only confirmed facts in context.md. Pricing skills describe methods; select and read the appropriate SKILL.md and its references progressively. The bundled pricing baseline is B2B; ask which methods apply to the actual business instead of imposing a B2B workflow. Use executed Python/SQL calculations and reconcile full-population results. Never change files/ sources or controller run.json. Use the configured Python ${sh(config.pythonPath)}. Read ${sh(join(config.bundledRoot, 'harness-tools/data-analysis.md'))} for the SQL session and DuckDB helpers; never load a large source wholly into pandas or send it to the model. Resource limits: DuckDB ${config.duckdbMemoryLimit}, ${config.duckdbThreads} threads. Each prompt supplies the current run paths and source inventory. Return checked answers in chat. For useful charts/tables read analysis-visualize and use the present tool on saved result files. Small answers can stay text-only. Report unsupported results and exclusions clearly. Ordinary shell/file tools are available, not an OS sandbox. Do not include credentials in scripts, logs, reports or chat.`;
  const resourceLoader = new DefaultResourceLoader({
    cwd: options.stage?.directory ?? paths.root,
    agentDir,
    settingsManager,
    noSkills: true,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    extensionFactories: options.stage?.extensions ?? [],
    additionalSkillPaths: bundle.skillPaths,
    systemPromptOverride: () => options.stage?.systemPrompt ?? prompt,
    appendSystemPromptOverride: () => [],
  });
  await resourceLoader.reload();
  const loaded = resourceLoader.getSkills();
  if (
    loaded.diagnostics.length ||
    loaded.skills.length !== bundle.skillNames.length ||
    loaded.skills.some(s => !bundle.skillNames.includes(s.name))
  )
    throw new Error('Packaged skill inventory has diagnostics, missing skills or duplicates');
  const home = options.stage?.directory ?? paths.root,
    sessions = options.stage ? join(home, 'sessions') : paths.sessions;
  let manager = options.fresh ? SessionManager.create(home, sessions) : SessionManager.continueRecent(home, sessions);
  const entry = manager
    .getEntries()
    .filter(e => e.type === 'custom' && e.customType === 'harness-bundle')
    .at(-1);
  if (
    !options.fresh &&
    (!entry || entry.type !== 'custom' || (entry.data as {fingerprint?: string})?.fingerprint !== bundle.fingerprint)
  )
    manager = SessionManager.create(home, sessions);
  if (!manager.getEntries().some(e => e.type === 'custom' && e.customType === 'harness-bundle'))
    manager.appendCustomEntry('harness-bundle', {fingerprint: bundle.fingerprint});
  const bash = createBashToolDefinition(paths.root, {
    spawnHook: context => ({...context, env: analysisEnvironment(context.env)}),
  });
  // SDK customTools erases schema types; retain the built-in definition's runtime schema.
  const {session, modelFallbackMessage} = await createAgentSession({
    cwd: options.stage?.directory ?? paths.root,
    agentDir,
    modelRuntime,
    model,
    thinkingLevel: config.thinkingLevel,
    sessionManager: manager,
    settingsManager,
    resourceLoader,
    tools: options.stage?.toolNames ?? ['read', 'bash', 'edit', 'write'],
    customTools: options.stage?.tools ?? [bash as unknown as ToolDefinition],
  });
  if (modelFallbackMessage || session.model?.id !== model.id || session.model?.provider !== model.provider) {
    session.dispose();
    throw new Error('Configured model could not be selected; fallback is disabled');
  }
  if (config.thinkingLevel && session.thinkingLevel !== config.thinkingLevel) {
    session.dispose();
    throw new Error('Configured reasoning level is unsupported by the selected model; fallback is disabled');
  }
  return {session, manager, bundle};
}
