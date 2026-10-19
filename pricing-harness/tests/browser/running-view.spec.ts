import {test, expect, type Page} from 'playwright/test';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
test.use({trace: 'on'});
const stepCount = async (page: Page) =>
  Number(
    (
      (await page
        .locator('.step-list > summary')
        .textContent()
        .catch(() => '')) ?? ''
    ).match(/\d+/)?.[0] ?? 0,
  );
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  // The workspace keeps uploads across tests, so wait for this upload by count, not for a fixed "1 file".
  const expected = ((await (await page.request.get('/api/files')).json()) as {files: unknown[]}).files.length + 1;
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
  await expect(page.getByText(`Sources · ${expected} ${expected === 1 ? 'file' : 'files'}`)).toBeVisible();
});
test('shows the running view within a second, restores it after reload and summarises the run', async ({page}) => {
  test.setTimeout(60000);
  await page.getByLabel('Your question').fill('Recorded synthetic');
  const sent = Date.now();
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.locator('.running .stage.running')).toBeVisible({timeout: 1000});
  expect(Date.now() - sent).toBeLessThan(1000);
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(2);
  const before = await stepCount(page);
  await page.reload();
  await expect(page.locator('.running .stepper')).toBeVisible();
  await expect(page.locator('.running .live-line')).toBeVisible();
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(before);
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible({timeout: 45000});
  await expect(page.locator('.running')).toHaveCount(0);
  await expect(page.locator('.run-summary').first()).toHaveText(/\d+ steps · \d+:\d\d/);
});
test('lists steps, reveals retried detail and never re-renders earlier messages on steps', async ({page}) => {
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  const earlier = page.locator('.message.assistant').first();
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(2);
  const rendersBefore = Number(await earlier.getAttribute('data-renders'));
  const stepsBefore = await stepCount(page);
  await expect.poll(() => stepCount(page), {timeout: 15000}).toBeGreaterThanOrEqual(stepsBefore + 6);
  const rendersAfter = Number(await earlier.getAttribute('data-renders'));
  expect(rendersAfter - rendersBefore).toBeLessThanOrEqual(2);
  await page.locator('.step-list > summary').click();
  await expect(page.locator('.step-list h4').first()).toBeVisible();
  const retried = page.locator('.step.retried').first();
  await expect(retried).toContainText('Ran margin.py · retried');
  await retried.locator('summary').click();
  await expect(retried.locator('pre')).toContainText('Binder Error');
});
test('follows the dark system theme and respects reduced motion', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  const dot = page.locator('.live-line .dot');
  await expect(dot).toBeVisible();
  expect(await dot.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.locator('.running .elapsed')).toHaveText(/\d+:\d\d/);
});
test('Esc does not stop a running analysis', async ({page}) => {
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByRole('button', {name: 'Stop', exact: true})).toBeVisible();
  await page.getByLabel('Your question').press('Escape');
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', {name: 'Stop', exact: true})).toBeVisible();
});
