import {expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MermaidDiagram} from '../../src/ui/Mermaid.js';
it('shows the raw diagram source until mermaid has rendered', () => {
  const html = renderToStaticMarkup(
    createElement(MermaidDiagram, {
      code: 'flowchart LR\n  A-->B',
      language: 'mermaid',
      components: {Pre: 'pre' as any, Code: 'code' as any},
    }),
  );
  expect(html).toBe('<pre><code>flowchart LR\n  A--&gt;B</code></pre>');
});
