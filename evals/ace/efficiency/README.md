# Ace Efficiency Evaluations

Measure resource use alongside independently verified outcomes. The portable skill has no dependency on a provider, tokenizer, usage API, or runtime adapter. Each evaluation identifies its harness, model, settings, and evidence coverage.

## Current Context

`tests/ace-context.test.ts` exercises the OpenCode current-state view and both recovery hooks with 1, 20, and 100 historical cycles. Current criteria, constraints, qualifications, and proof stay fixed while audit entries, retired criteria, superseded evidence, and historical execution windows grow.

The regression permits small growth from numeric counters and preserves arbitrarily long current constraints. Historical growth must remain in the explicit audit/full views. Byte counts measure payload growth; they are not token counts or a model-cost estimate.

Other adapters should test the same property through their native recovery mechanism. A harness without an adapter can use a current mission brief and a separate history file.

## Matched Runs

Run each fixture with and without Ace using the same harness configuration. The fixtures cover CSV field preservation with a user-accepted external follow-up, and exact cache expiration using an injected clock. Both arms receive the same task and constraints. Only the instruction to load Ace differs.

```sh
mkdir -p .local/ace-efficiency
# Save your private harness configuration as .local/ace-efficiency/harness.json.
bun scripts/ace-efficiency.ts .local/ace-efficiency/harness.json .local/ace-efficiency/run-01 2
```

The output directory must not exist. The optional repeat count defaults to one and is limited to five. Each repetition runs both fixtures and both arms. Arm order alternates between repetitions. Every model invocation has a three-minute process timeout; configure host token or cost caps in the command when supported.

The repository ignores `.local/` for private configuration and scratch work. Every generated run directory also contains a `.gitignore` covering its raw transcripts, workspaces, snapshots, and result configuration. Copy only reviewed, sanitized evidence into `evals/ace/results/`; reusable fixture inputs remain tracked.

The runner freezes skill and fixture snapshots, stages independent workspaces, supplies the prompt on stdin, preserves native output and artifacts, and runs independent behavior assertions plus the workspace's tests. Exact fixture test contents must survive; additional tests are permitted. Inspect the transcript and mission brief before accepting a result. An artifact pass alone is not a verified mission.

The checked-in fixtures carry a `.fixture` suffix on test files so deliberate failures are not part of the repository test suite. The runner materializes their ordinary test filenames inside each workspace.

## Harness Configuration

A configuration contains:

| Field | Meaning |
| --- | --- |
| `harness` | The harness name, such as `codex` or `claude-code`. Keep private launcher names out of shared results. |
| `model` | Requested model or an explicit statement that native events must resolve the default. |
| `settings` | Reasoning/effort, permissions, context, limits, and relevant host configuration. |
| `format` | `codex-jsonl`, `claude-jsonl`, or `normalized-json`. |
| `command` | Executable and arguments as an array. The task arrives on stdin. |
| `versionCommand` | Executable and arguments that identify the harness version. |

For example, a configured Claude CLI can use `["claude", "--print", "--output-format", "stream-json", "--verbose"]`. Keep private launchers and authentication details in local configuration. Before sharing results, redact those details and identify the redactions while preserving measurement settings and outcomes. The runner records the supplied configuration; it does not redact it automatically. Use the permissions and authentication appropriate to that environment. The runner does not disable host safeguards or install dependencies.

Any other harness can emit a normalized JSON object through a wrapper. The wrapper must invoke that harness and report its actual usage. It must not derive token counts from file sizes or present the configured model as an observed model.

## Usage Semantics

| Measure | Interpretation |
| --- | --- |
| `inputTokens` | All reported input, including cache reads and writes where the host exposes them. |
| `cachedInputTokens` | Cache-read subset of input. Do not add it to input again. |
| `cacheWriteTokens` | Cache-write subset of input, when reported. |
| `outputTokens` | Reported output total. |
| `reasoningTokens` | Reported reasoning subset of output, when available. Do not add it to output again. |
| `reportedCostUSD` | Host-reported USD estimate. It is not an authoritative invoice. |
| `models` | Model identifiers observed in native events, including host helper models when reported. |
| `toolCalls` | Distinct tool events observed by the parser. |
| `repeatedToolCalls` | Calls with identical captured arguments. Review whether the repetition was necessary. |

Unavailable usage or cost stays `null`. A missing terminal event means collection is incomplete. Codex input already includes cached input. Claude reports ordinary input, cache reads, and cache writes separately. When its result supplies per-model usage, the normalizer sums those disjoint model buckets, including host helpers, without adding the main-model aggregate again. Partial per-model records make totals unknown. Without per-model records it uses the session aggregate. Raw usage, primary-model reasoning, and permission-denial counts remain inspectable. Total reasoning stays unknown when helper reasoning is unreported.

These fixtures prohibit subagents to keep treatment exposure and accounting inspectable. In a delegated-work evaluation, collect all child usage and establish whether parent totals already include it. Missing child accounting makes total cost unknown. Host-managed helper-model usage belongs in the native aggregate when reported.

## Review And Comparison

Review each run against the same task rubric:

1. Independent assertions pass against the final implementation, and existing tests remain intact.
2. The brief accurately states proven criteria and unverified limitations. CSV closure preserves the explicit U2 qualification.
3. Commands, files, and side effects obey the task's constraints. The baseline does not load Ace; the treatment loads the staged skill.
4. Execution accounting distinguishes prior usage, the authorized window, measured duration, and incomplete history. Record omissions separately from artifact correctness.

Keep model/harness cohorts separate, including settings and fixture/skill identities. Report sample count, verified successes, failures, incomplete collection, token totals, host-reported cost, elapsed time, and tool calls. Include unsuccessful attempts in measured totals. Cost per verified success is total attempt cost divided by verified successes, and is unavailable when usage coverage or the success denominator is missing.

Evaluate quality before interpreting savings. A shorter incomplete run is not an efficiency improvement. A skill may cost more on a small task while improving recovery or qualification accuracy. Repeated runs, representative substantial missions, and matched settings are needed before claiming general savings. Do not choose a universal overhead percentage from one fixture.

Infrastructure failures remain in the run record. Identify startup, authentication, permission, and collection failures separately from task failures. Retain known costs and mark missing usage; do not silently retry until a favorable result appears.

Save a reviewed copy of `results.json` with `handoffReview` set to `passed` or `failed` and the review evidence attached. Then generate the cohort summary without model calls:

```sh
bun scripts/ace-efficiency.ts summary reviewed-results.json
```

Records without explicit host success and a passed handoff review cannot qualify as verified successes. Unknown-model attempts form separate cohorts; include them when reporting overall spend or incomplete collection. A cohort's cost does not establish the cost of attempts whose model or usage could not be resolved.

The [recorded efficiency run](../results/2026-09-05-efficiency.md) includes native usage from Codex and Claude Code, artifact checks, and review limitations.

## Sources

- [Claude Code programmatic execution](https://code.claude.com/docs/en/headless) describes structured results, work-context isolation, and CLI cost estimates.
- [Claude usage accounting](https://code.claude.com/docs/en/agent-sdk/cost-tracking) describes aggregate and per-model usage.
- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) describes cache accounting and its effect on cost.
