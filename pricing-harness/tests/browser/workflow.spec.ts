import {test, expect} from 'playwright/test';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
test.use({trace: 'on'});
test('retains checked results through reconnect, restoration and cancellation', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
  await page.getByLabel('Your question').fill('partial synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
  const before = await (await page.request.get('/api/session')).json();
  const rich = before.messages.find((message: any) => message.exploration);
  expect(before.runs.at(-1).outcome.kind).toBe('complete');
  await page.request.post('/test/tamper-conversation');
  await page.request.post('/test/restart');
  await page.reload();
  await expect(page.locator('.exploration')).toHaveCount(1);
  const restored = await (await page.request.get('/api/session')).json();
  expect(
    restored.messages.find((message: any) => message.id === rich.id).exploration.tables[0].rows[0].cells.revenue.value,
  ).toBe(10);
  await page.getByLabel('Your question').fill('Next fixture question');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText('Which metric should I use?', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.locator('.exploration')).toHaveCount(2);
  await page.getByLabel('Your question').fill('slow synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await page.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
  await expect(page.locator('.exploration')).toHaveCount(2);
  await page.getByLabel('Your question').fill('Synthetic handoff failure');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(
    page.getByText('Could not produce a checked answer. Retained analysis files are drafts.', {exact: true}).last(),
  ).toBeVisible();
  await expect(page.getByText(/ENAMETOOLONG|internal-handoff-123.45/)).toHaveCount(0);
  await expect(page.locator('.message.assistant').last().locator('.badge')).toHaveText('No checked answer');
  await expect(page.getByRole('button', {name: 'Retry', exact: true}).last()).toBeVisible();
  await page.request.post('/test/change-source');
  await page.request.post('/test/restart');
  await page.reload();
  await expect(page.locator('.exploration')).toHaveCount(0);
  await expect(page.getByText(/Rerun the analysis to explore it/)).toHaveCount(2);
});
