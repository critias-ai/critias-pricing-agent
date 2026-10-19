const REPLY = /(?<![\w./]|\d-)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\w/]|-\d|\.\d)/g;
const PERCENT = /^\s*(?:%|pp\b|percent|percentage points?\b|points?\b)/i;
// True when the reply asks a question but shows no figure of 3+ digits: a result was computed and held back.
export const withheldResult = (reply: string) =>
  /\?/.test(reply) && !(reply.match(REPLY) ?? []).some(f => f.replace(/\D/g, '').replace(/^0+/, '').length >= 3);
// Returns the reply's figures with 3+ significant digits that no executed output supports. A figure is supported
// when an output prints it (at the reply's precision), prints it as a fraction and the reply shows it as a
// percentage, or when it is the difference of two supported figures within their rounding.
export function unverifiedFigures(reply: string, outputs: string[]): string[] {
  const printed = new Set<number>();
  for (const text of outputs) {
    for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) printed.add(Number(m[0]));
    for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g)) printed.add(Number(m[0].replaceAll(',', '')));
  }
  const figures = new Map<string, {value: number; places: number; percent: boolean}>();
  for (const m of reply.matchAll(REPLY)) {
    const plain = m[0].replaceAll(',', '');
    // shortcut: a bare 4-digit number in 1900-2100 is read as a year; a revenue of exactly that size slips through.
    if (plain.replace(/\D/g, '').replace(/^0+/, '').length < 3 || /^(19|20)\d\d$/.test(plain)) continue;
    const percent = PERCENT.test(reply.slice(m.index + m[0].length)) || !!figures.get(m[0])?.percent;
    figures.set(m[0], {value: Number(plain), places: plain.split('.')[1]?.length ?? 0, percent});
  }
  const shows = (n: number, f: {value: number; places: number}) => n.toFixed(f.places) === f.value.toFixed(f.places);
  const verified = [...figures.values()].filter(f =>
    [...printed].some(n => shows(n, f) || (f.percent && shows(n * 100, f))),
  );
  const half = (places: number) => 0.5 * 10 ** -places;
  return [...figures].flatMap(([text, f]) =>
    verified.includes(f) ||
    verified.some(a =>
      verified.some(
        b => Math.abs(Math.abs(a.value - b.value) - f.value) <= half(a.places) + half(b.places) + half(f.places) + 1e-9,
      ),
    )
      ? []
      : [text],
  );
}
