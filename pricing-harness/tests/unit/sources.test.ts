import {expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatBytes, Sources} from '../../src/ui/Sources.js';
it('lists workspace sources in a collapsed section', () => {
  const html = renderToStaticMarkup(
    createElement(Sources, {
      files: [
        {
          id: 'f',
          name: 'prices.csv',
          relativePath: 'files/f/prices.csv',
          bytes: 2048,
          sha256: 'x',
          addedAt: '',
          kind: 'csv',
        },
      ],
    }),
  );
  expect(html).toContain('<summary>Sources · 1 file</summary>');
  expect(html).toContain('prices.csv');
  expect(html).toContain('2.0 KB');
  expect(formatBytes(12)).toBe('12 B');
  expect(formatBytes(3 * 1048576)).toBe('3.0 MB');
});
