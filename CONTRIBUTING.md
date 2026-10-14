# Contributing

Contributions should keep each skill portable, self-contained, and independently installable.

## Public Content

Publish maintained instructions, reproducible evaluation evidence and reviewed examples. Keep client material, raw conversations, research scratchpads, temporary outputs and machine-specific paths in the ignored `.local/` directory unless their publication is explicitly authorized and their content is reviewed.

Before a commit or push, inspect the files being published, including image content and metadata. Public results need reviewable artifacts or reproducible source; private artifact paths are not evidence readers can inspect. Preview images should use fictional or approved content. Preserve required third-party licenses and attribution.

## Add Or Change A Skill

1. Keep the canonical path at `skills/<name>/SKILL.md`.
2. Include Agent Skills fields `name` and `description`, set `license: MIT`, and add repository catalog metadata for `display-name`, `summary`, `status`, and `areas`.
3. Use an `experimental`, `stable`, or `deprecated` status. Write areas as unique, comma-separated kebab-case values.
4. Add `skills/<name>/README.md` with `Install`, `Use`, `Compatibility`, and `Limitations` sections.
5. Bundle a copy of the root `LICENSE` and keep runtime resources inside the skill directory with direct links from `SKILL.md`.
6. Add positive, negative, and ambiguous trigger cases under `evals/<name>/triggers.json`.
7. Add at least five behavioral cases with expected behavior and anti-patterns under `evals/<name>/evals.json`. Each case needs a distinct name and prompt; near-duplicates fail the check.
8. Record each claimed host in the per-skill [compatibility matrix](docs/compatibility.md). Each claim column takes `Yes`, `No`, `Not yet`, or `Unverified`, one row per skill and host. A smoke claim reads ``Yes (`bun run <script>`)`` and the script must exist in `package.json`. Use `Unverified` instead of implying untested support.
9. Add the skill to the `skills` array in `.claude-plugin/plugin.json` so the Claude Code plugin ships the same set as the catalog.
10. Run `bun run generate:catalog` after metadata changes.
11. Run `bun run check`.
12. Confirm the installer discovers the skill with `npx skills add . --list`, and the frontmatter with `npx skills-ref validate ./skills/<name>`. Repository checks validate this project's schema, not the installer's or the specification's.
13. Run the smoke command for any host whose row claims one, currently `bun run smoke:opencode`, `bun run smoke:agy`, and `bun run smoke:claude-code`. They need that host installed, so `bun run check` cannot run them.

Install the pinned development toolchain with `bun install --frozen-lockfile`. Portable skill bundles should not gain runtime package dependencies without a concrete need. Adapter dependencies and installation logic must remain isolated from portable skill bundles.

Do not add dependencies, host adapters, generated instruction copies, or release tooling without demonstrating the maintenance problem they solve.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, and `perf:`. Keep each commit focused on one concern. Use the same form for pull request titles: `<type>(<optional-kebab-scope>): <imperative lower-case subject>`. Pull request titles have a 72-character limit, no consecutive spaces, and no trailing punctuation.

See [compatibility](docs/compatibility.md), [maintenance](docs/maintenance.md), and [releases](docs/releases.md) for support and versioning policy.
