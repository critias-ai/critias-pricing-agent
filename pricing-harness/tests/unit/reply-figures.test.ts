import {expect, it} from 'vitest';
import {unverifiedFigures} from '../../src/agent/workflow/reply-figures.js';
const output = JSON.stringify({revenue: 139548.1458, lines: 22423, shares: [100, 200, 300]});
it('accepts figures that appear in executed output, rounded to the reply precision', () => {
  expect(unverifiedFigures('Revenue was £139,548.15 over 22,423 lines.', [output])).toEqual([]);
  expect(unverifiedFigures('About £139,548 across 22423 lines.', [output])).toEqual([]);
  expect(unverifiedFigures('Shares of 100, 200 and 300.', [output])).toEqual([]);
});
it('names figures missing from every executed output', () => {
  expect(unverifiedFigures('Revenue was £139,548.15 and margin £12,345.67.', [output])).toEqual(['12,345.67']);
});
it('accepts a printed fraction shown as a percentage, and only as one', () => {
  const rates = JSON.stringify({q2: 0.47694188135600524, q3: 0.40105425866313027});
  expect(unverifiedFigures('Margin was 47.69% in Q2 and 40.11 percent in Q3.', [rates])).toEqual([]);
  expect(unverifiedFigures('Sales of £47.69 and £40.11.', [rates])).toEqual(['47.69', '40.11']);
});
it('accepts the difference of two verified figures within their rounding, and names a wrong one', () => {
  const rates = JSON.stringify({q2: 0.47694188135600524, q3: 0.40105425866313027});
  expect(unverifiedFigures('From 47.69% to 40.11%, a fall of 7.59 pp.', [rates])).toEqual([]);
  expect(unverifiedFigures('From 47.69% to 40.11%, a fall of 7.58 pp.', [rates])).toEqual([]);
  expect(unverifiedFigures('From 47.69% to 40.11%, a fall of 7.87 pp.', [rates])).toEqual(['7.87']);
});
it('ignores short numbers, years, dates and identifiers', () => {
  const reply = 'In 2011, between 2011-12-01 and 12/12/2011, finding F-9e59 (Q3) covered 42 of 7.5 lines.';
  expect(unverifiedFigures(reply, [output])).toEqual([]);
});
