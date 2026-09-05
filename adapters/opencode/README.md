# OpenCode Automation Adapter

The OpenCode automation adapter adds capabilities that the portable Ace skill does not assume:

- `/ace` command routing,
- project-and-session-scoped durable state,
- criterion state, source-linked evidence, and audited user decisions,
- explicit start, status, progress, pause, resume, completion, revision, qualification, cancel, and clear tools,
- bounded automatic continuation after idle events,
- state restoration during context compaction,
- duplicate idle-event protection.

State is stored under `${XDG_STATE_HOME:-~/.local/state}/opencode/ace/`. Automatic continuation requires the OpenCode TUI or server process to remain active; a one-shot `opencode run` process can exit before a queued continuation executes.

## Install

This installation is an alternative to installing the core skill through the `skills` CLI. It requires Bun and includes the Ace skill, command, and plugin.

```sh
git clone https://github.com/dennexequiel/skills.git
cd skills
bun run install:opencode
```

The installer verifies the pinned `@opencode-ai/plugin` version and installs it in the OpenCode configuration package when absent. It refuses to overwrite existing Ace, command, or plugin files and refuses a conflicting plugin version. Use `--force` only after reviewing the reported files. Restart OpenCode after installation.

Run the host-level smoke test after installation:

```sh
bun run smoke:opencode
```

The smoke check stages this checkout's command and skill in temporary directories and invokes this checkout's adapter. A source hash in the native tool result prevents an older installed copy from satisfying the check. Temporary Ace state isolates the test from existing missions. The check uses the host's configured provider and has a two-minute timeout; it does not replace installed files.

## Commands

```text
/ace <objective>
/ace --max-turns 30 --max-minutes 90 --max-stalls 3 <objective>
/ace status
/ace pause <reason>
/ace resume <next action>
/ace complete
/ace cancel <reason>
/ace clear
```

## Execution Limits

The agent applies the portable skill's suitability check before starting a mission. Ordinary work defaults to the normal workflow without creating Ace state or scheduling continuation. Explicit Ace and bounded mission requests are honored in every mode without reconfirmation. An ordinary edit explicitly run with Ace gets one brief overhead notice; a short learning, exploration, or decision mission does not need a warning just for being short. The adapter does not estimate task complexity or change limits based on task size.

The automation adapter defaults to 20 automatic continuations, 60 minutes, and 3 consecutive stalls. Runtime limits bound execution; they do not weaken the mission's acceptance criteria.

The time allowance applies to an active execution window. State operations and host tool boundaries check the deadline at 100% of the allowance. Status reports a warning at 75%. A boundary check cannot interrupt a command already running or stop host reasoning between operations. On the next boundary, the adapter records `limit-reached` and rejects further implementation.

Status and handoff controls remain available after a limit. A resume requires the actual user's decision and opens a finite window while preserving lifetime accounting. Paused time does not consume execution time. Closing an already verified mission with accepted qualifications does not require a resume.

Paused and blocked missions also reject ordinary host tools. Mission controls remain available to inspect state, record decisions, and resume authorized work. A pause cannot bypass an exhausted window.

| Counter | Meaning |
| --- | --- |
| Automatic continuations | Host-scheduled continuation turns, separate from user messages and progress calls. |
| Iterations | Reported implementation, diagnostic, or verification cycles. |
| Stalls | Consecutive iterations without material progress. Equivalent evidence on unchanged source is insufficient to reset this count. |
| Resumptions | User-authorized execution windows after the initial window. |

## Criteria And Evidence

`ace_start` assigns `C1`, `C2`, and subsequent IDs to string acceptance criteria, or accepts explicit criterion records. A criterion represents one independently verifiable result. Optional milestones link criteria to outcomes, file scope, verification, dependencies, and proposed review units. The delivery plan records authorization; it grants none.

Completed and cancelled missions retain their recorded source, criteria, proof, and execution windows. Status describes that terminal snapshot; later checkout edits do not reopen it or block ordinary work. A new mission captures a fresh source identity. Cancellation cannot replace an existing completed or cancelled result.

