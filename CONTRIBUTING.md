# Contributing

Contributions should keep each skill portable, self-contained, and independently installable.

## Add Or Change A Skill

1. Keep the canonical path at `skills/<name>/SKILL.md`.
2. Include Agent Skills fields `name` and `description`, set `license: MIT`, and add repository catalog metadata for `display-name`, `summary`, `status`, and `areas`.
3. Use an `experimental`, `stable`, or `deprecated` status. Write areas as unique, comma-separated kebab-case values.
4. Add `skills/<name>/README.md` with `Install`, `Use`, `Compatibility`, and `Limitations` sections.
5. Bundle a copy of the root `LICENSE` and keep runtime resources inside the skill directory with direct links from `SKILL.md`.
6. Add positive, negative, and ambiguous trigger cases under `evals/<name>/triggers.json`.
7. Add at least five behavioral cases with expected behavior and anti-patterns under `evals/<name>/evals.json`.
8. Record each claimed host in the per-skill [compatibility matrix](docs/compatibility.md). Use `Unverified` instead of implying untested support.
9. Run `bun run generate:catalog` after metadata changes.
10. Run `bun run check`.

Install the pinned development toolchain with `bun install --frozen-lockfile`. Portable skill bundles should not gain runtime package dependencies without a concrete need. Adapter dependencies and installation logic must remain isolated from portable skill bundles.

Do not add dependencies, host adapters, generated instruction copies, or release tooling without demonstrating the maintenance problem they solve.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, and `perf:`. Keep each commit focused on one concern.

See [compatibility](docs/compatibility.md), [maintenance](docs/maintenance.md), and [releases](docs/releases.md) for support and versioning policy.
