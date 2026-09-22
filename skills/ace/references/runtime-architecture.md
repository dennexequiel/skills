# Ace Runtime Architecture

This note defines the target runtime boundary, the current shared slice, and the promotion gates for Ace integrations. It is an implementation reference, not part of the default mission prompt.

## Boundary

| Layer | Owns | Does not own |
| --- | --- | --- |
| Skill | Applicability, route, criterion quality, evidence interpretation, and user decision boundaries | Persistence, hard guards, host events, or background execution |
| Deterministic core | State schemas and migration, pure transitions as they are extracted, evidence freshness, dependency invalidation, completion checks, current projection, and audit projection | Filesystem paths, Git commands, host clients, or event names |
| Host adapter | Tool schemas, storage, source capture, serialization, lifecycle events, and continuation supported by that host | Product priorities, new authorization, or weaker completion semantics |
| User or external system | Purpose, consequential tradeoffs, authorization, and evidence produced outside the agent's environment | Routine reversible implementation mechanics |

Every extracted core operation accepts explicit state, source, and time inputs as needed and returns a new state or a specific error. Adapters obtain host data, call those operations, persist the result, and translate host events. Transitions not listed in the current shared interface remain adapter-owned until focused tests support extraction. A host without a complete adapter uses `portable-lite`: a compact in-conversation contract without claims of durable state, hard enforcement, compaction recovery, or automatic continuation.

## Shared Module And Interface

The public barrel is `skills/ace/runtime/index.ts`. Its focused modules are:

- `types.ts` for versioned mission-state types and enums;
- `parse.ts` for schema validation and version-1 migration;
- `proof.ts` for strict and qualified close guards;
- `milestones.ts` for dependency validation and affected-only reverse dependency invalidation;
- `transitions.ts` for evidence replacement, source-change invalidation, and qualification-driven milestone closure;
- `projection.ts` for the history-free current-state view.

The OpenCode source adapter imports this barrel. Its installer bundles the adapter and shared runtime into the existing single `plugins/ace.ts` destination, so OpenCode discovery and user-managed paths do not change.

Adapters import the public barrel rather than internal modules. OpenCode still owns start, progress orchestration, pause, resume, contract revision, exception acceptance, and terminal transitions. Those operations remain candidates for incremental extraction. Host-specific storage and events stay outside the core.

## Extraction Sequence

1. Characterize the current adapter with focused tests for parsing, completion, recovery projections, and revision invalidation.
2. Move state types, parsing, completion checks, and revision invalidation into the shared module without changing OpenCode tool schemas or persisted version 2.
3. Make the OpenCode adapter call the shared functions and keep its Git capture, atomic storage, lifecycle hooks, and continuation behavior in place.
4. Bundle the shared import during OpenCode installation and verify both source and installed forms.
5. Extract remaining transitions only when focused tests can preserve their current guards.

## Codex Integration

Current official documentation establishes three usable extension points:

- [`/goal`](https://learn.chatgpt.com/use-cases/follow-goals) provides a durable top-level objective with status, pause, resume, and terminal lifecycle. It does not document Ace's criterion, evidence, dependency, or source-identity schema.
- [MCP](https://learn.chatgpt.com/docs/extend/mcp) supports local STDIO and remote HTTP servers. It is suitable for the Ace tool contract and durable storage, but would require a separately installed and tested server.
- [Hooks](https://learn.chatgpt.com/docs/hooks) expose tool, compaction, stop, interrupt, and session events and may call commands or existing MCP tools. Non-managed hooks require review and trust. Missing MCP hook tools and hook errors do not block operations, so hooks alone cannot provide strict completion enforcement.

The supported Codex design is therefore: native goal lifecycle for the top-level objective, an MCP or local deterministic bridge for mission state, and trusted hooks only for recovery context and guard assistance. This repository does not yet ship that adapter. Codex without it uses `portable-lite`. No background-continuation or hard-enforcement claim follows from the skill alone.

## Evaluation Matrix And Promotion Gates

| Scenario | Ordinary | Current portable | Optimized portable | OpenCode adapter | Future Codex adapter |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ordinary task routes normal | Required | Required | Required | Required | Required |
| Bounded single mission | Control | Required | Required | Required | Required |
| Four-child independent portfolio | Control | Required | Required | Required | Required |
| Shared-dependency portfolio | Control | Required | Required | Required | Required |
| Feedback, revision, unrelated input | Control | Required | Required | Required | Required |
| Pause, resume, compaction | Control | Best effort | Best effort | Required | Required |
| Source change and qualified close | Control | Best effort | Best effort | Required | Required |
| Missing integration | Control | Required | Required | Required | Required |

Promotion requires artifact review rather than keyword scoring, zero false completion in the evaluated cases, frozen portfolio scope, correct affected-only invalidation, preserved failures and incomplete usage, and matched model, reasoning, permission, tool, and time settings. Report tokens, cost, and time only when the host supplies them. General efficiency claims require repeated comparable verified outcomes.

## Instruction Context Gate

The baseline byte counts are 18,516 for `SKILL.md`, 3,790 for routing, and 2,609 for portfolio. The first extraction target is:

- normal route: discovery metadata only;
- unambiguous single mission: `SKILL.md` at or below 12,000 bytes;
- ambiguous routing: core plus routing at or below 16,000 bytes;
- portfolio: core plus portfolio at or below 14,500 bytes, with routing added only when the route is genuinely ambiguous;
- ambiguous portfolio: core, routing, and portfolio at or below 18,000 bytes;
- evidence and mission-state references: loaded only for proof design or `portable-lite` state decisions.

These are context-byte ceilings, not token or billing estimates. Passing them is not evidence of better outcomes or lower end-to-end cost.
