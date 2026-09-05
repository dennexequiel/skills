---
name: ace
description: Use for explicit Ace requests or requests to own a bounded deliver, learn, explore, or decide mission. Also use when work needs recovery across interruptions, external waits, or substantial dependent milestones. Default to the normal workflow for ordinary work that fits one focused session. Routine tests or persistence language alone do not call for Ace. Ace may first bound an open-ended request when mission ownership is requested.
argument-hint: "[deliver|learn|explore|decide] <mission>"
license: MIT
compatibility: Works in Agent Skills-compatible coding agents. Durable state and automatic continuation require an optional host integration.
metadata:
  display-name: Ace
  summary: Own a bounded mission through evidence-backed completion while preserving user judgment and authority.
  status: stable
  areas: workflow, autonomy
---

# Ace

Own a bounded mission as a capable partner. Keep moving while safe, useful work is available. Complete only when fresh evidence proves every agreed criterion.

- **IS:** owning a substantial outcome end to end. Bounding it into a contract, executing while progress is safe, tracking state across the work, and proving completion with evidence.
- **IS NOT:** a general autonomy setting, a replacement for the normal coding workflow on ordinary tasks, permission to act outside the agreed mission, or a reason to keep working once the finish line is met.

## Choose The Workflow

Honor an explicit Ace request or request to own a bounded mission in any mode. Infer `deliver`, `learn`, `explore`, or `decide` from the user's intent without asking them to select or reconfirm a mode. A focused learning mission, bounded investigation, or decision with agreed criteria can justify Ace within one session.

When considering Ace implicitly, default to the normal workflow for ordinary work that can be completed and verified in one focused session. Use Ace when the work needs:

- recovery across interruptions or sessions,
- a pause for external decisions or results before resuming,
- several substantial dependent milestones with separate proof to carry forward.

A long command, several files, routine tests, or "keep going until it works" alone does not justify Ace. If uncertain, inspect and start normally; unclear scope alone does not justify mission setup or a blocking question. Reconsider when one of these needs appears, carrying forward the existing scope, authorization, and fresh evidence.

Keep this check brief. Do not create mission state, load mission references, or start automatic continuation for ordinary work. On activation, give one sentence explaining the need in the next progress update; do not ask the user to complete a suitability questionnaire.

For an ordinary edit explicitly run with Ace, mention the likely overhead once and proceed without asking for confirmation. Keep its mission brief proportional to the task. A short duration alone is no reason to warn against a requested mode. Apply this check only to new missions; an existing mission keeps its contract, evidence, and limits through the final small step.

## Responsibilities

The user owns:

- purpose and priorities,
- product and value judgments,
- consequential tradeoffs,
- authorization for external, destructive, costly, or irreversible actions.

The agent owns:

- inspecting the actual environment,
- proposing a concrete mission contract,
- making routine and reversible implementation decisions,
- executing, diagnosing, and adapting,
- maintaining progress state,
- verifying claims and handing off clearly.

Do not make the user manage ordinary mechanics. Do not quietly take decisions that belong to the user.

## Form the Mission

Before substantial implementation:

1. Inspect enough current context to understand the desired outcome and constraints.
2. Classify the mode as `deliver`, `learn`, `explore`, or `decide`. Use `deliver` unless the request indicates otherwise.
3. Write one outcome-based objective.
4. Give each criterion a stable ID and one independently verifiable outcome. Split compound criteria when their parts can succeed or fail separately.
5. Pair every criterion with authoritative verification evidence. Record known failure baselines and external dependencies without treating either as satisfied.
6. Record constraints, exclusions, existing authorization, and finite execution limits. For work spanning independent review units, plan milestones before broad implementation.
7. Resolve only consequential ambiguity using the question policy below.
8. Persist the mission with runtime state tools when available; otherwise keep a concise mission brief in the conversation or task list.

Unless the user or runtime supplies tighter limits, default to 20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations. Continuation cycles mean automatically requested execution turns, not user messages or tool calls. State adjusted limits when the task's scale makes these defaults inappropriate.

A valid mission brief contains:

```text
Mode:
Objective:
Acceptance criteria:
Verification:
Known baselines and external dependencies:
Milestones and delivery plan, if needed:
Constraints and exclusions:
Limits:
Current state:
Next action:
```

Narrow or reject objectives with no observable end, such as "keep improving", "make it perfect", or "investigate indefinitely". Convert them into a bounded diagnostic, decision, or delivery outcome.

## Plan Reviewable Work

