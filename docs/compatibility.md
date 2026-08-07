# Compatibility

Compatibility has three explicit levels. Format support does not imply that every skill and host combination provides the same runtime lifecycle.

| Level | Meaning |
| --- | --- |
| Format-compatible | The host implements Agent Skills discovery and can load `SKILL.md` plus relative resources. |
| Smoke-tested | The repository provides and has passed a host-level discovery and invocation test. |
| Automation adapter | A maintained host adapter adds durable state, lifecycle events, or automatic continuation. |

`Unverified` means the repository has not established the claimed behavior through native documentation or a host-level smoke test.

## Current Matrix

Compatibility is recorded per skill so unrelated skills can adopt integrations independently.

| Skill | Host | Format-compatible | Smoke-tested | Automation adapter | Invocation |
| --- | --- | --- | --- | --- | --- |
| [Ace](../skills/ace/) | OpenCode | Yes | Yes (`bun run smoke:opencode`) | Yes | Native skill discovery; `/ace` with adapter |
| [Ace](../skills/ace/) | Claude Code | Yes | Not yet | No | `/ace` |
| [Ace](../skills/ace/) | Codex CLI | Yes | Not yet | No | `$ace` or `/skills` |
| [Ace](../skills/ace/) | Pi | Yes | Not yet | No | `/skill:ace` |
| [Ace](../skills/ace/) | Antigravity CLI (`agy`) | Yes | Yes (`bun run smoke:agy`) | No | Plugin skill discovery after `agy plugin install` |
| [Prep That Doc](../skills/prep-that-doc/) | OpenCode | Yes | Not yet | No | Native skill discovery |
| [Prep That Doc](../skills/prep-that-doc/) | Claude Code | Yes | Not yet | No | `/prep-that-doc` |
| [Prep That Doc](../skills/prep-that-doc/) | Codex CLI | Yes | Not yet | No | `$prep-that-doc` or `/skills` |
| [Prep That Doc](../skills/prep-that-doc/) | Pi | Yes | Not yet | No | `/skill:prep-that-doc` |
| [Prep That Doc](../skills/prep-that-doc/) | Antigravity CLI (`agy`) | Yes | Yes (`bun run smoke:agy`) | No | Plugin skill discovery after `agy plugin install` |

## Integration Gate

Add a host integration only when all conditions hold:

1. A reproducible host limitation prevents the portable skill from completing a representative mission.
2. The host exposes a documented lifecycle API that solves that limitation.
3. The integration can delegate policy to the canonical skill instead of copying it.
4. The host discovery and invocation path has a reproducible smoke command. Adapter installers have automated installation and forced-upgrade regression tests when present.
5. A maintainer accepts responsibility for tracking that host API.

MCP can expose shared skill state tools but cannot universally resume a stopped host conversation. It is not a cross-host lifecycle control plane.

## Sources

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex skills](https://developers.openai.com/codex/build-skills)
- [Pi skills](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md)
- [Antigravity CLI plugins and skills](https://antigravity.google/docs/cli/plugins)
- [OpenCode skills](https://opencode.ai/docs/skills/)
