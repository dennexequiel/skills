# Mission State

Persist current truth separately from the audit trail. Use the host's mission tools when available; otherwise maintain the same distinctions in a concise brief. Tool names and storage formats belong to the runtime adapter.

## Criteria

Give each criterion one stable ID, one observable outcome, a verification method, and a current state. Preserve the ID while recording an approved revision; retain retired criteria in history so evidence references remain interpretable.

| State | Meaning | Completion treatment |
| --- | --- | --- |
| `pending` | Implementation or proof remains. | Unmet. |
| `active` | The current cycle targets this criterion. | Unmet. |
| `satisfied` | Fresh passing evidence proves the outcome. | Meets strict completion. |
| `verification-stale` | A relevant source or contract change invalidates proof. | Reverify. |
| `blocked` | A material obstacle prevents progress. | Resolve or obtain an explicit exception. |
| `external` | Another repository, environment, or owner must deliver work. | Verify delivery or obtain an explicit exception. |
| `baseline-qualified` | Evidence matches a specific user-accepted failure baseline. | Qualified closure only. |
| `accepted-exception` | The user accepts a named unmet outcome. | Qualified closure only. |

Record current evidence references and the reason for a blocker or qualification. An evidence timestamp without a source identity cannot establish freshness.

## Milestones And Delivery

Plan dependent foundations before independent features. Each milestone records:

- An outcome and the criterion IDs that prove it.
- File or package scope, including shared and generated-file ownership.
- Verification and dependency order.
- A proposed review unit or branch name when work uses Git.
- The actual authorization for commits, pushes, pull requests, or deployment.

For example, a shared permission registry may be the first milestone, with separate settings and invitation changes depending on it. Each downstream milestone owns its feature files; the plan names who integrates changes to the registry. Recording this order does not authorize Git operations.

Before declaring a milestone complete, verify its criteria and inspect its diff. Before closing the mission, inspect cross-milestone integration and the complete changed-file set. User-approved qualifications remain visible even when the corresponding milestone is closed.

## Execution Windows

| Measure | Event counted |
| --- | --- |
| Window elapsed time | Wall-clock time while the mission is active, frozen at a pause or terminal transition. |
| Automatic continuation | The host schedules another agent execution turn for this mission. |
| Iteration | A reported implementation, diagnostic, or verification cycle. |
| Consecutive stall | An iteration produces no changed artifact, new authoritative evidence, satisfied criterion, disproven hypothesis, or removed blocker. |
| User resumption | An explicit user decision opens another execution window. |
| Lifetime total | The sum across retained windows, excluding paused time. |

At the agreed deadline, stop implementation. Save what is proven and the next action. If a command crosses the deadline before control returns, report the overrun and stop at the next available boundary; do not claim that a non-preemptive host stopped it on time.

An extension has a user decision reference and a finite allowance. Preserve the exhausted window when opening another. Record start/end timestamps and measured duration for each window, plus explicit lifetime totals. Label incomplete historical timing as unknown; do not reconstruct a precise duration from unrelated evidence timestamps. If the runtime also supplies a lifetime limit, opening a new window cannot reset or bypass it.

## Revisions And Closure

Contract revisions record the actual user decision, reason, affected criterion IDs, and timestamp. Keep unchanged constraints and authorization in force. Invalidate affected evidence and exception records before resuming verification.

Use strict completion for fresh passing criteria. Use qualified closure only when every remaining criterion has a specific accepted qualification. A paused or limited mission can close directly if its existing evidence is fresh; closure grants no execution time. If a source change requires new verification, obtain the missing execution authorization before running it.

Current status answers what remains, what proves the current claims, and what happens next. Detailed criteria show one row per criterion. Audit history explains revisions, evidence replacement, budget extensions, and accepted qualifications. On recovery, load the full current contract and constraints before taking another action; a shortened status summary is insufficient authority. Include current proof, qualifications, and budget totals. Historical windows, retired criteria, and superseded evidence stay in the audit record and are retrieved when a decision depends on them. Routine recovery grows with current mission complexity, not accumulated history.
