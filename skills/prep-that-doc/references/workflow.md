# Review And Fix Workflow

Use this reference for classification disputes, missing facts, risk-bearing edits, or detailed reports. The core workflow lives in [SKILL.md](../SKILL.md).

## Choose The Amount Of Work

| Situation | Review scope | Verification after an edit |
| --- | --- | --- |
| Short README paragraph or PR description | Named text and enough surrounding context to understand it | One scan of the changed file and a diff review |
| Several related sections | Their dependencies, repeated claims, and shared terminology | Scan changed files and read the affected sections together |
| Operational or risk-bearing document | The full procedure, conditions, decisions, and recovery path | Scan and check exact preservation across the full procedure |

The scanner can read a whole short file cheaply; an incremental agent workflow means avoiding unrelated files, repeated context loads, and unproductive editing cycles. It does not mean ignoring a heading's parent or a step's prerequisites.

A broad request still needs a useful scope. Infer the files from the task, current changes, or explicit paths. Ask for scope only if those sources leave materially different jobs and choosing one would waste work.

## Classification And Severity

A detector match is evidence that a pattern occurs, not evidence that the document is wrong. Named terminology, historical records, quoted examples, and intentional formats often explain a match.

| Severity | Evidence required from the document |
| --- | --- |
| HIGH | A confirmed issue changes meaning or makes an operational instruction unsafe or unusable. |
| MED | A confirmed structure or clarity issue impedes the reader's task. |
| LOW | Optional style polish with no demonstrated effect on meaning or execution. |

Confidence answers a different question: how directly the evidence supports the detector's observation. `certain` can describe a missing local file; `likely` can describe an inferred pattern; `contextual` requires reader judgment. Confidence never grants editing authority.

Keep `needs-author` distinct from severity. A vague duration in a rollback trigger can require the author and block execution. A duration absent from background prose may not need a finding at all.

## Missing Facts

Report the location, exact gap, and the decision it prevents. Do not write a placeholder into the document, including when the author defers or cannot be contacted.

For example: "Step 4 says 'roll back if latency degrades.' Which metric, threshold, and observation window trigger rollback? The document does not supply them."

Ask only questions needed for dependent edits, batch related questions, and continue independent work. Do not infer that a configuration value or contact is deferrable merely because it appears outside the procedure; determine whether a reader relies on it.

An author may explicitly request placeholders or a proposed procedure. Follow that instruction within its scope, label proposals clearly, and do not represent proposed facts as verified ones.

## Lossless Restructuring

Before changing a container, map each claim to the proposed form. Preserve the scope of conditions: a caveat about one option must not become a rule about all options.

| Source content | Faithful destination |
| --- | --- |
| A comparison value | The corresponding option's cell |
| A condition applying to one option | A condition cell or a note tied explicitly to that option |
| A caveat applying to the entire comparison | Text immediately before or after the table |
| A dependent operational step | The same position and identifier in the procedure |

Reject a reshape that requires dropping a fact, compressing distinct conditions into one claim, or changing execution order. Preserve deliberate redundancy in operational documents.

## Stop Conditions

Review does not need iterative passes over an unchanged document. Fix needs a verification pass on its actual edits. Additional passes require a concrete new defect revealed by verification.

Stop when no justified change remains, the next change depends on an author answer, or repeated attempts produce no meaningful improvement. Report unresolved issues with their evidence. Four edit-and-verify passes are an upper bound, not a target or permission to rewrite a stubborn section from scratch.

## Reporting

Honor a requested report format. Otherwise keep the result proportional to the work. A clean file can get one sentence. Group multiple findings by file and present operational and structural issues before style.

Example review:

```text
Blocked. docs/cutover.md has one unresolved author question.
Step 4: "if latency degrades" supplies no rollback threshold.
Question: Which metric, threshold, and observation window apply?
The file is unchanged. The scanner completes; this gap comes from reading the procedure.
```

Example fix:

```text
README.md: heading hierarchy and link labels are corrected.
Verification: the changed file is scanned and the diff preserves commands and URLs.
docs/runbook.md: the rollback question remains unresolved; its procedure is unchanged.
```

Use `rework`, `blocked`, `minor`, or `clean` only after classification. HIGH confirmed issues take precedence over unresolved author questions, then MED/LOW confirmed issues. A verdict summarizes evidence; it is not a score to optimize.

Never imply that scanner output validates commands, confirms claims, proves a recovery procedure works, or covers skipped content. Give a next action when it helps; there is no required closing command.
