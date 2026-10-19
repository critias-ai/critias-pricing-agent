// An example required-report lint; the mechanism is general, the plugin decides which reports it requires.
export const requiredReport = {
  id: 'outlier-check-reported',
  applies: ['reply' as const],
  when: 'absent' as const,
  if: String.raw`\b(?:gross margin|unit price)\b`,
  pattern: String.raw`\b10\s*×|ten times`,
  flags: 'i',
  hint: 'Your reply does not report the outlier check.',
};
