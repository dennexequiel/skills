# Review And Fix Workflow

Use this reference for classification disputes, missing facts, risk-bearing edits, or detailed reports. The core workflow lives in [SKILL.md](../SKILL.md).

## Choose The Amount Of Work

| Situation | Review scope | Verification after an edit |
| --- | --- | --- |
| Localized typo or wording edit | Requested text and enough context to preserve meaning | Compare against the original; scan only if it adds a relevant check |
| Short README paragraph or PR description review | Named text, purpose, audience, destination, and enough surrounding context | Scan when useful, inspect spacing, and review any diff |
| Several related sections | Their dependencies, repeated claims, and shared terminology | Scan changed files when available and read the affected sections together |
| Operational or risk-bearing procedure | The full procedure, conditions, decisions, and recovery path | Scan when available and check exact preservation across the full procedure |
| Evidence-dependent analysis | Claims, sources, assumptions, and calculations that support the reader's decision | Separate editorial checks from any authorized factual or calculation checks |
| Requested export or upload | The artifact and destination included in the task | Inspect the delivered artifact when tools permit; report local coverage otherwise |

Use the simplest evidence that establishes preservation. A short text comparison can suffice for a spelling fix; byte dumps, repeated hashes, runtime discovery, and a full profile review usually add nothing. For broader edits, inspect relevant heading parents and procedural prerequisites. Use a known scanner invocation directly when useful; investigate its runtime or options only after an execution problem.

A broad request still needs a useful scope. Infer the files from the task, current changes, or explicit paths. Ask for scope only if those sources leave materially different jobs and choosing one would waste work.

Choose checks by complexity and consequence, not by document label alone. Do not add research, exports, uploads, summaries, or section templates to a simple editing task. Use `not applicable` when a check has no bearing on the task; use `not verified` when a relevant check is outside scope or cannot be performed. Explain material limitations briefly.

## Classification And Severity

A detector match is evidence that a pattern occurs, not evidence that the document is wrong. Named terminology, historical records, quoted examples, and intentional formats often explain a match.

| Severity | Evidence required from the document |
| --- | --- |
| HIGH | A confirmed issue changes meaning or makes an operational instruction unsafe or unusable. |
| MED | A confirmed structure or clarity issue impedes the reader's task. |
| LOW | Optional style polish with no demonstrated effect on meaning or execution. |

Confidence answers a different question: how directly the evidence supports the detector's observation. `certain` can describe a missing local file; `likely` can describe an inferred pattern; `contextual` requires reader judgment. Confidence never grants editing authority.

Keep `needs-author` distinct from severity. Vague timing in a procedure can affect both execution and recognizing a stalled operation. Preserve it and report the missing duration or unclear referent. A timing detail in unrelated background prose may not need a finding. Acknowledging an operational gap in the source does not resolve it or make it intentional; report its remaining effect on the operator.

## Missing Facts

Report the location, exact gap, and the decision it prevents. Do not write a placeholder into the document, including when the author defers or cannot be contacted.

For example: "Step 4 says 'roll back if latency degrades.' Which metric, threshold, and observation window trigger rollback? The document does not supply them."

Ask only questions needed for dependent edits, batch related questions, and continue independent work. Do not infer that a configuration value or contact is deferrable merely because it appears outside the procedure; determine whether a reader relies on it.

An author may explicitly request placeholders or a proposed procedure. Follow that instruction within its scope, label proposals clearly, and do not represent proposed facts as verified ones.

## Evidence-Dependent Documents

Apply this guidance when decisions rely on evidence, such as an incident analysis, benchmark, capacity estimate, or risk assessment. A style edit does not authorize a research project.

| Content | Editorial check | Verification boundary |
| --- | --- | --- |
| Sourced fact | The claim's source, scope, and qualifications are identifiable | A citation's presence is not verification. Check its support only within the requested scope and available access. |
| Assumption | A premise being used without established evidence is recognizable as an assumption | Preserve uncertainty; ask when its status is unclear rather than declaring it a fact. |
| Proposal | Suggested behavior or a target is distinguishable from current behavior or an observed result | Do not present a recommendation as implemented or accepted. |
| Calculated figure | Relevant inputs, units, method, assumptions, and rounding are traceable enough for the reader's task | Recompute only when in scope and inputs are available. Correct arithmetic does not verify the inputs. |

These distinctions can be expressed in ordinary prose or existing tables; no evidence section, label on every sentence, or citation for every routine instruction is required. Preserve supplied evidence and technical meaning. Report missing support, conflicting sources, ambiguous status, or unexplained precision where they affect a decision. Do not invent a source, input, method, or result to make the document complete.

If factual verification is requested, name the claims or calculations actually checked, the sources or inputs used, and unresolved limits. Keep this result separate from editorial review and rendering. For style-only work, say that factual accuracy is not verified rather than implying endorsement of the claims.

