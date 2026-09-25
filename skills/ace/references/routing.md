# Mission Routing

Use a small closed set of routes. Routing decides which workflow owns the request; it does not decide permissions, product choices, or whether evidence proves completion.

## Routes

| Route | Meaning |
| --- | --- |
| `normal` | Complete the work through the host's ordinary workflow. |
| `ace-single` | Own one bounded outcome with a stable finish line. |
| `ace-portfolio` | Own a frozen set of independently reviewable child outcomes under one parent finish line. |
| `bound-first` | Mission ownership is requested, but the scope or finish line must be made observable before execution. |

## Atomic Signals

Judge each signal independently as `yes`, `no`, or `unknown`. Inspect available context before leaving a signal unknown.

| Signal | Question |
| --- | --- |
| `explicit_ace` | Did the user explicitly request Ace or a bounded mission? |
| `active_mission` | Does an unfinished mission already own this work? |
| `observable_finish` | Can success be stated as an outcome with authoritative verification? |
| `stable_scope` | Is the included work identifiable without following a changing queue or open-ended aspiration? |
| `recovery_needed` | Must responsibility survive an interruption, later session, external result, or context recovery? |
| `dependent_milestones` | Are there substantial stages whose proof must carry into later stages? |
| `independent_children` | Are several separately reviewable outcomes included under one requested parent result? |

Do not replace these judgments with a single vague question such as "Is this complex?" Task length, file count, a long command, and routine tests are not sufficient signals.

## Deterministic Routing

Apply the first matching rule:

1. `active_mission = yes` -> continue that mission. Classify the new input against its contract before changing scope.
2. `explicit_ace = yes` and either `observable_finish != yes` or `stable_scope != yes` -> `bound-first`.
3. `explicit_ace = yes` and `independent_children = yes` -> `ace-portfolio`.
4. `explicit_ace = yes` -> `ace-single`.
5. `observable_finish = yes`, `stable_scope = yes`, and `independent_children = yes`, with recovery or dependent milestones -> `ace-portfolio`.
6. `observable_finish = yes` and `stable_scope = yes`, with recovery or dependent milestones -> `ace-single`.
7. Otherwise -> `normal`. Reconsider if later evidence establishes an Ace signal.

Unknown signals never become invented confidence. Use inspection or the conservative route described above. Ask only when the unresolved signal materially changes the deliverable, proof, authority, or a costly direction.

## New Input During A Mission

Classify each new user message into exactly one relationship:

| Relationship | Treatment |
| --- | --- |
| `criterion-feedback` | Clarifies implementation inside the existing outcome and finish line. Apply it and invalidate affected proof. |
| `mission-revision` | Adds, removes, or changes an outcome, child item, finish line, or consequential constraint. Record the user's decision and revise before acting. |
| `separate-work` | Is useful work outside the frozen scope. Record or route it separately without changing the mission. |
| `status-only` | Requests information and does not change the contract. Answer without changing mission state. |

If a message contains more than one relationship, split it by requested outcome. A status question can be answered while an independent revision waits for recording.

## Hard Boundaries

Routing never grants authorization. Deterministic project and host rules govern external writes, destructive actions, privacy, cost, credentials, commits, pushes, publication, and deployment. User-owned product, ethical, aesthetic, and priority judgments stay with the user regardless of route.
