---
name: ace
description: Use for explicit Ace requests or requests to own a bounded deliver, learn, explore, or decide mission. Route substantial work as a single or portfolio mission when it needs recovery across interruptions, external waits, or dependent milestones. Default to the normal workflow for ordinary work that fits one focused session. Ace may first bound an open-ended request when mission ownership is requested.
argument-hint: "[deliver|learn|explore|decide] <mission>"
license: MIT
compatibility: Works in Agent Skills-compatible coding agents. Durable state, hard guards, and automatic continuation require an optional host integration.
metadata:
  display-name: Ace
  summary: Own a bounded mission through evidence-backed completion while preserving user judgment and authority.
  status: stable
  areas: workflow, autonomy
---

# Ace

Own a bounded mission through evidence-backed completion. Continue while work remains. Complete only when fresh evidence proves every agreed criterion.

Ace is not a general autonomy setting, a replacement for ordinary workflow, or permission to act outside the mission.

## Route Once

Choose exactly one route: `normal`, `ace-single`, `ace-portfolio`, or `bound-first`. Do not invent a probability or confidence score.

- An explicit Ace request uses Ace.
- An active mission keeps its existing contract until revised or stopped.
- Ordinary work that fits one focused session uses `normal` unless Ace is explicit.
- One bounded outcome uses `ace-single`.
- A frozen set of independently reviewable child outcomes with one parent finish line uses `ace-portfolio`.
- Requested mission ownership without an observable scope or finish line uses `bound-first` to produce a bounded contract before delivery.

Do not create mission state or load mission references for `normal`. For an unambiguous Ace request, select the route directly. Read [routing.md](references/routing.md) only when signals conflict, portfolio boundaries are unclear, or new user input must be classified. Routing never grants authorization.

For a small ordinary edit explicitly run with Ace, mention the likely overhead once and proceed with a proportionate brief. Infer `deliver`, `learn`, `explore`, or `decide` from intent without asking the user to choose a label.

## Use The Available Runtime Honestly

Prefer a structured Ace runtime when the host exposes one. Use its current-state view for routine recovery and retrieve full state or audit history only when needed.

The portable tool contract is `start`, `status`, `progress`, `revise`, `pause`, `resume`, strict or qualified `complete`, `cancel`, and explicit `clear`. Start records the contract, limits, source identity, and optional milestones. Status defaults to current state and offers full or audit views. Progress records one iteration and its evidence. Revision and resume require the relevant user decision. Completion enforces current proof and accepted exceptions.

Map those operations to the host's exact tool names. A native goal may own the top-level objective while Ace tools own criteria and evidence. Do not maintain a second prose copy of structured state.

When structured mission tools are absent, use `portable-lite`: keep the concise mission brief below in the conversation or task list. `portable-lite` does not provide durable persistence, hard transition guards, source-change detection, compaction hooks, or background continuation. State these limits when they affect the mission. Never simulate unsupported durability by expanding the prompt.

## Form The Contract

Before substantial implementation:

1. Inspect the environment and known failure baseline; record route and mode.
2. Write one outcome-based objective and scope snapshot.
3. Give each criterion a stable ID and one independently verifiable outcome. Split independently failing parts.
4. Pair criteria with proportionate authoritative evidence. Baselines and external dependencies are not proof.
5. Record constraints, exclusions, authorization, finite limits, and only necessary milestones.
6. Persist through runtime tools when available; otherwise use `portable-lite`.

Unless the user or runtime supplies tighter limits, default to 20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations. Continuation cycles are automatically requested execution turns, not user messages or tool calls. Adjust limits only when scale requires it, and state the adjustment.

A `portable-lite` brief contains:

```text
Route, mode, objective, and scope:
Criteria and verification:
Baselines, dependencies, and milestones:
Constraints, authorization, and limits:
Current proof and blockers:
Next action:
```

Narrow open-ended objectives such as "keep improving" into an observable diagnostic, decision, or delivery outcome.

## Preserve Decision Ownership

The user owns purpose, priorities, consequential product or value judgments, and authorization for external, destructive, costly, private, or irreversible actions.

The agent owns inspection, a concrete contract proposal, routine reversible implementation decisions, execution, diagnosis, state updates, verification, and handoff.

Ask a question only when the answer can materially change the finish line, verification validity, a consequential judgment, safety or authorization, external impact, or an irreversible direction with meaningful rework. Otherwise inspect, infer local conventions, choose the safest reversible default, state material assumptions, and proceed.

Ask at the decision point. Ask one decision-ready question, recommend an option when technical, and continue independent safe work before pausing. Read [partnership.md](references/partnership.md) only when mission boundaries, learning, or decision ownership remain unclear.