Check qualifications already present before proposing stronger evidence labels. Do not require source material to be duplicated in the main document when supplied or linked material serves the reader. Named owners, approvers, summaries, and extra sources are optional unless the task or actual decision requires them. Explain a demonstrated gap; do not infer a missing approval workflow from absent names alone.

## Lossless Restructuring

Before changing a container, map each claim to the proposed form. Preserve the scope of conditions: a caveat about one option must not become a rule about all options.

| Source content | Faithful destination |
| --- | --- |
| A comparison value | The corresponding option's cell |
| A condition applying to one option | A condition cell or a note tied explicitly to that option |
| A caveat applying to the entire comparison | Text immediately before or after the table |
| A dependent operational step | The same position and identifier in the procedure |

Reject a reshape that requires dropping a fact, compressing distinct conditions into one claim, or changing execution order. Preserve deliberate redundancy in operational documents.

## Delivery Checks

Apply these checks when export, upload, or publication is part of the authorized task. Review alone does not authorize publishing.

Open the actual exported file or retrieve the uploaded artifact with available tools. Confirm that it contains the intended revision and inspect headings, paragraphs, lists, tables, code blocks, links, and images as relevant. For paginated output, also inspect clipping and page breaks. A success response or stored receipt reports the tool's claimed outcome; it is not independent confirmation of transfer, current contents, or rendering.

Do not infer whether attachments exist, links are accessible, or publication occurred from a receipt naming one source file. Absence from the receipt is not evidence of absence at the destination. State what the receipt records and what inspection actually establishes.

Use the destination's preview or renderer when available. Checking the source or a local approximation does not verify a remote artifact. If access or tools prevent artifact inspection, name the local source or preview checked and mark destination rendering or artifact contents `not verified`. Do not install a publishing toolchain or create external side effects solely to fill a coverage gap.

## Stop Conditions

Review does not need iterative passes over an unchanged document. Fix needs a verification pass on its actual edits. Additional passes require a concrete new defect revealed by verification.

Stop when no justified change remains, the next change depends on an author answer, or repeated attempts produce no meaningful improvement. Report unresolved issues with their evidence. Four edit-and-verify passes are an upper bound, not a target or permission to rewrite a stubborn section from scratch.

## Reporting

Honor a requested report format. Otherwise keep the result proportional to the work. A localized fix or clean file normally needs one or two sentences, including material coverage limits. Avoid repeating the source, dismissed candidates, or the entire checklist. Group multiple findings by file and present operational and structural issues before style. Distinguish these checks without requiring four sections:

| Check | What to report |
| --- | --- |
| Mechanical scanning | Files, scanner mode, visible candidates, skips, or execution limits; counts describe only detector coverage |
| Editorial review | Purpose, audience, destination assumptions, confirmed issues, and preservation of meaning after edits |
| Factual verification | Specific claims, sources, or calculations checked, or `not verified` / `not applicable` with a brief reason |
| Rendering checks | Actual source preview, exported file, or uploaded artifact inspected and renderer used, or `not verified` / `not applicable` |

`Not applicable` means the check does not bear on the task, such as calculation verification for a note with no figures. `Not verified` means no supporting check was completed, such as factual accuracy during a wording edit or destination rendering without preview access. Neither status is a successful check or an automatic reason to block useful edits.

Example localized fix:

```text
pr.md: corrected the typo; comparison confirms no other change. Editorial check
only; scanning is not applicable to this edit, and facts/rendering are not verified.
```

Example review:

```text
Review complete. docs/cutover.md has an unresolved execution gate.
Step 4: "if latency degrades" supplies no rollback threshold.
Question: Which metric, threshold, and observation window apply?
Mechanical: scan completed with no visible candidates.
Editorial: the operator cannot identify the rollback gate. The file is unchanged.
Facts: not verified; system behavior is outside this review.
Rendering: not verified; only local Markdown source was inspected.
```

Example fix:

```text
README.md: heading hierarchy and link labels are corrected.
Mechanical: default scan of the changed README has no visible candidates.
Editorial: diff and context review preserve commands, URLs, and reader instructions.
Facts: not verified; commands were not executed or checked against system behavior.
Rendering: local repository preview inspected; export and upload are not applicable.
docs/runbook.md: the rollback question remains unresolved; its procedure is unchanged.
```

Verdicts are optional. Use `rework` for confirmed issues requiring substantial correction, `minor` for small confirmed issues, and `clean` only within checked scope. Use `blocked` only when an unresolved dependency prevents a requested action, and name that action. A review or independent edit can be complete while approval or operational execution remains blocked. Do not treat every author question as a blocked task or every optional addition as a defect.

Never imply that scanner output validates commands, confirms claims, proves a recovery procedure works, or covers skipped content. Give a next action when it helps; there is no required closing command.
