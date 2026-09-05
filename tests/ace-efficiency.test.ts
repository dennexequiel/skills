import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  parseUsage,
  parseEfficiencyRecord,
  restoreFixtureNames,
  summarizeEfficiency,
  type EfficiencyRecord,
  type Usage,
} from "../scripts/ace-efficiency"

test("restores staged fixture suffixes and leaves existing test names intact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ace-efficiency-"))
  try {
    const nested = join(directory, "nested")
    await mkdir(nested)
    await writeFile(join(nested, "renamed.test.mjs.fixture"), "renamed")
    await writeFile(join(nested, "existing.test.mjs"), "existing")
    await restoreFixtureNames(directory)
    expect(await readFile(join(nested, "renamed.test.mjs"), "utf8")).toBe("renamed")
    expect(await readFile(join(nested, "existing.test.mjs"), "utf8")).toBe("existing")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("normalizes Codex cache-inclusive input without double counting subsets", () => {
  const result = parseUsage([
    { type: "item.started", item: { id: "c1", type: "command_execution", command: "bun test" } },
    { type: "item.completed", item: { id: "c1", type: "command_execution", command: "bun test" } },
    { type: "item.completed", item: { id: "c2", type: "command_execution", command: "bun test" } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 60, output_tokens: 10, output_tokens_details: { reasoning_tokens: 4 } } },
    { type: "turn.completed", usage: { input_tokens: 200, cached_input_tokens: 100, output_tokens: 20, output_tokens_details: { reasoning_tokens: 8 } } },
  ].map((item) => JSON.stringify(item)).join("\n"), "codex-jsonl")
  expect(result.inputTokens).toBe(300)
  expect(result.cachedInputTokens).toBe(160)
  expect(result.outputTokens).toBe(30)
  expect(result.reasoningTokens).toBe(12)
  expect(result.reportedCostUSD).toBeNull()
  expect(result.toolCalls).toBe(2)
  expect(result.repeatedToolCalls).toBe(1)
  expect(result.rawProviderUsage).toHaveLength(2)
})

test("uses Claude's aggregate result once and includes its separate cache buckets", () => {
  const result = parseUsage([
    { type: "assistant", message: { model: "claude-fixture", usage: { input_tokens: 999 }, content: [{ type: "tool_use", id: "a", name: "Read", input: { file_path: "mission.md" } }] } },
    { type: "result", is_error: false, usage: { input_tokens: 100, cache_read_input_tokens: 200, cache_creation_input_tokens: 50, output_tokens: 30 }, total_cost_usd: 0.1 },
  ].map((item) => JSON.stringify(item)).join("\n"), "claude-jsonl")
  expect(result.inputTokens).toBe(350)
  expect(result.outputTokens).toBe(30)
  expect(result.cachedInputTokens).toBe(200)
  expect(result.cacheWriteTokens).toBe(50)
  expect(result.reportedCostUSD).toBe(0.1)
  expect(result.costBasis).toBe("host-estimate")
  expect(result.models).toEqual(["claude-fixture"])
  expect(result.toolCalls).toBe(1)
})

test("retains native Codex cache writes and reasoning without adding token subsets", () => {
  const nativeUsage = {
    input_tokens: 153660,
    cached_input_tokens: 141568,
    cache_write_input_tokens: 0,
    output_tokens: 2681,
    reasoning_output_tokens: 313,
  }
  const completed = { type: "turn.completed", usage: nativeUsage }
  const result = parseUsage(JSON.stringify(completed), "codex-jsonl")
  expect(result.inputTokens).toBe(153660)
  expect(result.outputTokens).toBe(2681)
  expect(result.cacheWriteTokens).toBe(0)
  expect(result.reasoningTokens).toBe(313)
  const partial = parseUsage([
    completed,
    { type: "turn.completed", usage: { input_tokens: 20, output_tokens: 10 } },
  ].map((event) => JSON.stringify(event)).join("\n"), "codex-jsonl")
  expect(partial.inputTokens).toBe(153680)
  expect(partial.cacheWriteTokens).toBeNull()
  expect(partial.reasoningTokens).toBeNull()
})

test("includes reported Claude helper models without adding the main aggregate again", () => {
  const event = {
    type: "result", is_error: false, total_cost_usd: 0.12,
    usage: { input_tokens: 10, cache_read_input_tokens: 200, cache_creation_input_tokens: 50, output_tokens: 30, output_tokens_details: { thinking_tokens: 12 } },
    modelUsage: {
      main: { inputTokens: 10, cacheReadInputTokens: 200, cacheCreationInputTokens: 50, outputTokens: 30 },
      helper: { inputTokens: 7, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 2 },
    },
    permission_denials: [{ tool_name: "Bash" }],
  }
  const result = parseUsage(JSON.stringify(event), "claude-jsonl")
  expect(result.inputTokens).toBe(267)
  expect(result.outputTokens).toBe(32)
  expect(result.reasoningTokens).toBeNull()
  expect(result.extensions.primaryModelReasoningTokens).toBe(12)
  expect(result.extensions.permissionDenials).toBe(1)
  expect(result.models).toEqual(["helper", "main"])
  const incomplete = parseUsage(JSON.stringify({ ...event, modelUsage: { main: event.modelUsage.main, helper: {} } }), "claude-jsonl")
  expect(incomplete.inputTokens).toBeNull()
  expect(incomplete.outputTokens).toBeNull()
})

