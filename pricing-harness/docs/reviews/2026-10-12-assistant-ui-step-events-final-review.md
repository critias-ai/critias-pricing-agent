# Final whole-branch review: assistant UI step events

**Reviewed range:** b7ec0b91b6564c6c23d885661d35939dffb99600..6a119da12eb0f6509e918bf6507340a0391498c9 on feat/assistant-ui-steps. This report covers Plan1 Tasks 1–8. The prior Tasks 1–7 report remains in Git history at 4cfa307; this update replaces its Task8-pending conclusion with the completed review. The documentation-only update preserves the reviewed implementation and evidence.

## Strengths

- Tasks 1–7 implement the planned run-scoped Step contract, worker mapping, tracker lifecycle, redacted and capped publication/persistence, legacy tool/ticker removal, and assurance wording. The same safe step object feeds the snapshot event and steps.jsonl.
- The implementation keeps raw model deltas out of the step stream. Fixed tool summaries and bounded error details are covered by unit tests; orchestrator integration checks redaction, caps, event ordering, persistence equality, and skipped/live verification stages.
- EventView filters steps to the active run, upserts by stepId, and clears them on run change or settlement. The condition-based startup wait preserves the original exact runner-call assertion.
- Task8's approved paid run captured 110 streamed events that exactly match the 110 persisted records. It recorded 19 complete model lifecycles, 24 completed tool lifecycles, two completed stages, and a skipped Verify stage. Sanitization retained all transitions and timestamps without reviewed path, business-name, financial-figure, or detail leakage.
- The independent delivery review checked 40/40 claim comparisons and 20/20 delivered table cells, including the held Q3 margin. It limits the claim to those checks; it does not assert reliability or full financial correctness.
- Task8's separate review approved the implementation and evidence with no findings. Reported current gates are 302/302 tests across 63 files, typecheck and format checks pass, and build succeeds with the existing Plotly chunk warning. The earlier six browser passes remain Task7 evidence; Task8 changed no UI, so not rerunning them was reasonable.

## Findings

### Critical

None found.

### Important

None found.

### Minor — Plan2 handoff

The recorded run follows the normal self-checked path: all 24 tools ended done, and Verify was skipped. It therefore does not exercise the spec's retry or background active-verification fixture paths. Add deterministic retry and live-Verify cases in Plan2 while retaining this authentic fixture. Keep real step transitions and durations during replay; the current replayEvents proposal deduplicates each step to its final state and assigns model lifecycles 1 ms. This limits Task8 evidence to event capture on the normal path and does not block review of the Plan1 backend.

Two prior non-blocking Minors remain:

1. The browser scroll assertion can pass before delayed settlement (tests/browser/chat-exploration.spec.ts:192–193). Plan2 should await settlement before checking post-settlement scroll stability.
2. The spec describes status as running/cancelling, while Task5 retains retrying/compacting (src/contracts.ts:101–105, src/agent/events.ts:187–193). Clarify the informational status contract in Plan2.

## Recommendations

- In Plan2, seed the separate steps store from snapshot.activeSteps and consume every step transition; the message reducer only advancing sequence is intentional for this architecture.
- Add deterministic retry and background verification cases, and preserve captured lifecycle transitions and timing. Keep synthetic replay distinct from recorded-run evidence.
- Do not make another paid call for this handoff.

## Declined to judge

- Plan2 frontend components, store behavior, and browser acceptance beyond handoff compatibility.
- Full narrative accuracy and browser chart rendering for the paid run; the independent review covered its stated claims, delivered cells, and chart metadata only.
- General model reliability or financial correctness; one run cannot establish either.
- Past-run step retrieval and other deferred design items outside Plan1 Tasks 1–8.

## Assessment

**Ready for user review:** Yes. The Plan1 backend and Task8 event-capture evidence are ready for review, with no Critical or Important findings and no backend blocker. The Task8 task review also approved with no findings. Carry the three Plan2 follow-ups above forward; the live run covers only the normal self-checked path. This review did not rerun tests or make paid calls.
