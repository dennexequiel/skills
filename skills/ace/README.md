# Ace

Ace is a portable mission-ownership skill for coding agents. It turns a substantial outcome into a bounded contract, executes while safe progress is available, and claims success only when fresh evidence proves the agreed finish line.

Ace is intentionally not a generic "be autonomous" prompt. It separates responsibilities:

- The user owns purpose, priorities, consequential tradeoffs, and authorization.
- The agent owns discovery, routine implementation decisions, progress tracking, verification, and transparent handoff.

See [SKILL.md](SKILL.md) for the operative contract, [partnership.md](references/partnership.md) for the question policy, and [evidence.md](references/evidence.md) for proof standards.

## Runtime Support

The core skill works in Agent Skills-compatible clients. Optional runtime integrations can add durable mission state and automatic continuation. Compatibility claims and integrations are maintained by the source repository, not by this portable skill package.