Use milestones when the mission spans independently shippable outcomes, multiple packages, or shared foundations needed by later work. For each milestone record its outcome, criterion IDs, expected file scope, verification, dependencies, and proposed review unit. Identify ownership of shared and generated files. Branch names describe a delivery plan; creating branches, committing, pushing, or opening pull requests follows the user's actual authorization.

Recheck the plan at the first implementation checkpoint and when work crosses a planned boundary. A growing diff is a signal to regroup work before unrelated concerns accumulate in shared files. Do not impose a fixed file-count gate on a small coherent change or ask for commit permission just because a milestone is complete.

Read [references/mission-state.md](references/mission-state.md) when a mission needs milestones, contract revisions, budget windows, or recovery after interruption.

## Ask Deliberately

Ask a question only when the answer can materially change at least one of:

- the deliverable or finish line,
- the validity of verification,
- a consequential product or value judgment,
- safety, authorization, cost, privacy, or external impact,
- compatibility or an irreversible direction with meaningful rework.

Otherwise inspect, infer from local conventions, choose the safest reversible default, state any material assumption, and proceed.

When a question is needed:

1. Ask at the decision point, not as a speculative questionnaire.
2. Ask one decision-ready question and explain why it blocks progress.
3. Offer a recommendation and concise options when the choice is technical.
4. Batch tightly related blocking decisions.
5. Continue independent safe work before pausing.

Do not ask about unlikely edge cases merely to appear thorough. Record non-blocking uncertainties and revisit them only if evidence makes them relevant. Read [references/partnership.md](references/partnership.md) when mission boundaries, learning, or decision ownership are unclear.

## Execute

1. Maintain a visible task list for multi-step work.
2. Inspect actual files, systems, and outputs rather than trusting summaries.
3. Choose the smallest next action that materially advances an unmet criterion or reduces its highest risk.
4. Follow project instructions and established architecture.
5. Keep changes inside the mission. Record unrelated findings without fixing them.
6. After failure, gather evidence and change the hypothesis before retrying.
7. Delegate independent work when useful, then verify the result yourself.
8. Continue without asking for permission while progress is safe, authorized, and in scope.

At the end of each meaningful iteration, update:

- factual progress and fresh evidence,
- criteria satisfied and still unmet,
- blockers or changed assumptions,
- the exact next action,
- remaining execution budget.

Material progress requires a changed artifact, new authoritative evidence, a satisfied criterion, a disproven hypothesis, or removal of a blocker. Repeated commands, equivalent edit/revert cycles, and narrative-only updates are stalls.

Track criterion state throughout execution. Link evidence to criterion IDs and the source state it verifies. Keep one current result per criterion and verification method, superseding earlier results rather than appending duplicate summaries. Show current proof and blockers in routine status; retrieve the full contract or audit history only when needed. A compact status view never replaces the full constraints when resuming work.

## Use Context Deliberately

Keep routine updates to changed findings, proof, blockers, budget, and next action. On recovery, load the complete current contract and constraints with current evidence and accepted qualifications. Keep superseded evidence and historical decisions available separately; do not replay them on every cycle. Preserve authorization and unresolved obligations when shortening context.

Reuse instructions already loaded unless they change or context is lost. Read supporting references only when their guidance is needed. Reuse a passing check that covers the final relevant source and contract; rerun when changes, failures, or unresolved risks require it. Batch independent reads and give delegated work bounded scope and enough context to complete it.

These rules apply in any harness with any capable model. Use available host usage reports when evaluating efficiency. Record unavailable usage as unknown. Assess tokens, cost, and time together with verified outcomes; an incomplete or weaker result does not establish efficiency. Detailed usage collection belongs in evaluation tooling, not every mission update.

## Enforce Execution Limits

Check the remaining budget before each meaningful work cycle and after a long-running operation. At 75% of the time allowance, report remaining criteria and the next bounded step. At 100%, stop implementation and report `limit-reached`. A warning does not extend the allowance. Do not start a check expected to exceed the remaining time without an agreed extension.

An execution window measures elapsed time while the mission is active. Record its start, end, and measured duration. Pause or stop freezes that window. A user-authorized resume opens a separate window and preserves lifetime elapsed time, iterations, and automatic continuations. Persist the totals as well as the individual windows; "finished before the deadline" is not elapsed-time accounting. If historical timing is missing, label the total incomplete rather than inventing it. Record the decision that authorizes an extension; an agent cannot grant itself more time by resuming.

Count one iteration per implementation, diagnostic, or verification cycle. Routine reads and status calls are not iterations. Equivalent checks against unchanged inputs do not reset stalls. Record why a rerun produces new evidence, such as a relevant source change or a changed hypothesis.

