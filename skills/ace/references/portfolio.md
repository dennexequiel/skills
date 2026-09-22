# Portfolio Missions

Use a portfolio mission for a requested parent outcome that contains several independently reviewable child outcomes. Examples include a fixed release train, a named migration program, or an exact set of tracker items. Do not use it as a standing mandate to drain a changing queue.

## Freeze The Scope

At mission start, record:

- the parent outcome,
- the exact child identifiers and titles,
- the source revision or tracker snapshot used to select them,
- shared constraints and authorization,
- excluded queues, repositories, environments, and follow-ups.

The snapshot is the mission boundary. A live view such as "everything currently in progress" is evidence used to build the snapshot, not a scope that updates itself.

## Child Contract

Each child records:

```text
ID and outcome:
Acceptance criteria:
File, package, repository, or service scope:
Dependencies and shared-file ownership:
Verification:
Proposed review unit:
Delivery state:
Blocker or qualification:
```

Use delivery states that reflect evidence rather than activity: `pending`, `active`, `review`, `proven`, `external`, `blocked`, or `qualified`. A merged change is not proven deployed behavior unless deployment is part of that child's criterion and has current evidence.

## Shared Foundations

Name shared foundations before parallel work begins. Assign one owner for shared files, generated artifacts, schemas, and integration branches. Child work may proceed independently only where merge order and proof remain valid. Recheck integration after the last shared change.

## Scope Changes

Classify later requests using [routing.md](routing.md). A new child requires an explicit `mission-revision`; adding it silently makes completion depend on a moving target. `criterion-feedback` may change a child's implementation without adding an outcome, but affected evidence becomes stale.

Removing a child also requires a revision. Preserve the retired child and the reason in history so the parent handoff remains interpretable.

## Completion

Complete a child only from fresh evidence for its own criteria. Complete the parent only when:

1. every frozen child is `proven` or has a current user-accepted qualification,
2. shared integration is verified after the final relevant child change,
3. the final child list matches the current approved snapshot,
4. unrelated findings and separately routed work are reported without being presented as delivered.

Report the portfolio compactly: child ID, outcome, state, current proof or blocker, and next action. Do not replay the full history unless requested.
