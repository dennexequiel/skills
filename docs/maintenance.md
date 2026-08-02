# Maintenance

The repository optimizes for stable install paths, self-contained skills, small context footprints, and verification that scales with the catalog.

## Canonical Layout

Keep skills flat at `skills/<name>/`. Areas and lifecycle states belong in frontmatter metadata and the generated catalog. Moving a skill between subject areas must not change its install path.

Every skill is an independent package. Its runtime references, scripts, assets, and license stay inside its directory. Repository-level evaluations and authoring tools may remain outside because clients do not need them to run the skill.

## Lifecycle

Use one status:

- `experimental`: behavior or compatibility is still gathering evidence.
- `stable`: supported behavior has representative evals and smoke tests.
- `deprecated`: retained for migration, with a replacement or removal plan.

Do not move skills into status directories. Status changes should not break installation URLs.

## Versioning

The repository uses one version and immutable Git tags when releases begin. Installer content hashes identify the exact installed bundle. Persisted state schemas keep their own integer version because storage compatibility differs from release compatibility.

Do not add per-skill versions unless consumers can independently pin and update those skills. Add Changesets only when multiple contributors or packages create recurring release-note and version-coordination errors. Changesets is not a substitute for checking every version-bearing manifest.

## Generated Files

`catalog.json` and the README skill table are generated from `SKILL.md` frontmatter:

```sh
bun run generate:catalog
```

Do not edit generated catalog content manually. `bun run check` fails when it is stale.

All repository TypeScript uses the strict root `tsconfig.json`. Runtime adapters, scripts, and tests are typechecked together so shared contracts cannot drift behind transpile-only checks.

## Evaluation

Every skill needs:

- positive trigger prompts,
- negative trigger prompts,
- ambiguous routing cases,
- behavioral cases with expected behavior and anti-patterns,
- checks for every relative resource,
- a host smoke test before a compatibility claim advances.

Trigger tests and behavioral tests are distinct. Correct instructions do not help if a host never selects the skill, and correct selection does not prove the workflow succeeds.

Live model evals are intentionally optional until the catalog and release cadence justify their cost. When introduced, compare with-skill runs against no-skill baselines and record the host and model used.

## Review Cadence

Prefer stable principles and primary-source links over copied host documentation. Review compatibility claims when a host integration changes or a smoke test fails, not on a calendar alone. Remove obsolete alternatives instead of accumulating historical branches in the operative skill.
