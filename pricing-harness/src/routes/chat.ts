import type {FastifyInstance} from 'fastify';
import type {Application} from '../application.js';
import type {SubmitRequest} from '../contracts.js';
import {listConversations} from '../conversations.js';
export async function chatRoutes(server: FastifyInstance, app: Application) {
  server.get('/api/session', async () => app.controller.snapshot());
  server.post<{Body: SubmitRequest}>('/api/messages', async (request, reply) =>
    reply.code(202).send(await app.controller.submit(request.body)),
  );
  server.post('/api/cancel', async () => app.controller.cancel());
  server.post('/api/session/new', async () => app.controller.newSession());
  server.get('/api/conversations', async () => ({conversations: await listConversations(app.paths)}));
  server.post<{Params: {id: string}}>('/api/conversations/:id/open', async request =>
    app.controller.openConversation(request.params.id),
  );
  server.get('/api/status', async () => ({
    workspace: app.paths.root,
    modelId: app.config.modelId,
    thinkingLevel: app.config.thinkingLevel,
    provider: app.config.provider,
    versions: {pricing: app.bundle.pricingVersion, visualization: app.bundle.visualizationVersion, piSdk: '1.0.4'},
    skills: app.bundle.skillNames,
    health: app.health,
  }));
  server.get('/api/events', (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const snapshot = app.controller.snapshot();
    reply.raw.write(
      `data: ${JSON.stringify({serverInstanceId: snapshot.serverInstanceId, sequence: snapshot.sequence, sessionId: snapshot.sessionId, runId: snapshot.activeRun?.id ?? null, type: 'hello', payload: {sequence: snapshot.sequence}})}\n\n`,
    );
    const unsubscribe = app.view.subscribe(event => {
      if (!reply.raw.destroyed) reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(': heartbeat\n\n');
    }, 15000);
    heartbeat.unref();
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    reply.raw.on('close', close);
    reply.raw.on('error', close);
  });
}
