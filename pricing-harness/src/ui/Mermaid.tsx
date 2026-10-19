import {useEffect, useId, useState} from 'react';
import type {SyntaxHighlighterProps} from '@assistant-ui/react-markdown';
import {currentTheme} from './theme.js';
// Lazy-loaded; strict security; the source stays visible if rendering fails.
export function MermaidDiagram({code, components: {Pre, Code}}: SyntaxHighlighterProps) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSvg(null);
    void import('mermaid')
      .then(async ({default: mermaid}) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          // Otherwise a parse error leaves mermaid's error graphic appended to <body>.
          suppressErrorRendering: true,
          theme: currentTheme() === 'dark' ? 'dark' : 'neutral',
        });
        const result = await mermaid.render(id, code);
        if (alive) setSvg(result.svg);
      })
      .catch(() => {
        if (alive) setSvg(null);
      });
    return () => {
      alive = false;
    };
  }, [code, id]);
  return svg ? (
    <div className="mermaid-diagram" role="img" aria-label="Diagram" dangerouslySetInnerHTML={{__html: svg}} />
  ) : (
    <Pre>
      <Code>{code}</Code>
    </Pre>
  );
}
