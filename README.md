# Agent Skills

[![skills.sh](https://skills.sh/b/dennexequiel/skills)](https://skills.sh/dennexequiel/skills)

Agent skills that come with receipts. No skill here asks you to take its word.

Most agent skills are a prompt in a folder. These ship with behavior evaluations, routing fixtures that test both sides of the activation boundary, and a validation suite that fails the build when a skill drifts from its contract. Each one states when it should not activate, and none of them let an agent claim success without evidence.

Every skill is independently installable and keeps its portable instructions separate from optional host integrations.

## Skills

<!-- catalog:start -->
| Skill | Status | Areas | Purpose |
| --- | --- | --- | --- |
| [Ace](skills/ace/) | experimental | workflow, autonomy | Own a bounded mission through evidence-backed completion while preserving user judgment and authority. |
| [Prep That Doc](skills/prep-that-doc/) | experimental | documentation, writing | Catch engineering markdown that names its own structure wrong, then fix it with evidence instead of vibes. |
<!-- catalog:end -->

## Install A Skill

Choose a skill from the catalog and open its page for purpose, usage, compatibility, and exact installation guidance. The `skills` CLI can install a selected skill for its supported clients:

```sh
# Node.js
npx skills add dennexequiel/skills --skill SKILL_NAME

# Bun
bunx skills add dennexequiel/skills --skill SKILL_NAME
```

Replace `SKILL_NAME` with a name from the catalog. Use one package runner, not both. Host invocation and optional integrations vary by skill.

To install a selected skill globally for Claude Code without interactive prompts:

```sh
npx skills add dennexequiel/skills --skill SKILL_NAME --agent claude-code --global --yes
```

Claude Code can also take the whole collection as a plugin, which tracks this repository instead of copying editable files into your project:

```text
/plugin marketplace add dennexequiel/skills
/plugin install dennexequiel-skills
```

Pick one route. Installing both leaves you with every skill twice.

## Work On The Repository

Clone the repository to inspect, validate, or contribute to the collection:

```sh
git clone https://github.com/dennexequiel/skills.git
cd skills
bun install --frozen-lockfile
bun run check
```

The current skill bundles have no runtime package dependencies. Repository development uses pinned TypeScript and host API types. The full check validates TypeScript, skill metadata, bundle containment, references, routing fixtures, description collisions, generated catalog state, installer behavior, behavioral-case schemas, and the contract clauses each skill publishes. No command runs a behavioral case against a live model.

## Structure

```text
skills/<name>/SKILL.md       Portable instructions and discovery metadata
skills/<name>/references/    Detail loaded only when the task needs it
skills/<name>/scripts/       Executables the skill ships to the user
evals/<name>/                Behavioral scenarios and expected outcomes
adapters/<runtime>/          Runtime-specific commands, plugins, and install notes
scripts/                     Repository validation, local installers, and host smoke checks
.claude-plugin/              Claude Code marketplace and plugin manifests
```

The skill package is the source of truth. Adapters may implement capabilities such as durable state or automatic continuation, but may not weaken the skill's behavioral, safety, or verification guarantees.

Areas and lifecycle states are catalog metadata, not directories. Canonical skill paths stay flat and stable as the collection grows. See [maintenance](docs/maintenance.md) and [compatibility](docs/compatibility.md).

Releases use verified repository-wide SemVer tags without publishing an npm package. See [releases](docs/releases.md).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for the skill contract, required evaluations, and validation workflow. New skills stay at `skills/<name>/` so their install paths remain stable as the catalog grows.

## License

This repository is licensed under the [MIT License](LICENSE). Each skill bundles a copy so standalone installations retain the applicable terms.
