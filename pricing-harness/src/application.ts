import {loadConfig, checkRuntime, resolveModel, thinkingChoices, type HarnessConfig} from './runtime.js';
import {openWorkspace} from './workspace.js';
import {loadCurrentConversation, saveConversation} from './conversations.js';
import {loadRuns, openFileStore} from './files.js';
import {validateBundle} from './agent/bundle.js';
import {createPricingSession} from './agent/session.js';
import {EventView} from './agent/events.js';
import {restoreExplorations} from './agent/workflow/exploration-restore.js';
import {RunController} from './agent/runs.js';
export async function createApplication(config0: HarnessConfig = loadConfig(), options = {requireVisualization: true}) {
  // Uploads, context, conversations and analysis output are private business data: everything this process and its
  // children create is owner-only, whatever the workspace's parent folder allows.
  process.umask(0o077);
  const paths = await openWorkspace(config0.workspaceRoot),
    files = await openFileStore(paths, {maxUploadBytes: config0.maxUploadBytes});
  const bundle = await validateBundle(config0.bundledRoot, options);
  const health = await checkRuntime(config0);
  const {runtime: modelRuntime, model} = await resolveModel(config0);
  const {levels: thinkingLevels, defaultLevel} = thinkingChoices(model, config0.thinkingLevel);
  const config: HarnessConfig = {...config0, thinkingLevel: defaultLevel};
  const createSession = (fresh: boolean) => createPricingSession({config, bundle, modelRuntime, model, fresh});
  const handle = await createSession(false);
  const view = new EventView(handle, {runs: await loadRuns(paths), artifacts: files.listArtifacts()});
  {
    const saved = await loadCurrentConversation(paths);
    if (saved) {
      saved.messages = await restoreExplorations(paths.root, saved.sessionId, saved.messages);
      await saveConversation(paths, saved, false);
    }
    view.useLogical(saved);
  }
  const controller = new RunController({
    config,
    paths,
    files,
    health,
    handle,
    view,
    createSession,
    explorationEnabled: options.requireVisualization,
    thinkingLevels,
  });
  return {config, paths, files, bundle, health, view, controller, thinkingLevels};
}
export type Application = Awaited<ReturnType<typeof createApplication>>;
