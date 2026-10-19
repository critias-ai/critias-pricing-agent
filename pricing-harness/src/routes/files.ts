import type {FastifyInstance} from 'fastify';
import {createReadStream} from 'node:fs';
import type {Application} from '../application.js';
import {HarnessError} from '../contracts.js';
export async function fileRoutes(server: FastifyInstance, app: Application) {
  server.get('/api/files', async () => ({files: app.files.listSources()}));
  server.post('/api/files', async (request, reply) => {
    if (app.controller.snapshot().busy)
      throw new HarnessError('BUSY', 'An analysis is busy; wait before uploading', 409);
    const file = await request.file({limits: {fileSize: app.config.maxUploadBytes, files: 1}});
    if (!file || file.fieldname !== 'file') throw new HarnessError('INVALID_FILE', 'Upload one file using field file');
    const source = await app.files.saveUpload(file.file, file.filename);
    if (file.file.truncated) throw new HarnessError('FILE_TOO_LARGE', 'File exceeds upload limit', 413);
    return reply.code(201).send(source);
  });
  server.get('/api/outputs', async () => ({artifacts: app.files.listArtifacts()}));
  server.get<{Params: {id: string}; Querystring: {download?: string}}>('/api/outputs/:id', async (request, reply) => {
    const {artifact, path} = await app.files.resolveArtifact(request.params.id);
    reply.type(artifact.mediaType);
    reply.header('X-Content-Type-Options', 'nosniff');
    if (request.query.download === '1')
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`);
    if (artifact.mediaType === 'text/html')
      reply.header(
        'Content-Security-Policy',
        "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:",
      );
    return reply.send(createReadStream(path));
  });
}
