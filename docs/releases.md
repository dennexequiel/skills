# Releases

The repository uses one SemVer version and one GitHub release stream. The release workflow reads `version` from [package.json](../package.json). The version in the [plugin manifest](../.claude-plugin/plugin.json) must match; repository checks enforce that equality. Individual skills do not carry independent versions.

## Create A Release

1. Update `version` in both `package.json` and `.claude-plugin/plugin.json` through a reviewed change.
2. Run `bun install` if the lockfile needs metadata synchronization.
3. Check that skill documentation, evaluation references, installation guidance, and compatibility claims match the release contents.
4. Run `bun run check` and the host smoke commands recorded in the [compatibility matrix](compatibility.md#smoke-scope). Report unavailable checks explicitly; do not treat repository checks as host verification.
5. Merge the version change after required CI checks pass.
6. Start the `Release` workflow from the default branch and choose whether the release is a prerelease.
7. Verify that the workflow succeeds and that the published `v<version>` tag targets the intended commit, with matching package and plugin versions.

The workflow validates strict SemVer, installs the frozen lockfile, runs every repository check, refuses an existing tag, and creates `v<version>` plus generated GitHub release notes. It does not commit changes, publish npm packages, or modify the default branch.

Host smoke checks run separately from the release workflow. Their evidence is limited to the scope documented in the compatibility matrix; packaging acceptance does not prove model behavior.

The package remains private because it is a repository toolchain, not a runtime package. Skills are distributed from the Git repository through Agent Skills installers.

## Version Meaning

- Patch: corrections that preserve documented skill and adapter behavior.
- Minor: new skills, additive behavior, or new optional integrations.
- Major: incompatible skill contracts, install layout, adapter controls, or persisted-state migrations requiring user action.

During `0.x`, mark releases as prereleases unless the included skills and integrations meet their documented stable support level.

Do not add Changesets until concurrent contributions or multiple release artifacts create recurring coordination failures.
