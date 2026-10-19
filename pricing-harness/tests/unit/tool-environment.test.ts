import {expect, it} from 'vitest';
it('keeps operational variables while excluding credential variables from analysis subprocesses', async () => {
  const {analysisEnvironment} = await import('../../src/agent/session.js');
  const env = analysisEnvironment({
    PATH: '/bin',
    HOME: '/tmp/user',
    OPENROUTER_API_KEY: 'test-value',
    AWS_SECRET_ACCESS_KEY: 'test-value',
    SOME_TOKEN: 'test-value',
    PLAYWRIGHT_BROWSERS_PATH: '/tmp/browser',
  });
  expect(env).toEqual({PATH: '/bin', HOME: '/tmp/user', PLAYWRIGHT_BROWSERS_PATH: '/tmp/browser'});
});
