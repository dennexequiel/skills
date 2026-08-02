# Ace

Ace is a mission-ownership skill for coding agents. It turns a substantial outcome into a bounded contract, executes while safe progress is available, and claims success only when fresh evidence proves the agreed finish line.

Status: **experimental**

## Install

Choose the package runner already available on your machine:

```sh
# Node.js
npx skills add dennexequiel/skills --skill ace

# Bun
bunx skills add dennexequiel/skills --skill ace
```

Run one command, not both. This installs Ace and its bundled references without an automation adapter.

To install Ace globally for Claude Code without interactive prompts:

```sh
npx skills add dennexequiel/skills --skill ace --agent claude-code --global --yes
```

## Use

Start Ace with a mode and a bounded mission. For hosts that expose skills as slash commands:

```text
/ace deliver <mission>
/ace learn <mission>
/ace explore <mission>
/ace decide <mission>
```

Invocation syntax varies by host; see the repository [compatibility matrix](https://github.com/dennexequiel/skills/blob/main/docs/compatibility.md).

- `deliver` owns routine execution through verified completion.
- `learn` keeps the user involved in key reasoning while building.
- `explore` time-boxes investigation and ends with evidence and a recommendation.
- `decide` compares viable options while leaving the final value judgment to the user.

Use Ace for substantial work with an observable finish line. Do not use it for one-step tasks, passive brainstorming, or indefinite improvement.

## Partnership

Ace is intentionally not a generic "be autonomous" prompt. It separates responsibilities:

- The user owns purpose, priorities, consequential tradeoffs, and authorization.
- The agent owns discovery, routine implementation decisions, progress tracking, verification, and transparent handoff.

Before substantial work, Ace records a mission brief with the mode, objective, acceptance criteria, verification, constraints, limits, current state, and next action. It asks only when an answer can materially change the outcome, evidence, risk, direction, or authorization.

## Runtime Support

The core skill works in Agent Skills-compatible clients. Optional runtime integrations can add durable mission state and automatic continuation.

OpenCode users who need those capabilities can install the [OpenCode Automation Adapter](https://github.com/dennexequiel/skills/tree/main/adapters/opencode). Other hosts can use the core skill within their normal execution lifecycle.

## Reference

- [SKILL.md](SKILL.md) defines the operative contract.
- [partnership.md](references/partnership.md) explains decision ownership and the question policy.
- [evidence.md](references/evidence.md) defines completion proof standards.
- [Compatibility](https://github.com/dennexequiel/skills/blob/main/docs/compatibility.md) records tested host support and invocation syntax.
