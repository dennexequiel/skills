# Ace Efficiency Evidence

Routine OpenCode recovery is bounded by current mission complexity. The portable skill adds measurable overhead on the small fixtures in this exploratory run. Neither observation establishes general token savings.

## Recovery Payload

The native adapter source has SHA-256 `9fc5094dbadb7c0260a39d478528dc65d953b8b99920fbb519b7dd1c2974a1c0`. Its current-state view contains complete constraints, current criteria and qualifications, evidence, milestones, source identity, and budget totals. Audit history remains in explicit history views.

The regression fixture preserves deliberately long current constraints and an accepted qualification while increasing historical evidence, windows, retired criteria, and audit entries.

| Historical cycles | Full-state continuation equivalent | Current continuation | Compaction |
| ---: | ---: | ---: | ---: |
| 1 | 19,394 bytes | 18,374 bytes | 18,172 bytes |
| 20 | 44,240 bytes | 18,381 bytes | 18,179 bytes |
| 100 | 149,287 bytes | 18,387 bytes | 18,185 bytes |

From 1 to 100 historical cycles, the current continuation grows by 13 bytes. At 100 cycles it is about 88% smaller than the full-state equivalent. Current authorization text and qualifications survive exactly. These are deterministic byte measurements, not token or billing estimates. The native OpenCode smoke test also invokes the current adapter successfully.

## Portable Paired Runs

Two local tasks run with and without Ace in each harness. The CSV task includes a paused mission, a finite extension, and user decision U2 accepting unavailable vendor ingestion. The cache task requires exact expiry and overwrite behavior under an injected clock. The [protocol and fixtures](../efficiency/README.md) specify the common constraints.

| Harness | Configuration |
| --- | --- |
| Codex CLI 0.153.4 | Requested `gpt-5.6-sol`, medium reasoning, workspace-write, ephemeral sessions. The JSON stream does not expose a resolved model identifier. |
| Claude Code 2.1.236 | Medium effort, safe mode, fixed local tool allowlist, USD 0.75 host-estimated cap per invocation. Native usage identifies `claude-opus-5[1m]` and a `claude-haiku-4-5-20251001` helper. |

The private Claude launcher name is redacted from the command records. Harness versions, invocation options, model identities, and measurements are retained.

All eight staged operative instruction trees have SHA-256 `8f227888916908f38a87a0840ecc9b48f26682b7c8dd928f24fdf7f6fbb523e6`. This hash covers `SKILL.md` and references with sorted paths and contents, excluding README and license files. The runner's original bundle hashes remain in the [measurement records](2026-09-05-efficiency.json). Some staged README content differs because documentation editing overlapped these initial runs; the operative instruction hashes match. The runner uses frozen snapshots for subsequent evaluations.

The fixture test files in these runs have ordinary `.test.mjs` names. Repository fixture copies carry an additional `.fixture` suffix to prevent deliberate failures from entering the root test suite. Staging restores the original filenames and contents.

### Measured Usage

Input includes cache reads and writes where reported. Output includes the reported output total; reasoning is not added again. Claude totals include the reported helper-model tokens. Cost is the host's estimate, not an invoice. Codex cost remains unknown.

| Harness | Task | Ace | Input tokens | Cached input | Output tokens | Host cost, USD | Wall time |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Codex | CSV | No | 153,660 | 141,568 | 2,681 | Unknown | 70.5 s |
| Codex | CSV | Yes | 295,616 | 259,200 | 4,504 | Unknown | 108.5 s |
| Codex | Cache | No | 133,940 | 122,368 | 2,476 | Unknown | 72.0 s |
| Codex | Cache | Yes | 258,331 | 223,232 | 4,320 | Unknown | 105.5 s |
| Claude Code | CSV | No | 74,813 | 61,903 | 3,844 | 0.246805 | 54.3 s |
| Claude Code | CSV | Yes | 177,835 | 162,860 | 4,875 | 0.343632 | 73.6 s |
| Claude Code | Cache | No | 76,244 | 66,966 | 4,709 | 0.234884 | 59.8 s |
| Claude Code | Cache | Yes | 127,265 | 111,766 | 5,228 | 0.332423 | 71.5 s |

Both arms produce implementations that pass the independent assertions and preserve existing tests. Ace uses more tokens and time in every pair. For Claude Code, the two Ace runs have roughly 40% higher combined host-estimated cost. This is observed overhead on two small tasks, not a general cost multiplier.

### Handoff Review

Review checks the actual artifacts and transcripts. It is retrospective and not blind. The table separates artifact correctness from mission accounting and factual handoff quality.

| Harness and task | Without Ace | With Ace |
| --- | --- | --- |
| Codex CSV | Correct local result and U2 qualification. Measured window duration absent. | Correct result, U2 qualification, measured interval, and explicit unknown startup/historical timing. |
| Codex Cache | Correct local result. Measured window duration absent. | Correct result, source hashes, and measured 71-second interval. |
| Claude Code CSV | Correct local result and U2 qualification. Measured window duration absent. | Correct result, U2 qualification, and measured 37-second interval. |
| Claude Code Cache | Correct local result. Measured window duration absent; inaccurate NaN limitation. | Correct local result. Measured window duration absent; the same inaccurate NaN limitation. |

Both Claude Code cache handoffs claim that a NaN time-to-live value makes reads miss. An independent runtime check returns the stored value. The requested cache behavior passes, but this additional claim is unsupported. The conservative full-mission review marks those handoffs failed. The no-Ace runs also lack measured execution-window duration. Three Ace handoffs pass the full review; this small, retrospective sample does not establish a quality advantage.

The Claude Code Ace runs encounter three permission denials in CSV and one in Cache. Neither baseline encounters a denial. Those attempts remain in usage and elapsed time. Identical tool arguments alone do not capture these retries; inspect permission events and the surrounding transcript before calling a repeated operation waste.

### Collection Limits

Each task has one paired run per harness, with the baseline first. There is no estimate of variance or control for cache warmth. The tasks are small enough that loading a mission skill is a meaningful fixed cost. They do not exercise a long production mission, and the portable runs do not install the OpenCode adapter. The adapter payload reduction and portable usage totals measure different mechanisms.

Initial sandboxed invocations cannot initialize Codex or access Claude Code authentication. Their failed records remain in the JSON. Claude reports zero usage for those authentication failures; Codex reports no usage, so its values stay unknown. The successful runs use the same bounded tasks with the required host access. Unknown-model startup failures form separate summary cohorts and must not disappear from collection accounting.

No task delegates work. The native Claude result includes a host helper, whose reported tokens and cost are counted. Claude aggregate reasoning and Codex pricing remain unknown. Codex reasoning and cache-write subsets follow its native usage records. The records preserve raw provider usage and transcript hashes; full transcripts and generated workspaces remain in the local evaluation output directories.

This evidence supports the current-context regression and a repeatable measurement process. It does not support advertising Ace as token-saving. A broader claim requires repeated substantial missions in each supported harness configuration, with comparable verified outcomes and complete usage collection.
