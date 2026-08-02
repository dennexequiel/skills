# OpenCode Automation Adapter

The OpenCode automation adapter adds capabilities that the portable Ace skill does not assume:

- `/ace` command routing,
- project-and-session-scoped durable state,
- explicit start, status, progress, pause, resume, complete, cancel, and clear tools,
- bounded automatic continuation after idle events,
- state restoration during context compaction,
- duplicate idle-event protection.

State is stored under `${XDG_STATE_HOME:-~/.local/state}/opencode/ace/`. Automatic continuation requires the OpenCode TUI or server process to remain active; a one-shot `opencode run` process can exit before a queued continuation executes.

## Install

From the repository root:

```sh
bun run install:opencode
```

The installer verifies the pinned `@opencode-ai/plugin` version and installs it in the OpenCode configuration package when absent. It refuses a conflicting installed version rather than changing another plugin's runtime without review. Restart OpenCode after installation.

Run the host-level smoke test after installation:

```sh
bun run smoke:opencode
```

## Commands

```text
/ace <objective>
/ace --max-turns 30 --max-minutes 90 --max-stalls 3 <objective>
/ace status
/ace pause <reason>
/ace resume <next action>
/ace cancel <reason>
/ace clear
```

The automation adapter defaults to 20 automatic continuations, 60 minutes, and 3 consecutive stalls. Runtime limits bound execution; they do not weaken the mission's acceptance criteria.
