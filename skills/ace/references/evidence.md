# Completion Evidence

Completion evidence must be fresh, relevant, and authoritative enough for the claim.

## Evidence Ladder

Prefer the highest practical level:

1. Direct observation of the required behavior in its real execution path.
2. An automated integration or end-to-end check that exercises that path.
3. A focused automated test for the changed behavior.
4. Static validation such as type checking, schema validation, or linting.
5. Manual inspection of the final artifact or diff.
6. Reasoning, a summary, or another agent's claim.

Lower levels can support higher levels but should not replace them when the criterion requires runtime behavior.

## Criterion Mapping

Write criteria so one evidence statement can prove each one:

```text
C1: Existing saved documents open without data loss.
E1 -> C1: Migration fixture suite passes for versions 1-4, including retained-data assertions.
Method: Migration fixture suite. Result: passed.
Verified source: <commit and worktree fingerprint>. Recorded at: <timestamp>.
```

Weak evidence describes activity: "updated migration code" or "tests look good."

Every record needs a criterion ID, command or observation method, result, concise summary, source identity, and timestamp. One check may support several criteria only when its assertions prove each one. A failed broad check does not invalidate an unrelated passing criterion, but it cannot prove the criterion that requires that broad check to pass.

Keep the current result for each criterion and method separate from history. Repeating identical evidence updates that result; a later run supersedes it. Preserve replaced records for an explicit audit request without mixing them into routine status.

## Freshness

Evidence is stale after a relevant code, configuration, fixture, environment, or dependency change. Re-run affected checks after the final relevant change.

Record the source state checked by the actual run, not merely the state when entering a progress note. For Git work, include the commit and a worktree fingerprint covering tracked changes and untracked source files. A check started before concurrent edits may already be stale when it finishes. Capture or compare source state around the check and rerun if its inputs changed.

An adapter may conservatively invalidate proof for any worktree change when it cannot map files to individual criteria. Explain this policy; do not imply that it knows which code a test exercised. For non-Git or external work, identify the relevant artifact or environment revision and explicitly verify its freshness. A fingerprint cannot detect an unrecorded external deployment or prove that a command ran.

Changing criterion wording, its verification method, or its accepted interpretation also invalidates its evidence. Never reuse an accepted exception for a changed limitation without user confirmation.

## Broad Claims

Match proof breadth to claim breadth:

- "This function works" may need a focused unit test.
- "The login flow works" needs the complete login path.
- "The project is ready" needs the repository's prescribed full checks plus artifact inspection.
- "This is secure" is not a finishable absolute; define a threat model, scope, controls, and residual risks.

If an authoritative check cannot run, record the criterion as unmet or explicitly renegotiate it with the user. Do not silently lower the bar.

## Qualifications

Keep a pre-existing failure baseline precise: affected check, exact diagnostics or threshold, source identity, and scope. Comparing against that baseline produces evidence; accepting it as the finish line requires the user's decision.

An exception record identifies the criterion, limitation, approver, timestamp, and the user message or decision reference authorizing it. A deployment owned by another repository remains external until delivered or explicitly accepted as a follow-up. Qualified closure includes these records in the final criterion matrix. Strict completion cannot consume them as passing evidence.