test("retains unavailable metrics and rejects malformed normalized values", () => {
  const missing = parseUsage("no native result", "codex-jsonl")
  expect(missing.inputTokens).toBeNull()
  expect(missing.terminalEvent).toBe(false)

  const normalized = parseUsage(JSON.stringify({
    models: ["other-model"],
    terminalEvent: true,
    hostError: false,
    providerField: { exact: true },
  }), "normalized-json")
  expect(normalized.inputTokens).toBeNull()
  expect(normalized.toolCalls).toBeNull()
  expect(normalized.extensions).toEqual({ providerField: { exact: true } })
  expect(() => parseUsage(JSON.stringify({
    models: [],
    terminalEvent: true,
    hostError: false,
    inputTokens: "unknown",
  }), "normalized-json")).toThrow("inputTokens")
})

function usage(overrides: Partial<Usage> = {}): Usage {
  return {
    inputTokens: 100,
    cachedInputTokens: 40,
    cacheWriteTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    reportedCostUSD: 1,
    costBasis: "host-estimate",
    models: ["resolved-model"],
    toolCalls: 2,
    repeatedToolCalls: 0,
    terminalEvent: true,
    hostError: false,
    rawProviderUsage: [],
    extensions: {},
    ...overrides,
  }
}

function record(overrides: Partial<EfficiencyRecord> = {}): EfficiencyRecord {
  return {
    id: "attempt",
    harness: "host",
    harnessVersion: "1.0",
    settings: "temperature=0",
    requestedModel: "requested-model",
    scenario: "csv",
    fixtureHash: "fixture-hash",
    skillHash: "skill-hash",
    arm: "with-ace",
    durationMs: 1000,
    artifactPassed: true,
    harnessSucceeded: true,
    handoffReview: "passed",
    usage: usage(),
    ...overrides,
  }
}

test("validates imported efficiency records before summarizing results", () => {
  expect(parseEfficiencyRecord(record())).toEqual(record())
  expect(() => parseEfficiencyRecord({ ...record(), artifactPassed: "true" })).toThrow(TypeError)
  expect(() => parseEfficiencyRecord({ ...record(), harnessSucceeded: "true" })).toThrow("harnessSucceeded")
  expect(() => parseEfficiencyRecord({ ...record(), handoffReview: "approved" })).toThrow("handoffReview")
  expect(() => parseEfficiencyRecord({ ...record(), usage: [] })).toThrow("attempt requires a usage object")
  expect(() => parseEfficiencyRecord({ ...record(), durationMs: -1 })).toThrow("durationMs")
  expect(() => parseEfficiencyRecord({ ...record(), usage: { ...usage(), models: "guessed" } })).toThrow("models")
})

test("charges failed attempts to verified successes without counting token subsets twice", () => {
  const summary = summarizeEfficiency([
    record(),
    record({
      id: "failed",
      artifactPassed: false,
      harnessSucceeded: false,
      handoffReview: "failed",
      usage: usage({ reportedCostUSD: 2 }),
    }),
  ])
  const totals = summary.cohorts[0]!.totals
  expect(totals.attempts).toBe(2)
  expect(totals.verifiedSuccesses).toBe(1)
  expect(totals.tokens.total).toBe(240)
  expect(totals.cost.total).toBe(3)
  expect(totals.cost.perVerifiedSuccess).toBe(3)
  expect(totals.cost).toMatchObject({ currency: "USD", basis: "host-estimate" })
})

test("propagates unavailable metrics and gates success on explicit manual review and host success", () => {
  const oldRecord = record({ id: "old-record" })
  delete oldRecord.harnessSucceeded
  const summary = summarizeEfficiency([
    record({ id: "unknown-cost", usage: usage({ inputTokens: null, reportedCostUSD: null, costBasis: "unavailable" }) }),
    record({ id: "pending", handoffReview: "pending" }),
    oldRecord,
  ])
  const totals = summary.cohorts[0]!.totals
  expect(totals.verifiedSuccesses).toBe(1)
  expect(totals.tokens.input).toBeNull()
  expect(totals.tokens.total).toBeNull()
  expect(totals.cost.total).toBeNull()
  expect(totals.cost.perVerifiedSuccess).toBeNull()
})

test("separates cohorts by harness, settings, model identities, fixture, and skill hashes", () => {
  const records = [
    record(),
    record({ id: "harness", harnessVersion: "2.0" }),
    record({ id: "settings", settings: "temperature=1" }),
    record({ id: "requested", requestedModel: "other-request" }),
    record({ id: "resolved", usage: usage({ models: ["other-resolution"] }) }),
    record({ id: "fixture", scenario: "cache" }),
    record({ id: "fixture-hash", fixtureHash: "other-fixture-hash" }),
    record({ id: "skill", skillHash: "other-skill-hash" }),
  ]
  expect(summarizeEfficiency(records).cohorts).toHaveLength(records.length)
})
