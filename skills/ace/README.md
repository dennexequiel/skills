# Ace

Ace is a mission-ownership skill for coding agents. It turns a substantial outcome into a bounded contract, executes while safe progress is available, and claims success only when fresh evidence proves the agreed finish line.

## Install

Choose the package runner already available on your machine:

```sh
# Node.js
npx skills add dennexequiel/skills --skill ace

# Bun
bunx skills add dennexequiel/skills --skill ace
```

Run one command, not both. This installs Ace and its bundled references without an automation adapter. OpenCode users who want `/ace`, durable state, and automatic continuation should use the adapter installation below instead of installing the core skill first.

To install Ace globally for Claude Code without interactive prompts:

```sh
npx skills add dennexequiel/skills --skill ace --agent claude-code --global --yes
```

## Use

Use the normal workflow for ordinary edits and quick answers. Ace fits work that needs recovery across interruptions, external waits, or substantial dependent milestones. Bounded missions in any of its four modes can also fit one focused session; duration alone does not decide suitability.

| Task | Default workflow |
| --- | --- |
| Fix a bounded bug and run its tests | Normal workflow |
| Update a skill or document | Normal workflow |
| Migrate a service through dependent, separately verified stages | Ace |
| Own a rollout across external waits and multiple sessions | Ace |
| Build an OAuth client while practicing architecture decisions | Ace, `learn` |
| Investigate a bounded question and finish with evidence | Ace, `explore` |
| Own a comparison against agreed criteria and recommend an option | Ace, `decide` |

If the need is unclear, start normally and adopt Ace when it appears. Explicit Ace and bounded mission requests are honored. Ace infers the mode from intent without a selection or confirmation step. An ordinary edit explicitly run with Ace gets one brief overhead notice; a short learning, exploration, or decision mission needs no such warning merely because it is short. Existing missions keep their state and limits through completion.

Start Ace with a mode and a bounded mission. For hosts that expose Ace as a slash command:

```text
/ace deliver <mission>
/ace learn <mission>
/ace explore <mission>
/ace decide <mission>
```

Invocation syntax varies by host; see the live repository [compatibility matrix](https://github.com/dennexequiel/skills/blob/main/docs/compatibility.md).

- `deliver` owns routine execution through verified completion.
- `learn` leaves the architecture and reasoning decisions to the user while building.
- `explore` time-boxes investigation and ends with evidence and a recommendation.
- `decide` compares viable options while leaving the final value judgment to the user.

## Lifecycle

A mission has states between start and finish. What the host gives you depends on whether an automation adapter is installed.

| Action | Portable skill | With the OpenCode adapter |
| --- | --- | --- |
| Start a mission | Invoke with a mode and mission | `/ace <objective>` |
| See current state | Ask for mission status | `/ace status` |
| Record progress | Happens in the mission brief | Ace records it through `ace_progress`; no user command |
| Pause for input | Ace reports `paused` and stops | `/ace pause <reason>` |
| Resume | Authorize the next bounded execution window | `/ace resume <next action>` |
| Finish | Ace reports `completed` with evidence | `/ace complete` |
| Close with qualifications | Accept specific limitations in the mission brief | Ask Ace to record the decisions and close with qualifications |
| Revise the contract | Record the approved change and affected criteria | Ask Ace to record the revision and its user decision |
| Abandon | Ace reports `cancelled` | `/ace cancel <reason>` |
| Discard stored state | Nothing is stored | `/ace clear` |

Execution limits are set at start time. The portable defaults are 20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations. The adapter accepts overrides:

```text
/ace --max-turns 30 --max-minutes 90 --max-stalls 3 <objective>
```

Limits bound execution only. They never lower the mission's acceptance criteria, so hitting one produces a `limit-reached` handoff rather than a completion claim.

At 75% of the time allowance, Ace reports remaining work. At the agreed deadline, it stops implementation. A resume preserves the prior window and lifetime totals. The adapter checks operation boundaries; it cannot interrupt a host command already in progress.

Without an adapter the same lifecycle exists as conversation. Ace still reports one terminal state and still refuses to claim completion without evidence; it just cannot survive a stopped session or continue on its own.

## Partnership

Ace is intentionally not a generic "be autonomous" prompt. It separates responsibilities:

- The user owns purpose, priorities, consequential tradeoffs, and authorization.
- The agent owns discovery, routine implementation decisions, progress tracking, verification, and transparent handoff.

Before substantial work, Ace records a mission brief with the mode, objective, criterion IDs, verification, known baselines, constraints, limits, current state, and next action. Missions spanning independent review units also record milestones, dependencies, file ownership, and a proposed delivery plan. Planning a branch or commit grants no permission to create it.

Each criterion keeps its current proof separate from evidence history. Source changes invalidate affected proof in unfinished missions. Strict completion requires fresh passing evidence for every criterion. Qualified closure records explicit user acceptance for each named limitation and reports those qualifications separately from satisfied criteria. Completed and cancelled missions retain their recorded source and evidence; later work follows the suitability check without reopening the old mission.

Ace asks only when an answer can materially change the outcome, evidence, risk, direction, or authorization. Existing user authorization remains in force.

## Compatibility

The core skill works in Agent Skills-compatible clients. Optional runtime integrations can add durable mission state and automatic continuation.

OpenCode users who need those capabilities can install the [OpenCode Automation Adapter](https://github.com/dennexequiel/skills/tree/main/adapters/opencode). The adapter installer includes the core skill. Other hosts can use Ace within their normal skill lifecycle.

## Limitations

- Ace needs an observable finish line. Ordinary tasks default to the normal workflow; explicit Ace requests can use a proportionate mission brief. Passive brainstorming and indefinite improvement need a bounded outcome before execution.
- The core skill does not add durable state or automatic continuation when a host lacks those capabilities.
- Structured evidence records do not prove that an agent executed a check. Review the actual command output or artifact.
- Token efficiency depends on the model, harness, and mission. Recovery retains the current contract and proof while historical records stay available separately. Efficiency evaluations compare verified outcomes and measured usage within each host configuration.
- Automatic freshness detection depends on the adapter's source-tracking policy. External environments and ignored files need explicit verification.
- Host discovery and invocation behavior vary; check compatibility status before relying on a specific command.

## Reference

- [SKILL.md](SKILL.md) defines the operative contract.
- [partnership.md](references/partnership.md) explains decision ownership and the question policy.
- [evidence.md](references/evidence.md) defines completion proof standards.
- [mission-state.md](references/mission-state.md) defines criterion states, milestones, budget windows, and qualified closure.
- [Compatibility](https://github.com/dennexequiel/skills/blob/main/docs/compatibility.md) records compatibility claims, test status, and invocation syntax.
