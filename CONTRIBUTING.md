# Contributing

Contributions should keep each skill portable, self-contained, and independently installable.

## Add Or Change A Skill

1. Keep the canonical path at `skills/<name>/SKILL.md`.
2. Include `name`, `description`, `license`, `metadata.display-name`, `metadata.summary`, `metadata.status`, and `metadata.areas` in strict Agent Skills frontmatter.
3. Keep runtime resources inside the skill directory and link them directly from `SKILL.md`.
4. Add positive, negative, and ambiguous trigger cases under `evals/<name>/triggers.json`.
5. Add behavioral cases under `evals/<name>/evals.json`.
6. Run `bun run generate:catalog` after metadata changes.
7. Run `bun run check`.

Install the pinned development toolchain with `bun install --frozen-lockfile`. Skills themselves should not gain runtime package dependencies without a concrete need.

Do not add dependencies, host adapters, generated instruction copies, or release tooling without demonstrating the maintenance problem they solve.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, and `perf:`. Keep each commit focused on one concern.

See [compatibility](docs/compatibility.md), [maintenance](docs/maintenance.md), and [releases](docs/releases.md) for support and versioning policy.
