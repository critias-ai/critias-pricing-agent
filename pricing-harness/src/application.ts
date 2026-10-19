import {loadConfig, checkRuntime, resolveModel, type HarnessConfig} from './runtime.js';
import {openWorkspace} from './workspace.js';
import {loadCurrentConversation, saveConversation} from './conversations.js';
import {loadRuns, openFileStore} from './files.js';
import {validateBundle} from './agent/bundle.js';
import {createPricingSession} from './agent/session.js';
import {EventView} from './agent/events.js';
import {restoreExplorations} from './agent/workflow/exploration-restore.js';
import {RunController} from './agent/runs.js';
export async function createApplication(config: HarnessConfig = loadConfig(), options = {requireVisualization: true}) {
  const paths = await openWorkspace(config.workspaceRoot),
    files = await openFileStore(paths, {maxUploadBytes: config.maxUploadBytes});
  const bundle = await validateBundle(config.bundledRoot, options);
  const health = await checkRuntime(config);
  const {runtime: modelRuntime, model} = await resolveModel(config);
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
  });
  return {config, paths, files, bundle, health, view, controller};
}
export type Application = Awaited<ReturnType<typeof createApplication>>;
