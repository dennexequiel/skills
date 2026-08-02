# Agent Skills

Portable skills for coding agents. Each skill keeps its behavioral contract independent of a specific runtime. Optional adapters add persistence, commands, or event hooks without leaking those details into the core skill.

## Skills

<!-- catalog:start -->
| Skill | Status | Areas | Purpose |
| --- | --- | --- | --- |
| [Ace](skills/ace/) | experimental | workflow, autonomy | Own a bounded mission through evidence-backed completion while preserving user judgment and authority. |
<!-- catalog:end -->

## Structure

```text
skills/<name>/SKILL.md       Portable instructions and discovery metadata
skills/<name>/references/    Detail loaded only when the task needs it
evals/<name>/                Behavioral scenarios and expected outcomes
adapters/<runtime>/          Runtime-specific commands, plugins, and install notes
scripts/                     Repository validation and local installers
```

The portable skill is the source of truth. Adapters may implement capabilities such as durable state or automatic continuation, but may not weaken its scope, partnership, safety, or verification rules.

Areas and lifecycle states are catalog metadata, not directories. Canonical skill paths stay flat and stable as the collection grows. See [maintenance](docs/maintenance.md) and [compatibility](docs/compatibility.md).

Releases use verified repository-wide SemVer tags without publishing an npm package. See [releases](docs/releases.md).

## Install

Agent Skills-compatible clients can install a skill from this repository:

```sh
npx skills add dennexequiel/skills --skill ace
```

The OpenCode adapter can be installed from a local checkout:

```sh
bun run install:opencode
```

The installer does not overwrite existing Ace files unless passed `--force`. It installs the pinned OpenCode plugin package when absent and refuses a conflicting version for review.

## Verify

Skills have no runtime package dependencies. Repository development uses pinned TypeScript and host API types. With Bun installed:

```sh
bun install --frozen-lockfile
bun run check
```

This runs strict TypeScript checks, then validates YAML metadata, bundle containment, references, routing fixtures, description collisions, generated catalog state, installer behavior, and behavioral contracts.

## Add A Skill

1. Create `skills/<name>/SKILL.md` with `name`, `description`, `license`, and catalog metadata.
2. Keep the core instructions runtime-neutral and under 500 lines.
3. Keep every runtime reference, script, asset, and license inside the skill directory.
4. Add trigger and behavioral cases under `evals/<name>/`.
5. Run `bun run generate:catalog` after metadata changes.
6. Add an adapter only after meeting the documented integration gate.
7. Run `bun run check`.

## License

[MIT](LICENSE)
