import {test, expect} from 'playwright/test';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
test.use({trace: 'on'});
test('uploads sources, reconnects without resubmission and starts a new bounded conversation', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
  await expect(page.getByText('Sources · 1 file')).toBeVisible();
  let posts = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/messages') && request.method() === 'POST') posts++;
  });
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  const original = (await (await page.request.get('/api/session')).json()).messages.find((m: any) => m.exploration);
  await page.request.post('/test/disconnect');
  await page.reload();
  await expect(page.getByText(/Synthetic checked values/)).toHaveCount(1);
  await expect(page.locator('.exploration')).toHaveCount(1);
  expect(posts).toBe(1);
  expect((await (await page.request.get('/api/session')).json()).messages.find((m: any) => m.exploration).id).toBe(
    original.id,
  );
  await page.getByRole('button', {name: 'New conversation'}).click();
  await expect(page.getByRole('heading', {name: /Turn sales/})).toBeVisible();
  await expect(page.locator('.exploration')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Preview', exact: true})).toHaveCount(0);
});
test('stop before approval settles without publishing rich numbers', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await page.getByLabel('Your question').fill('slow synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByRole('button', {name: 'Stop', exact: true})).toBeVisible();
  const stopped = Date.now();
  await page.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
  expect(Date.now() - stopped).toBeLessThan(2000);
  await expect(page.locator('.exploration')).toHaveCount(0);
});
test('keeps a rejected question in the composer', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.route('**/api/messages', route => route.fulfill({status: 409, json: {error: {message: 'Busy'}}}));
  await page.getByLabel('Your question').fill('Keep this question');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByRole('alert')).toContainText('Busy');
  await expect(page.getByLabel('Your question')).toHaveValue('Keep this question');
});
test('blocks requests to other origins, such as an image in a reply', async ({page}) => {
  await page.goto('/');
  const blocked = await page.evaluate(
    () =>
      new Promise(resolve => {
        document.addEventListener('securitypolicyviolation', e => resolve(e.blockedURI), {once: true});
        document.body.append(Object.assign(new Image(), {src: 'https://example.com/x.png'}));
      }),
  );
  expect(blocked).toBe('https://example.com/x.png');
});
