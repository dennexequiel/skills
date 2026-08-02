# Agent Skills

Reusable skills for coding agents. Each skill is independently installable and keeps its core instructions separate from optional host integrations.

## Skills

<!-- catalog:start -->
| Skill | Status | Areas | Purpose |
| --- | --- | --- | --- |
| [Ace](skills/ace/) | experimental | workflow, autonomy | Own a bounded mission through evidence-backed completion while preserving user judgment and authority. |
<!-- catalog:end -->

## Install A Skill

Choose a skill from the catalog and open its page for purpose, usage, compatibility, and exact installation guidance. Agent Skills-compatible clients can install a selected skill directly from this repository:

```sh
# Node.js
npx skills add dennexequiel/skills --skill <skill-name>

# Bun
bunx skills add dennexequiel/skills --skill <skill-name>
```

Use one package runner, not both. Host invocation and optional integrations vary by skill.

To install a selected skill globally for Claude Code without interactive prompts:

```sh
npx skills add dennexequiel/skills --skill <skill-name> --agent claude-code --global --yes
```

## Work On The Repository

Clone the repository to inspect, validate, or contribute to the collection:

```sh
git clone https://github.com/dennexequiel/skills.git
cd skills
bun install --frozen-lockfile
bun run check
```

Skills have no runtime package dependencies. Repository development uses pinned TypeScript and host API types. The full check validates TypeScript, skill metadata, bundle containment, references, routing fixtures, description collisions, generated catalog state, installer behavior, and behavioral contracts.

## Structure

```text
skills/<name>/SKILL.md       Portable instructions and discovery metadata
skills/<name>/references/    Detail loaded only when the task needs it
evals/<name>/                Behavioral scenarios and expected outcomes
adapters/<runtime>/          Runtime-specific commands, plugins, and install notes
scripts/                     Repository validation and local installers
```

The skill package is the source of truth. Adapters may implement capabilities such as durable state or automatic continuation, but may not weaken the skill's behavioral, safety, or verification guarantees.

Areas and lifecycle states are catalog metadata, not directories. Canonical skill paths stay flat and stable as the collection grows. See [maintenance](docs/maintenance.md) and [compatibility](docs/compatibility.md).

Releases use verified repository-wide SemVer tags without publishing an npm package. See [releases](docs/releases.md).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for the skill contract, required evaluations, and validation workflow. New skills stay at `skills/<name>/` so their install paths remain stable as the catalog grows.

## License

[MIT](LICENSE)
