# Prep That Doc Evaluations

`evals.json` contains portable agent scenarios with expected behavior and anti-patterns. These judge document meaning and author authority; substring matches alone cannot verify them.

`triggers.json` covers positive, negative, and ambiguous routing. Repository checks enforce coverage and exact prompt uniqueness. Live host/model behavior needs separate evidence.

The behavioral cases cover lossless restructuring, review versus fix authority, preserved operational sequence, qualified claims, untouched missing facts, default review, optional roast, focused work on short documents, and verification of actual edits.

The scanner tests exercise real Markdown inputs, profile policies, protected regions, configuration, Git discovery, stdin, versioned JSON, and process exit codes. Each registered detector needs a matching and a non-matching case. Generated rule documentation is checked against its source registry.

Dated results identify the evaluated source snapshots and runtime versions. Counts and measurements describe those runs. Run `bun run check` for the current checkout; do not treat historical records as a benchmark of every later revision.

- [2026-09-06 evidence](results/2026-09-06.md) records the paired preservation exercise, native token usage, instruction footprint, and runtime checks.
- [Machine-readable measurements](results/2026-09-06.json) include exact fixture text, resulting documents, and source hashes.
