import {test, expect} from 'playwright/test';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
test('reopens an earlier conversation with its chart from the sidebar', async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  const sidebar = page.getByRole('navigation', {name: 'Conversations'});
  await page.getByRole('button', {name: 'New conversation'}).click();
  await expect(sidebar.getByRole('button', {name: 'Untitled conversation'})).toHaveAttribute('aria-current', 'true');
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  const first = (await (await page.request.get('/api/session')).json()).sessionId;
  const entry = sidebar.locator('li button', {hasText: 'Explore synthetic'}).first();
  await expect(entry).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', {name: 'New conversation'}).click();
  await expect(page.locator('.exploration')).toHaveCount(0);
  await expect(entry).toBeEnabled();
  await entry.click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  await expect(page.locator('.exploration')).toHaveCount(1);
  expect((await (await page.request.get('/api/session')).json()).sessionId).toBe(first);
  await expect(entry).toHaveAttribute('aria-current', 'true');
});
test('opens the conversation list as a drawer on a phone', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  const sidebar = page.getByRole('navigation', {name: 'Conversations'});
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', {name: 'Conversations'}).click();
  await expect(sidebar).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', {name: 'Close conversations'}).click({position: {x: 370, y: 400}});
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', {name: 'Conversations'}).click();
  await sidebar.getByRole('button', {name: 'New conversation'}).click();
  await expect(sidebar).toBeHidden();
});
