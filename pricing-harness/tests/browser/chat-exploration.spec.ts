import {test, expect} from 'playwright/test';
test.use({trace: 'on'});
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
const evidence = process.env.PRICING_LOCAL_EVIDENCE ?? 'test-results';
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
});
async function send(page: import('playwright/test').Page, text = 'Explore synthetic') {
  await page.getByLabel('Your question').fill(text);
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
}
test('renders canonical checked values and supports local chart/table controls without requests or additional work', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4318/')) external.push(request.url());
  });
  await send(page);
  await page.getByRole('button', {name: 'Show 3 more views'}).click();
  const charts = page.locator('.plotly-chart');
  await expect(charts.locator('svg.main-svg').first()).toBeVisible();
  await expect(charts.nth(1).locator('.point')).toHaveCount(1);
  const revenue = page
      .locator('.result-chart')
      .filter({has: page.getByRole('heading', {name: 'Quarterly revenue', exact: true})}),
    margin = page
      .locator('.result-chart')
      .filter({has: page.getByRole('heading', {name: 'Quarterly gross margin', exact: true})});
  expect(
    await revenue
      .locator('.plotly-chart')
      .evaluate((element: any) =>
        element.data.map((trace: any) => ({x: trace.x, y: trace.y, connectgaps: trace.connectgaps})),
      ),
  ).toEqual([
    {x: ['Q1 &lt;b&gt;literal&lt;/b&gt;', 'Q2'], y: [10, 20], connectgaps: false},
    {x: ['Q1 &lt;b&gt;literal&lt;/b&gt;', 'Q2'], y: [20, 10], connectgaps: false},
  ]);
  expect(await margin.locator('.plotly-chart').evaluate((element: any) => element.data[0].y)).toEqual([36.09, null]);
  await expect(revenue.locator('.xtick').first()).toContainText('Q1 <b>literal</b>');
  const before = await (await page.request.get('/test/counters')).json(),
    snapshot = await (await page.request.get('/api/session')).json();
  const requests: string[] = [];
  const listener = (request: import('playwright').Request) => requests.push(`${request.method()} ${request.url()}`);
  page.on('request', listener);
  await margin.locator('.plotly-chart').scrollIntoViewIfNeeded();
  const point = await margin.locator('.point').boundingBox();
  await page.mouse.move(point!.x + point!.width / 2, point!.y + point!.height / 2);
  await expect(margin.locator('.hoverlayer')).toContainText('36.09%');
  await revenue.locator('.legendtoggle').first().click();
  await expect
    .poll(() => revenue.locator('.plotly-chart').evaluate((element: any) => element.data[0].visible))
    .toBe('legendonly');
  await revenue.locator('.legendtoggle').first().click();
  await expect
    .poll(() => revenue.locator('.plotly-chart').evaluate((element: any) => element.data[0].visible))
    .not.toBe('legendonly');
  await revenue.locator('.plotly-chart').scrollIntoViewIfNeeded();
  const originalRange = await revenue
    .locator('.plotly-chart')
    .evaluate((element: any) => JSON.stringify(element._fullLayout.xaxis.range));
  const drag = await revenue.locator('.nsewdrag').boundingBox();
  await page.mouse.move(drag!.x + drag!.width * 0.2, drag!.y + drag!.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(drag!.x + drag!.width * 0.8, drag!.y + drag!.height * 0.8, {steps: 12});
  await page.mouse.up();
  await expect
    .poll(() =>
      revenue.locator('.plotly-chart').evaluate((element: any) => JSON.stringify(element._fullLayout.xaxis.range)),
    )
    .not.toBe(originalRange);
  await revenue.locator('.nsewdrag').dblclick();
  await expect
    .poll(() =>
      revenue.locator('.plotly-chart').evaluate((element: any) => JSON.stringify(element._fullLayout.xaxis.range)),
    )
    .toBe(originalRange);
  await revenue.locator('[data-title="Pan"]').click();
  await revenue.locator('.plotly-chart').scrollIntoViewIfNeeded();
  const pan = await revenue.locator('.nsewdrag').boundingBox();
  await page.mouse.move(pan!.x + pan!.width * 0.4, pan!.y + pan!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(pan!.x + pan!.width * 0.7, pan!.y + pan!.height * 0.5, {steps: 10});
  await page.mouse.up();
  await expect
    .poll(() =>
      revenue.locator('.plotly-chart').evaluate((element: any) => JSON.stringify(element._fullLayout.xaxis.range)),
    )
    .not.toBe(originalRange);
  await revenue.locator('.nsewdrag').dblclick();
  const products = page
    .locator('.result-table')
    .filter({has: page.getByRole('heading', {name: 'Product units', exact: true})});
  await expect(products.locator('tbody tr')).toHaveCount(25);
  await products.getByRole('button', {name: 'Next page', exact: true}).focus();
  await page.keyboard.press('Enter');
  await expect(products).toContainText('26–50 shown');
  await products.getByRole('button', {name: /Units \(EA\)/}).focus();
  await page.keyboard.press('Enter');
  await expect(products.locator('tbody tr').first()).toContainText('2 EA');
  await products.getByRole('button', {name: /Units \(EA\)/}).click();
  await expect(products.locator('tbody tr').first()).toContainText('100 EA');
  await products.getByLabel('Search table labels').fill('Product 60');
  await expect(products.locator('tbody tr')).toHaveCount(1);
  await expect(products.getByRole('rowheader', {name: '<b>Product 60</b>', exact: true})).toBeVisible();
  await expect(products.locator('tbody b')).toHaveCount(0);
  await products.getByLabel('Search table labels').fill('no matches');
  await expect(products).toContainText('No matching rows');
  await products.getByRole('button', {name: 'Reset table', exact: true}).click();
  await expect(products.locator('tbody tr')).toHaveCount(25);
  await expect(products.locator('tbody tr').first()).toContainText('Product 1');
  expect(await revenue.locator('.plotly-chart').evaluate((element: any) => element.data[0].y)).toEqual([10, 20]);
  expect(await (await page.request.get('/test/counters')).json()).toEqual(before);
  expect((await (await page.request.get('/api/session')).json()).messages).toEqual(snapshot.messages);
  page.off('request', listener);
  expect(requests).toEqual([]);
  expect(external).toEqual([]);
  await mkdir(evidence, {recursive: true});
  for (const [label, width, height] of [
    ['desktop', 1280, 900],
    ['narrow', 390, 844],
  ] as const) {
    await page.setViewportSize({width, height});
    await expect
      .poll(() =>
        charts.evaluateAll((elements: any[]) =>
          elements.every(element => Math.abs(element._fullLayout.width - element.clientWidth) <= 1),
        ),
      )
      .toBe(true);
    await page.locator('.conversation').evaluate(element => (element.scrollTop = 0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path: join(evidence, `synthetic-chat-${label}.png`), fullPage: true});
    await revenue.locator('.plotly-chart').scrollIntoViewIfNeeded();
    await page.screenshot({path: join(evidence, `synthetic-chart-${label}.png`)});
    await margin.locator('.plotly-chart').scrollIntoViewIfNeeded();
    await page.screenshot({path: join(evidence, `synthetic-margin-${label}.png`)});
    await products.scrollIntoViewIfNeeded();
    await page.screenshot({path: join(evidence, `synthetic-table-${label}.png`)});
  }
  await writeFile(
    join(evidence, 'synthetic-chart-data.json'),
    JSON.stringify(
      {
        revenue: await revenue
          .locator('.plotly-chart')
          .evaluate((element: any) =>
            element.data.map((trace: any) => ({x: trace.x, y: trace.y, connectgaps: trace.connectgaps})),
          ),
        margin: await margin
          .locator('.plotly-chart')
          .evaluate((element: any) =>
            element.data.map((trace: any) => ({x: trace.x, y: trace.y, connectgaps: trace.connectgaps})),
          ),
        counters: before,
        controlRequests: requests,
        externalRequests: external,
      },
      null,
      2,
    ),
  );
  const wide = page
    .locator('.result-table')
    .filter({has: page.getByRole('heading', {name: 'Wide comparison table', exact: true})})
    .getByRole('region');
  await wide.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => wide.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
});
test('keeps exploration state independent across messages, preserves older scroll position and cleans up charts', async ({
  page,
}) => {
  await send(page);
  await expect(page.locator('.plotly-chart svg.main-svg').first()).toBeVisible();
  const first = page.locator('.message.assistant').first();
  await first.getByRole('button', {name: 'Show 3 more views'}).click();
  await first.getByLabel('Search table labels').first().fill('Product 60');
  await send(page);
  await expect(page.locator('.exploration')).toHaveCount(2);
  const second = page.locator('.message.assistant').last();
  await second.getByRole('button', {name: 'Show 3 more views'}).click();
  await second.getByLabel('Search table labels').first().fill('Product 2');
  await expect(first.getByLabel('Search table labels').first()).toHaveValue('Product 60');
  await page.locator('.conversation').evaluate(element => (element.scrollTop = 0));
  // The settled snapshot re-renders every message, so a higher render count proves it arrived.
  const rendersBeforeSettle = Number(await first.getAttribute('data-renders'));
  await page.request.post('/test/activity');
  await expect.poll(async () => Number(await first.getAttribute('data-renders'))).toBeGreaterThan(rendersBeforeSettle);
  expect(await page.locator('.conversation').evaluate(element => element.scrollTop)).toBe(0);
  await page.reload();
  await expect(page.locator('.exploration')).toHaveCount(2);
  for (const input of await page.getByLabel('Search table labels').all()) await expect(input).toHaveValue('');
  const plots = await page.locator('.plotly-chart').elementHandles();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await expect(page.locator('.plotly-chart')).toHaveCount(0);
  for (const plot of plots)
    expect(await plot.evaluate((element: any) => !!element.data || !!element._fullLayout)).toBe(false);
});
test('keeps verified tables and text if the lazy Plotly renderer fails', async ({page}) => {
  await page.route(/\/assets\/[^/]*plotly[^/]*\.js/, route => route.abort());
  await send(page);
  await expect(page.getByText(/This chart could not be displayed/).first()).toBeVisible();
  await page.getByRole('button', {name: 'Table', exact: true}).first().click();
  await expect(page.getByRole('region', {name: /Quarterly performance data/})).toBeVisible();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  const state = await (await page.request.get('/api/session')).json();
  expect(state.runs.at(-1).outcome.kind).toBe('complete');
  expect(state.runs.at(-1).workflow.budget.counters.model).toBe(1);
});
test('renders markdown tables with aligned numbers and mermaid diagrams locally', async ({page}) => {
  await send(page, 'Diagram synthetic');
  await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
  await expect(page.locator('.markdown td.num')).toHaveText('£10.00');
});
