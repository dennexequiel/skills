# Prep That Doc Refinement Evidence

Nineteen follow-up trials show stronger scope control in targeted checks, with no source-preservation failures. They also expose missed spacing and notation, unsupported report claims, and excessive review scope. These results do not support a universal 10/10 rating.

The [measurement record](2026-09-30-refinement.json) retains exact fixture inputs, normalized prompts, outputs, reports, source hashes and diffs, anonymous grades, and available sanitized tool traces. Historical [Luna scores](2026-09-30-luna.md) and [Claude scores](2026-09-30-claude.md) retain their original rubric. This follow-up uses stricter behavioral criteria and does not convert its outcomes into comparable numeric scores.

## Evaluation Design

The first phase runs five fixtures once each on Luna, Opus, and Sonnet: a typo fix, runbook cleanup, spacing repair, evidence-dependent proposal, and specialist release-note review. The release note is new to this exercise; the other inputs match the earlier comparison.

The confirmation phase tests a subsequent core-only refinement on two Luna proposal reviews and two Opus typo fixes. It does not repeat the complete matrix or test Sonnet against that final snapshot.

An independent grader receives shuffled artifacts and reports without model or phase identities. Four criteria per case are frozen before execution. Overall pass requires all applicable criteria to pass. Internal tool actions are assessed separately when traces exist. Useful author questions are allowed; unsupported requirements and assertions count against a review.

| Phase | Model | Trials completed | Pass | Partial | Fail |
| --- | --- | --- | --- | --- | --- |
| Follow-up | Luna | 5/5 | 2 | 2 | 1 |
| Follow-up | Opus | 5/5 | 1 | 1 | 3 |
| Follow-up | Sonnet | 5/5 | 4 | 1 | 0 |
| Confirmation | Luna | 2/2 | 1 | 1 | 0 |
| Confirmation | Opus | 2/2 | 2 | 0 | 0 |

These are artifact-and-report outcomes, not factual or rendering certification. Twelve Claude trials have terminal success events; seven native trials have completion notifications and saved artifacts. Claude Code 2.1.277 resolves the requested aliases to `claude-opus-5[1m]` and `claude-sonnet-5[1m]`, both at `xhigh`. Native trials request `gpt-6-luna`; resolved runtime metadata, effort, timing, tokens, and tool traces are unavailable.

## Observed Behavior

All three runbook outputs retain commands, operational sequence, warnings, and the vague timing expectation. They also ask about the missing duration and replication-lag threshold. One output repairs list-container indentation without changing command meaning. All three spacing outputs preserve the fenced body byte for byte, but Luna leaves both fence boundaries unseparated while reporting them fixed.

The first Opus typo report contains 212 words and an unrelated completeness question. The confirmation reports contain 64 and 90 words with no unrelated questions. Both confirmation Luna reviews treat named approvers as optional and limit upload claims to the receipt. One still misses the undefined notation.

Remaining defects include:

- Opus's proposal review introduces unsupported capacity and attachment assertions, plus an annual billing extrapolation absent from the inputs. Its 1,410-word report is disproportionate to the supplied proposal.
- Sonnet's proposal report expands "no four-worker test" into absence of all multi-worker data.
- Luna's release report overstates "may be retried once" and infers exclusive header-based eligibility. The source itself remains unchanged.
- Some reports repeat discarded scanner candidates or unsupported parsing explanations. Source preservation alone does not make these reports reliable.

Claude traces contain nine permission denials across seven trials, plus failed uses of the unsupported local `cat -A` option. These are harness and execution limits, not document defects. In the second Opus confirmation, one denied helper leads to an overbroad claim that shell execution is unavailable, despite successful shell calls. The artifact-only grade remains intact; this separate trace finding qualifies it.

## Evaluated Contract

The final snapshot gives localized edits a direct edit, comparison, and brief-report path. Scanning must add relevant coverage. Broader review preserves incomplete operational guidance, treats audience roles and optional improvements without invented requirements, and separates completed editorial work from unresolved document decisions. Receipts establish only reported tool status.

The first follow-up core is 9,925 bytes with SHA-256 `5f07d331a3adfddea117621aa1788090a1b43c31570ee9563c9353998d95b1d7`. The confirmation core is 9,928 bytes with SHA-256 `232157a19f597e43b518e2ad1028f8652d49f6c6a40fb790df201ea305b50744`. All 19 portable files in the working skill match the confirmation snapshot at record creation.

## Coverage And Limits

- Mechanical: snapshot and artifact hashes are checked. Independent post-run scans are recorded separately from model-reported scans; zero findings do not establish quality.
- Editorial: blind review evaluates preservation, requested edits, scope, supported findings, and report accuracy. The stricter criteria expose failures that numeric averages can obscure.
- Factual: arithmetic is checked against synthetic supplied inputs. Measurements, prices, implementation behavior, and claimed test results are not independently verified.
- Rendering and delivery: not verified. No actual export, upload, remote read-back, or rendered preview is performed. The receipt case exercises unavailable remote verification only.

The sample is small and selected, with one grader and different host environments. It does not establish provider rankings or general reliability. Roast behavior and the full portable scenario set are not exercised. A credible perfect sample result requires every applicable behavioral criterion to pass on frozen, varied cases; broader confidence also needs fresh cases and repeated runs. Adding fixture-specific rules until familiar cases pass would not establish that confidence.
