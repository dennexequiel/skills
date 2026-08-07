# Repository Guidelines

## Purpose

This repository contains portable agent skills and optional runtime adapters. A skill is a concise behavioral contract, not a replacement for project instructions or runtime permissions.

## Source Layout

- `skills/<name>/SKILL.md`: portable source of truth with discovery frontmatter.
- `skills/<name>/references/`: focused details linked from the skill.
- `skills/<name>/scripts/`: executables the skill ships, resolved relative to the installed skill directory.
- `evals/<name>/`: realistic prompts, expected behaviors, and anti-patterns.
- `adapters/<runtime>/`: runtime-specific persistence, commands, and hooks.
- `scripts/`: repository checks and installers using only Bun and Node built-ins at runtime.
- `tests/`: contract and regression tests.
- `.claude-plugin/`: Claude Code marketplace and plugin manifests, kept in step with the catalog.
- `catalog.json`: generated discovery catalog; never edit manually.

## Skill Design

- Use lowercase kebab-case names that match the skill directory.
- State when the skill should and should not activate in the frontmatter description.
- Keep `SKILL.md` under 500 lines and disclose detail progressively through references.
- Write portable instructions in terms of capabilities, not one agent's tool names.
- Keep runtime-specific behavior in adapters. The portable contract remains usable without an adapter.
- Preserve user authority over consequential tradeoffs, external side effects, and irreversible actions.
- Define observable completion evidence. Do not treat activity or a success claim as proof.
- Add evaluations for ambiguity, stopping, safety, and overreach, not only happy paths.
- Keep canonical skill paths flat. Put areas and lifecycle state in metadata.
- Keep portable skill resources inside the skill directory. Keep adapter dependencies and installation logic isolated from portable skill bundles.

## Change Policy

- Keep changes minimal and scoped to one skill or shared convention.
- Do not add dependencies without approval.
- Do not edit generated artifacts.
- Run `bun run generate:catalog` after changing skill metadata.
- Update the skill, evaluations, adapter behavior, and documentation together when a contract changes.
- Keep all TypeScript within the strict root `tsconfig.json`; do not suppress errors with broad casts or disabled checks.
- Describe the collection without naming the skills it contains, so a new skill dates nothing.
- Run `bun run check` before review. Host smoke commands need that host installed and run separately.