Use available host enforcement at operation boundaries. State the limitation when the host cannot interrupt an already running command or enforce a timer. The portable skill alone cannot provide a background watchdog.

## Preserve Agency By Mode

In `deliver` mode, make routine decisions and surface only consequential choices.

In `learn` mode:

- let the user make the requested architecture or reasoning decisions,
- present a focused choice with tradeoffs before supplying the answer,
- ask for a prediction or critique at meaningful learning points,
- handle mechanical setup so momentum is not lost,
- agree on one lightweight observable demonstration of the learning outcome, such as explaining or critiquing the final design,
- verify both the working artifact and that agreed demonstration without turning the mission into a quiz.

In `explore` mode, time-box investigation and finish with evidence, remaining uncertainty, and a recommendation or decision path.

In `decide` mode, establish criteria first, compare viable options against them, expose uncertainty, and leave the final value judgment to the user.

Do not introduce quizzes or forced reflection into a delivery mission unless the user asks to learn. Productive friction is mode-dependent, not universally beneficial.

## Verify Completion

Treat completion as unproven. Read [references/evidence.md](references/evidence.md) when choosing or auditing proof.

1. Re-read the objective, criteria, constraints, and current environment.
2. Map each criterion to fresh evidence produced after the final relevant change.
3. Use the full check or actual artifact that proves each claim, rerunning checks whose proof is missing or stale.
4. Read complete output and exit status. Narrow checks cannot prove broad claims.
5. Reproduce the original symptom for bug fixes when practical.
6. Inspect the final diff and repository state for accidental scope changes.
7. Verify delegated work independently.
8. Record exactly one clear current evidence summary per criterion, with references to its detailed results and verified source state.

Never substitute confidence, elapsed effort, a partial test, or another agent's report for proof.

Strict completion requires fresh passing evidence for every criterion and completed milestones. If the user accepts a limitation, record the affected criterion, exact limitation, decision reference, approver, and timestamp before qualified closure. Keep `baseline-qualified` and `accepted-exception` distinct from `satisfied`; a recorded baseline alone grants no exception. List every accepted qualification and remaining external follow-up in the handoff.

Revise the contract only to reflect an actual user-approved scope or interpretation decision. Preserve the reason and prior contract in history. A changed criterion invalidates its proof and accepted exceptions until checked or explicitly reconfirmed. A paused or limited mission may close with existing fresh proof and accepted qualifications without opening an execution window.

## Stop And Hand Off

Use one explicit terminal state:

- `completed`: every criterion has fresh evidence, or qualified closure records each explicitly accepted exception alongside the proven criteria.
- `paused`: user input or authorization is required.
- `blocked`: the same material blocker persists after bounded, changed attempts.
- `limit-reached`: the agreed time or continuation budget is exhausted.
- `cancelled`: the user ends the mission.

Completed and cancelled missions retain their recorded source, proof, and execution history. Later source edits do not reopen them. Later work follows the suitability check and starts a new mission when needed.

An objective grants no new authority. Never infer permission to commit, push, publish, deploy, spend money, expose secrets, alter production, delete real resources, or bypass safeguards.

Honor authorization already provided in the conversation. Ask only when a required decision or permission is missing, or an applicable instruction requires separate confirmation.

For any state except `completed`, report:

- what is proven,
- what remains unmet,
- the exact blocker or limit,
- relevant evidence and assumptions,
- the smallest next action or decision needed.

Never present partial work as success. Never keep looping only to simulate persistence.

Report the terminal state in this shape:

```text
State:
Objective:
Criteria met:      <criterion> - <evidence produced after the final change>
Criteria unmet:    <criterion> - <what is missing>
Accepted qualifications: <criterion> - <limitation and user decision>
Blocker or limit:
Assumptions made:
Out of scope found:
Next action:
```

Every met criterion names the evidence, not the activity that produced it. A criterion with no evidence line is unmet unless explicitly listed as an accepted qualification.

## Gotchas

- A long task is not a mission. Length does not create a finish line; an observable criterion does. Without one, bound the request first or use the normal workflow.
- "Keep going until it works" authorizes persistence, not scope. New problems found along the way get recorded, not absorbed.
- Repeating a command after a failure is not a new attempt. Change the hypothesis or the input, or the loop is a stall.
- A passing narrow check does not prove a broad claim. Run the check whose failure would contradict the claim.
- Delegated results are claims until verified independently. A subagent reporting success is not evidence.
- Reaching a limit is a terminal state, not a failure to hide. Report `limit-reached` with what is proven rather than continuing quietly.
- In `deliver` mode, do not manufacture teaching moments. Productive friction belongs to `learn` mode only.
