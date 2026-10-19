import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApplication, type Application} from './application.js';
import {chatRoutes} from './routes/chat.js';
import {fileRoutes} from './routes/files.js';
import {HarnessError} from './contracts.js';
export async function buildServer(app: Application) {
  const server = Fastify({logger: false, bodyLimit: 1024 * 1024});
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof HarnessError)
      return reply
        .code(error.status)
        .send({error: {code: error.code, message: error.message, retryable: error.retryable}});
    const status = (error as {statusCode?: number}).statusCode ?? 500;
    return reply.code(status).send({
      error: {
        code: status === 413 ? 'FILE_TOO_LARGE' : status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message:
          status < 500 ? 'Request could not be accepted' : 'Local operation failed; inspect retained workspace files',
        retryable: false,
      },
    });
  });
  // Local browser only. Block cross-origin writes to the unauthenticated loopback API.
  server.addHook('onRequest', async request => {
    const hosts = [`127.0.0.1:${app.config.port}`, `localhost:${app.config.port}`];
    const origin = request.headers.origin;
    if (
      !hosts.includes(request.headers.host ?? '') ||
      (origin && !hosts.map(host => `http://${host}`).includes(origin))
    )
      throw new HarnessError('INVALID_ORIGIN', 'Use the local harness browser', 403);
  });
  await server.register(multipart, {limits: {fileSize: app.config.maxUploadBytes, files: 1}});
  await chatRoutes(server, app);
  await fileRoutes(server, app);
  const root = join(app.config.appRoot, 'dist/ui');
  try {
    if ((await stat(root)).isDirectory())
      await server.register(fastifyStatic, {
        root,
        index: ['index.html'],
        // The UI must make no external requests, e.g. an image URL a model writes into a reply.
        setHeaders: reply =>
          reply.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:",
          ),
      });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  server.addHook('onClose', async () => app.controller.close());
  return server;
}
export async function main() {
  const app = await createApplication();
  const server = await buildServer(app);
  await server.listen({port: app.config.port, host: '127.0.0.1'});
  process.stdout.write(`Pricing harness: http://127.0.0.1:${app.config.port}\n`);
  if (!app.health.agent.ready)
    process.stdout.write('Configure model provider credentials before submitting an analysis.\n');
  const close = () => {
    void server.close();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => {
    process.stderr.write(
      `Startup failed: ${error instanceof Error ? error.message : String(error)}\nCheck required configuration, bundled resources and Python setup.\n`,
    );
    process.exitCode = 1;
  });
