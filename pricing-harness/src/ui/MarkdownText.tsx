import type {ComponentPropsWithoutRef} from 'react';
import {MarkdownTextPrimitive} from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import {MermaidDiagram} from './Mermaid.js';
import {isNumericCell, textOf} from './numbers.js';
const NoHeader = () => null;
function Cell({node: _node, className, ...props}: ComponentPropsWithoutRef<'td'> & {node?: unknown}) {
  const numeric = isNumericCell(textOf(props.children));
  return <td {...props} className={[className, numeric ? 'num' : ''].filter(Boolean).join(' ') || undefined} />;
}
// Raw HTML in replies is not enabled, so model text cannot inject markup.
export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      className="markdown"
      smooth={false}
      remarkPlugins={[remarkGfm]}
      components={{td: Cell}}
      componentsByLanguage={{mermaid: {SyntaxHighlighter: MermaidDiagram, CodeHeader: NoHeader}}}
    />
  );
}
