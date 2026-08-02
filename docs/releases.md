# Releases

The repository uses one SemVer version and one GitHub release stream. Individual skills do not carry independent versions.

## Create A Release

1. Update `version` in `package.json` through a reviewed change on the default branch.
2. Run `bun install` if the lockfile needs metadata synchronization.
3. Run `bun run check`.
4. Merge the version change.
5. Start the `Release` workflow from the default branch.
6. Choose whether the release is a prerelease.

The workflow validates strict SemVer, installs the frozen lockfile, runs every repository check, refuses an existing tag, and creates `v<version>` plus generated GitHub release notes. It does not commit changes, publish npm packages, or modify the default branch.

The package remains private because it is a repository toolchain, not a runtime package. Skills are distributed from the Git repository through Agent Skills installers.

## Version Meaning

- Patch: corrections that preserve documented skill and adapter behavior.
- Minor: new skills, additive behavior, or new optional integrations.
- Major: incompatible skill contracts, install layout, adapter controls, or persisted-state migrations requiring user action.

During `0.x`, mark releases as prereleases unless the included skills and integrations meet their documented stable support level.

Do not add Changesets until concurrent contributions or multiple release artifacts create recurring coordination failures.