Use `ace_progress` to record structured evidence against criterion IDs. Each record identifies its verification method, result, concise summary, and checked source. The adapter adds an evidence ID and timestamp. Repeated results for the same criterion and method replace current evidence while preserving audit history. Current criteria and evidence remain separate from historical notes.

For example, after capturing `source.value` from `ace_status` with `detail=current` and running the check against that source:

```json
{
  "summary": "CSV integration is verified",
  "sourceIdentity": "<checked source.value>",
  "evidence": [
    {
      "criterionIDs": ["C1"],
      "method": "bun test",
      "result": "passed",
      "summary": "CSV integration assertions pass for the required field cases"
    }
  ],
  "madeProgress": true,
  "nextAction": "Verify the next unmet criterion"
}
```

`madeProgress` alone cannot establish material progress. Repeating the same evidence against unchanged source does not reset stalls. `ace_complete` takes a final verification summary after structured proof is recorded; free-form `criterionEvidence` strings do not establish completion.

Capture source identity before a check and confirm it afterward. The checked identity must match the source associated with the evidence. Recording a passing result against a newer source cannot make an earlier check fresh. Git freshness covers the worktree, including untracked source files. The policy is conservative: a worktree change can invalidate proof even when a particular check does not exercise that file. External environments and ignored files need explicit verification.

Outside Git, start with `sourceIdentity: { value, freshnessPolicy }` describing a checked artifact revision and how the caller detects changes. Use `ace_status` with the checked revision string in `sourceIdentity` whenever that artifact changes. The adapter persists this identity for later controls; it cannot detect manual artifact changes itself.

The adapter validates evidence structure and source identity. It cannot establish that the agent executed the named check, interpreted its output correctly, or recorded a real user decision. Those remain responsibilities of the agent and reviewer.

## Revisions And Completion

| Operation | Requirement |
| --- | --- |
| `ace_revise` | Record the actual user decision, reason, and approver for a contract change. Invalidate affected proof and exceptions. |
| `ace_accept_exception` | Record the criterion, exact limitation, user decision, approver, and decision timestamp. |
| `ace_complete` | Every criterion has fresh passing proof and all milestones are complete. |
| `ace_close_with_qualifications` | Each criterion is proven or has a current, explicit user-accepted qualification. Preserve accepted limitations in the final state. |

A known baseline is not user approval. An external dependency is not delivered merely because the mission closes. A source or criterion change invalidates the associated qualification until the user reconfirms it. Qualified closure can operate directly from a paused or limited mission when no additional implementation is needed.

An evidence result of `baseline-qualified` leaves its criterion unmet until `ace_accept_exception` records approval. The adapter represents accepted baselines as `accepted-exception` criteria with the exact baseline in the limitation. Every affected verification method requires fresh evidence after a contract revision, including when source files are unchanged. Retired criterion IDs remain reserved for their historical meaning.

Resume, revision, acceptance, and qualified-close calls carry `decisionReference`, `approver`, and `decidedAt`. Capture those from the actual user decision; the adapter's recording timestamp is separate. A decision reference can identify the user message or quote the specific approval. An existing authorization needs recording, not a repeated permission request.

## Status And Recovery

`ace_status` defaults to a summary under 4 KiB, including the objective, criterion counts, budget, blockers, and next action. Explicit `detail` values expose `current`, `criteria`, `full`, or `audit` output. State-changing tools also return compact summaries.

`current` contains the complete current contract, constraints, criteria, proof, qualifications, milestones, source identity, execution window, and lifetime totals. Compaction and automatic continuation use this same view. Its size follows current mission complexity; it has no fixed cap that could truncate authorization or unresolved obligations. Superseded evidence, retired criteria, historical windows, and audit entries remain available through explicit `full` or `audit` reads.

The state schema has its own version. Version-1 missions retain their contract and historical notes during migration. Unstructured notes cannot become fresh criterion proof or accepted exceptions automatically. Verify migrated criteria before completion, and consult the full state for migration qualifications.
