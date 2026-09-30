# Prep That Doc Evaluations

`evals.json` contains portable agent scenarios with expected behavior and anti-patterns. These judge document meaning and author authority; substring matches alone cannot verify them.

`triggers.json` covers positive, negative, and ambiguous routing. Repository checks enforce coverage and exact prompt uniqueness. Live host/model behavior needs separate evidence.

The behavioral cases cover purpose, audience, destination, optional profiles and summaries, renderer compatibility, reference-style links, spacing, evidence status, artifact delivery, and separate coverage reporting. They also cover lossless restructuring, review versus fix authority, preserved operational sequence, qualified claims, untouched missing facts, default review, optional roast, focused work on short documents, and verification of actual edits.

The scanner tests exercise real Markdown inputs, profile policies, protected regions, configuration, Git discovery, stdin, versioned JSON, and process exit codes. Each registered detector needs a matching and a non-matching case. Generated rule documentation is checked against its source registry.

Behavioral success requires preserved meaning, authorized scope, proportional work and reporting, supported findings, and accurate verification claims. Judge operational meaning separately from source indentation; enforce byte identity where the task explicitly requires it. Keep unresolved document decisions separate from task completion. Unnecessary blockers, report padding, and claims inferred from uninspected artifacts count against the review even when its edits and arithmetic are correct.

Freeze criteria before each live evaluation, retain failures and incomplete attempts, and distinguish harness limits from document defects. Historical scores keep their original rubric; a revised rubric needs a separately labeled result. A perfect sample score establishes only that sample's applicable checks, not reliability across documents, models, or future runs.

Dated results identify the evaluated source snapshots and runtime versions. Counts and measurements describe those runs. Run `bun run check` for the current checkout; do not treat historical records as a benchmark of every later revision.

- [2026-09-06 evidence](results/2026-09-06.md) records the paired preservation exercise, native token usage, instruction footprint, and runtime checks.
- [Machine-readable measurements](results/2026-09-06.json) include exact fixture text, resulting documents, and source hashes.
- [2026-09-30 smaller-model comparison](results/2026-09-30-luna.md) records sixteen matched trials of the previous and updated skill, blind artifact grading, and observed preservation failures.
- [Smaller-model measurement record](results/2026-09-30-luna.json) contains exact inputs, outputs, reports, source snapshots by hash and diff, and per-criterion evidence.
- [2026-09-30 Claude comparison](results/2026-09-30-claude.md) records matched Opus and Sonnet trials, blind scores, completion limits, and reporting weaknesses.
- [Claude measurement record](results/2026-09-30-claude.json) contains artifacts, reports, sanitized tool traces, source hashes, grades, and excluded setup attempts.
- [2026-09-30 refinement evidence](results/2026-09-30-refinement.md) records nineteen follow-up trials, stricter behavioral criteria, targeted confirmation, and remaining failures.
- [Refinement measurement record](results/2026-09-30-refinement.json) contains both evaluated snapshots, exact artifacts, blind judgments, and separate runtime findings.
