const budgetStop = /budget exhausted|deadline exhausted|finalization reserve|no progress|group limit|planning consumed/;
// The user-facing reason a run ended without a checked answer. The full reason stays in run.json.
export function failureMessage(reason: string): string {
  // The provider's own text (wrong key, unknown model, usage limit) tells the user what to fix.
  if (reason.startsWith('Provider error: ')) return `Stopped: the model provider returned an error. ${reason}`;
  if (reason === 'cancelled') return 'Stopped before a checked answer was ready. Retained analysis files are drafts.';
  if (budgetStop.test(reason))
    return 'Stopped: this request ran out of its time or call budget. Retained analysis files are drafts.';
  if (/changed/.test(reason))
    return 'Stopped: a source file or checked evidence changed during the run. Ask again to recompute.';
  return 'Could not produce a checked answer. Retained analysis files are drafts.';
}