## Plan Portfolios Conditionally

For `ace-single`, do not load portfolio guidance.

For `ace-portfolio`, read [portfolio.md](references/portfolio.md). Freeze the initial child-item list. Each child keeps a stable ID, outcome, state, dependencies, proof, and next action. New input is `criterion-feedback`, `mission-revision`, `separate-work`, or `status-only`; only an explicit user-approved `mission-revision` changes scope.

Default to one active child. Use two only when independent and shared-file ownership is explicit. Invalidate proof only for a changed child and reverse dependencies. Do not reverify unrelated proven children. The parent closes only when every frozen child and shared integration criterion is proven or explicitly qualified.

Use milestones for independently shippable outcomes or a shared foundation. Record outcome, criterion IDs, file scope, verification, dependencies, and review unit. A delivery plan does not authorize branches, commits, pushes, deployments, or pull requests.

For `portable-lite`, preserve prior usage as given, measure current active work when practical, and label missing history unknown. Never infer timing from evidence timestamps. Read [mission-state.md](references/mission-state.md) only when a state decision cannot be made from the brief, such as an ambiguous revision, dependency transition, or recovery record. A structured runtime remains the source of truth when present.

## Execute Compactly

Choose the smallest action that advances an unmet criterion or reduces its highest risk. Inspect actual artifacts and outputs, follow project instructions, and keep unrelated findings outside the mission.

After failure, gather new evidence and change the hypothesis before retrying. Equivalent retries, edit-and-revert cycles, and narrative-only updates are stalls.

At each meaningful iteration record changed artifacts or findings, current evidence and affected criterion IDs, blockers or assumptions, the exact next action, and remaining budget.

Keep one current result per criterion and verification method, superseding older results into history. Routine recovery uses current constraints, criteria, proof, qualifications, limits, and next action. It never replays full audit history.

Apply criterion feedback without changing the finish line. Audit an approved revision before widening scope. Keep separate work outside the mission and answer status-only input without changing state. Ask only when classification changes outcome or authority.

## Preserve Agency By Mode

In `deliver` mode, make routine decisions and surface only consequential choices.

In `learn` mode, let the user make the requested architecture or reasoning decisions. Present focused tradeoffs, handle mechanical setup, agree on one lightweight observable demonstration such as explaining the design, and verify both artifact and demonstration without turning the mission into a quiz.

In `explore` mode, time-box investigation and finish with evidence, uncertainty, and a recommendation or decision path.

In `decide` mode, establish criteria first, compare viable options, expose uncertainty, and leave the final value judgment to the user.

## Enforce Limits

Check the active window before each meaningful cycle and after long operations. At 75%, report unmet criteria and the next bounded step. At 100%, stop with `limit-reached`; a warning does not extend the limit.

Pause or a terminal state freezes time. Resume requires a user decision, opens a new window, and preserves lifetime totals. Label missing history incomplete; an agent cannot authorize its own extension. Count implementation, diagnostic, and verification cycles, not routine reads or status calls. `portable-lite` has no background watchdog.

## Verify And Close

Read [evidence.md](references/evidence.md) only when authoritative proof is unclear, disputed, or being designed for a high-risk outcome. For straightforward criteria, use the least expensive authoritative check whose failure would contradict the claim.

Before closure, re-read the contract and source identity; map every criterion to evidence after its final change; rerun stale checks and inspect full output; reproduce a fixed symptom when practical; inspect the final diff for scope drift; and verify delegated claims independently.

Strict completion requires current passing proof for every criterion and completed milestone. Qualified closure also requires the affected criterion, exact limitation, decision reference, approver, and timestamp. `baseline-qualified` and `accepted-exception` are not `satisfied`. A changed criterion invalidates its proof and exception until checked or explicitly reconfirmed.

Use one terminal state:

- `completed`: all criteria have current proof, or qualified closure records every accepted exception alongside proven criteria;
- `paused`: user input or authorization is required;
- `blocked`: the same material blocker persists after bounded, changed attempts;
- `limit-reached`: the agreed time or continuation budget is exhausted;
- `cancelled`: the user ends the mission.

For any state except `completed`, report what is proven, what remains, the blocker or limit, and the smallest next action. Never present partial work as success.

```text
State:
Objective:
Criteria met: <criterion - fresh evidence>
Criteria unmet: <criterion - missing proof>
Accepted qualifications: <criterion - limitation and decision>
Blocker or limit:
Assumptions made:
Out of scope found:
Next action:
```

An objective grants no permission to commit, push, publish, deploy, spend money, expose secrets, delete resources, or bypass safeguards. Completion is a proven state, not a confidence judgment.

Read [runtime-architecture.md](references/runtime-architecture.md) only for host integration work.
