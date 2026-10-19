import {isValidElement, type ReactNode} from 'react';
// A cell that is only a number, optionally with sign, brackets, currency symbol, percent or short unit.
export const isNumericCell = (text: string) =>
  /\d/.test(text) && /^[−\-+(]?[£$€¥]?\s?[\d.,]+\s?(%|[A-Za-z]{1,3})?\)?$/.test(text.trim());
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{children?: ReactNode}>(node)) return textOf(node.props.children);
  return '';
}
