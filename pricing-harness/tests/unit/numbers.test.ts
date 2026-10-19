import {expect, it} from 'vitest';
import {createElement} from 'react';
import {isNumericCell, textOf} from '../../src/ui/numbers.js';
it('recognises numeric table cells', () => {
  for (const text of ['£1,234.50', '36.09%', '-12', '(1,200)', '2 EA', ' 10 ', '10 GBP'])
    expect(isNumericCell(text), text).toBe(true);
  for (const text of ['Q1', 'Unavailable', '', 'Product 60', '—']) expect(isNumericCell(text), text).toBe(false);
});
it('flattens React children to text', () => {
  expect(textOf(['£', createElement('strong', null, '10'), null, false])).toBe('£10');
});
