# Compatibility

Compatibility has three explicit levels. A portable format claim is not a claim that every host provides the same runtime lifecycle.

| Level | Meaning |
| --- | --- |
| Format-compatible | The host implements Agent Skills discovery and can load `SKILL.md` plus relative resources. |
| Smoke-tested | The repository provides and has passed a host-level discovery and invocation test. |
| Enhanced | A maintained host integration adds durable state, lifecycle events, or automatic continuation. |

## Current Matrix

| Host | Format-compatible | Smoke-tested | Enhanced | Invocation |
| --- | --- | --- | --- | --- |
| OpenCode | Yes | Yes (`bun run smoke:opencode`) | Yes | `/ace` |
| Claude Code | Yes | Not yet | No | `/ace` |
| Codex CLI | Yes | Not yet | No | `$ace` or `/skills` |
| Pi | Yes | Not yet | No | `/skill:ace` |
| Antigravity CLI (`agy`) | Installer-supported; native package shape needs verification | Not yet | No | `/ace` |

The portable Ace contract remains useful without an enhanced integration. The host may keep executing within its normal run, while Ace records the mission brief in available conversation or task state.

## Integration Gate

Add a host integration only when all conditions hold:

1. A reproducible host limitation prevents the portable skill from completing a representative mission.
2. The host exposes a documented lifecycle API that solves that limitation.
3. The integration can delegate policy to the canonical skill instead of copying it.
4. Installation, invocation, stopping, and upgrade behavior have automated smoke tests.
5. A maintainer accepts responsibility for tracking that host API.

MCP can expose shared Ace state tools but cannot universally resume a stopped host conversation. It is not a cross-host lifecycle control plane.

## Sources

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex skills](https://developers.openai.com/codex/build-skills)
- [Pi skills](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md)
- [Antigravity CLI plugins and skills](https://antigravity.google/docs/cli/plugins)
- [OpenCode skills](https://opencode.ai/docs/skills/)
