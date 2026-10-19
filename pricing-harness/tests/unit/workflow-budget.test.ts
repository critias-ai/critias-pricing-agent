import {expect, it} from 'vitest';
import {WorkflowBudget} from '../../src/agent/workflow/budget.js';
const limits = {milliseconds: 600000, model: 3, tool: 5};
it('stops at the deadline and at the model and tool ceilings', () => {
  let now = 0;
  const b = new WorkflowBudget(limits, () => now);
  now = 599999;
  expect(() => b.check()).not.toThrow();
  expect(b.remaining()).toEqual({milliseconds: 1, model: 3, tool: 5});
  now = 600000;
  expect(() => b.check()).toThrow(/deadline/);
  const c = new WorkflowBudget(limits);
  for (let i = 0; i < 3; i++) {
    c.debit('model');
    c.usage({input: 1, output: 1, cost: {total: 0}});
  }
  expect(() => c.debit('model')).toThrow(/model budget/);
  expect(c.metrics().counters.model).toBe(3);
});
it('allows two provider retries', () => {
  const b = new WorkflowBudget(limits);
  b.debit('retry');
  b.debit('retry');
  expect(() => b.debit('retry')).toThrow(/retry/);
});
it('stops only after repeated identical evidence pairs', () => {
  const c = new WorkflowBudget(limits);
  c.observe(' read a ', ' same ');
  c.observe('read a', 'different');
  c.observe('read a', 'same');
  expect(() => c.observe('read a', 'same')).not.toThrow();
  expect(() => c.observe('read a', 'same')).toThrow(/progress/);
});
it('counts successful zero costs and identifies absent usage rather than assuming zero', () => {
  const b = new WorkflowBudget(limits);
  b.debit('model');
  b.usage({input: 1, output: 2, cost: {total: 0}});
  expect(b.metrics().estimatedCostUSD).toBe(0);
  expect(b.metrics().usageComplete).toBe(true);
  b.debit('model');
  b.usage(undefined);
  expect(b.metrics().usageComplete).toBe(false);
  expect(() => b.debit('model')).toThrow(/usage/);
});
it('counts time from the run start, not from the budget construction', () => {
  const b = new WorkflowBudget(limits, () => 100000, 40000);
  expect(b.remaining().milliseconds).toBe(540000);
});
