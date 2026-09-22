# Ace Runtime Architecture Evidence

This report evaluates the runtime-architecture slice whose Ace instruction fingerprint is SHA-256 `5799b45b16d7144f66ba5aeca1fd7901f01ea7ac0bf201a9830cd00605a69225`. It preserves unsuccessful attempts and does not support a general token-savings or quality-improvement claim.

## Deterministic Validation

`bun run check` passes strict TypeScript checks, skill and routing validation, generated catalog verification, and 101 tests. Focused coverage exercises host-independent state parsing and migration, source-bound completion, affected-only reverse dependency invalidation, history-independent current projection, OpenCode persistence and controls, compaction recovery, and installer bundling.

The Claude Code smoke check accepts the plugin and marketplace manifests. The OpenCode smoke reaches the configured host but fails before an Ace status event with an upstream `Unexpected server error`. This is an infrastructure failure, not adapter completion evidence.

## Instruction Context

The handoff baseline `SKILL.md` is 18,516 bytes. The evaluated skill is 11,597 bytes, a reduction of 6,919 bytes, or about 37%. Route payloads are:

| Route context | Bytes |
| --- | ---: |
| Unambiguous single mission | 11,597 |
| Ambiguous routing | 15,387 |
| Portfolio without routing ambiguity | 14,206 |
| Ambiguous portfolio | 17,996 |

Normal work receives discovery metadata only. Detailed evidence and mission-state references are conditional. These are instruction byte counts, not token or billing estimates.

## Matched Codex Cohort

Codex CLI 0.154.0 ran two repetitions of the CSV and cache fixtures. Arms used the same requested `gpt-5.6-sol` model, medium reasoning, workspace-write permissions, automatic approval review, ephemeral sessions, disabled delegation and network, and a three-minute process limit. Arm order reversed in repetition two. Native events did not expose a resolved model identifier or cost.

Manual review inspected the actual artifacts, preserved tests, mission records, and action transcripts. All eight artifacts pass independent assertions and all eight mission records accurately state proof and limitations. A verified success additionally requires a completed host event.

The sanitized [reviewed records](2026-09-22-runtime-architecture.json) retain per-attempt usage and explicit handoff decisions without private launcher configuration or transcripts.

| Fixture | Arm | Attempts | Artifact pass | Handoff review pass | Host completion | Verified success | Wall time | Input tokens | Cached input | Output tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cache | Ordinary | 2 | 2 | 2 | 2 | 2 | 315.263 s | 440,751 | 409,088 | 6,508 |
| Cache | Optimized portable Ace | 2 | 2 | 2 | 2 | 2 | 289.925 s | 475,784 | 414,336 | 6,121 |
| CSV | Ordinary | 2 | 2 | 2 | 2 | 2 | 291.022 s | 376,576 | 316,416 | 5,302 |
| CSV | Optimized portable Ace | 2 | 2 | 2 | 0 | 0 | 356.023 s | Unknown | Unknown | Unknown |

The cache Ace arm uses 34,646 more reported input-plus-output tokens than ordinary execution across two verified successes, about 7.7%, while finishing 25.338 seconds sooner in aggregate. The sample is too small for either difference to establish a general effect.

Both Ace CSV attempts reach a passing artifact and an accurate qualified mission record, then hit the runner timeout without a terminal event. Their usage is unknown because Codex reports complete usage only at the terminal event. Unknown treatment usage prevents a token-per-success comparison for CSV and for the combined cohort.

## Preserved Failures And Limits

- An earlier matched cohort with the broader reference gates produced passing artifacts but timed out all four Ace attempts. Transcript inspection showed that every small Ace task loaded both detailed evidence and mission-state references. The evaluated gate removes those avoidable loads; no evaluated Ace attempt reads either reference.
- Eight launcher attempts failed before model startup because Codex 0.154 rejects simultaneous explicit sandbox and automatic-approval flags. Their artifacts failed and usage is unknown. The corrected cohort uses a new output directory, leaving those records intact.
- An offline runner-check cohort deliberately invokes no model. All eight artifacts fail with zero reported tokens. It validates failure recording, not Ace behavior.
- The current matched runner compares ordinary and optimized portable execution. It does not recreate the pre-change portable snapshot in the same cohort.
- The OpenCode provider error prevents an adapter-backed matched arm. Deterministic adapter coverage passes, but it is not a substitute for live adapter evaluation.
- Raw transcripts, private harness configuration, and workspaces remain under ignored `.local/ace-efficiency/` paths and are not included in this report.

## Promotion Decision

The evaluated extraction slice and instruction-context gates pass. General efficiency promotion does not pass: optimized portable Ace has two verified successes out of four, treatment usage is incomplete for CSV, the live adapter arm is unavailable, and no same-cohort pre-change portable arm exists. Documentation must not claim general token savings or improved end-to-end efficiency from this evidence.
