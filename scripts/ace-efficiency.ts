import { createHash } from "node:crypto"
import { cp, mkdir, open, readFile, readdir, rename, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

type Json = Record<string, unknown>
export type UsageFormat = "codex-jsonl" | "claude-jsonl" | "normalized-json"
export type CostBasis = "host-estimate" | "unavailable"
export type HandoffReview = "pending" | "passed" | "failed"

/** Normalized accounting. Input and output totals include their reported subsets exactly once. */
export type Usage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  reportedCostUSD: number | null
  costBasis: CostBasis
  models: string[]
  toolCalls: number | null
  repeatedToolCalls: number | null
  terminalEvent: boolean
  hostError: boolean
  rawProviderUsage: unknown[]
  extensions: Record<string, unknown>
}

/** One measured attempt. Extra record fields remain valid provider or runner evidence. */
export type EfficiencyRecord = {
  id: string
  harness: string
  harnessVersion: string
  settings: string
  requestedModel: string
  scenario: string
  fixtureHash: string
  skillHash: string
  arm: string
  durationMs: number
  artifactPassed: boolean
  harnessSucceeded?: boolean
  handoffReview: HandoffReview
  usage: Usage
  [key: string]: unknown
}

export type CohortIdentity = {
  harness: string
  harnessVersion: string
  settings: string
  requestedModel: string
  resolvedModels: string[]
  fixture: string
  fixtureHash: string
  skillHash: string
}

export type AttemptSummary = {
  attempts: number
  artifactPasses: number
  harnessSuccesses: number
  verifiedSuccesses: number
  durationMs: number
  tokens: {
    input: number | null
    cachedInput: number | null
    cacheWrite: number | null
    output: number | null
    reasoning: number | null
    /** Input plus output. Cached input and reasoning are reported subsets, not additions. */
    total: number | null
  }
  cost: {
    currency: "USD"
    basis: "host-estimate"
    /** Includes every attempt in this summary, including unsuccessful attempts. */
    total: number | null
    perVerifiedSuccess: number | null
  }
}

export type EfficiencySummary = {
  version: 1
  cohorts: Array<{
    identity: CohortIdentity
    totals: AttemptSummary
    arms: Array<{ arm: string, totals: AttemptSummary }>
  }>
}

function object(value: unknown): Json {
  return isObject(value) ? value : {}
}

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizedCount(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  const result = count(value)
  if (result === null) throw new TypeError(`Normalized usage field ${field} must be a non-negative finite number or null`)
  return result
}

function plus(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right
}

function sumModelUsage(models: Json[], field: string): number | null {
  return models.reduce<number | null>((total, model) => plus(total, count(model[field])), 0)
}

const NORMALIZED_FIELDS = new Set([
  "inputTokens", "cachedInputTokens", "cacheWriteTokens", "outputTokens", "reasoningTokens",
  "reportedCostUSD", "costBasis", "models", "toolCalls", "repeatedToolCalls", "terminalEvent",
  "hostError", "rawProviderUsage", "extensions",
])

function parseNormalizedUsage(text: string): Usage {
  const parsed: unknown = JSON.parse(text)
  if (!isObject(parsed)) throw new TypeError("Normalized usage must be a JSON object")
  if (!Array.isArray(parsed.models) || !parsed.models.every((model) => typeof model === "string"))
    throw new TypeError("Normalized usage field models must be a string array")
  if (typeof parsed.terminalEvent !== "boolean") throw new TypeError("Normalized usage field terminalEvent must be boolean")
  if (typeof parsed.hostError !== "boolean") throw new TypeError("Normalized usage field hostError must be boolean")
  if (parsed.rawProviderUsage !== undefined && !Array.isArray(parsed.rawProviderUsage))
    throw new TypeError("Normalized usage field rawProviderUsage must be an array")
  if (parsed.extensions !== undefined && !isObject(parsed.extensions))
    throw new TypeError("Normalized usage field extensions must be an object")

  const reportedCostUSD = normalizedCount(parsed.reportedCostUSD, "reportedCostUSD")
  if (parsed.costBasis !== undefined && parsed.costBasis !== "host-estimate" && parsed.costBasis !== "unavailable")
    throw new TypeError("Normalized usage field costBasis is invalid")
  if (reportedCostUSD !== null && parsed.costBasis === "unavailable")
    throw new TypeError("Normalized usage cannot mark a reported cost unavailable")

  const extensions = { ...object(parsed.extensions) }
  for (const [key, value] of Object.entries(parsed)) if (!NORMALIZED_FIELDS.has(key)) extensions[key] = value
  return {
    inputTokens: normalizedCount(parsed.inputTokens, "inputTokens"),
    cachedInputTokens: normalizedCount(parsed.cachedInputTokens, "cachedInputTokens"),
    cacheWriteTokens: normalizedCount(parsed.cacheWriteTokens, "cacheWriteTokens"),
    outputTokens: normalizedCount(parsed.outputTokens, "outputTokens"),
    reasoningTokens: normalizedCount(parsed.reasoningTokens, "reasoningTokens"),
    reportedCostUSD,
    costBasis: reportedCostUSD === null ? "unavailable" : "host-estimate",
    models: [...new Set(parsed.models)].filter((model) => model !== "<synthetic>").sort(),
    toolCalls: normalizedCount(parsed.toolCalls, "toolCalls"),
    repeatedToolCalls: normalizedCount(parsed.repeatedToolCalls, "repeatedToolCalls"),
    terminalEvent: parsed.terminalEvent,
    hostError: parsed.hostError,
    rawProviderUsage: parsed.rawProviderUsage === undefined ? [] : [...parsed.rawProviderUsage],
    extensions,
  }
}

export function parseUsage(text: string, format: UsageFormat): Usage {
  if (format === "normalized-json") return parseNormalizedUsage(text)
  const events = text.split(/\r?\n/).flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line)
      return isObject(parsed) ? [parsed] : []
    } catch { return [] }
  })
  const result: Usage = {
    inputTokens: null, cachedInputTokens: null, cacheWriteTokens: null,
    outputTokens: null, reasoningTokens: null, reportedCostUSD: null,
    costBasis: "unavailable", models: [], toolCalls: 0, repeatedToolCalls: 0,
    terminalEvent: false, hostError: false, rawProviderUsage: [], extensions: {},
  }
  const calls = new Map<string, string>()
  for (const event of events) {
    if (format === "codex-jsonl") {
      if (event.type === "turn.failed" || event.type === "error") result.hostError = true
      if (event.type === "turn.completed") {
        const usage = object(event.usage)
        if (Object.hasOwn(event, "usage")) result.rawProviderUsage.push(event.usage)
        const input = count(usage.input_tokens)
        const output = count(usage.output_tokens)
        const cached = count(usage.cached_input_tokens)
        const written = count(usage.cache_write_input_tokens)
        const reasoning = count(usage.reasoning_output_tokens ?? object(usage.output_tokens_details).reasoning_tokens)
        result.inputTokens = result.terminalEvent ? plus(result.inputTokens, input) : input
        result.outputTokens = result.terminalEvent ? plus(result.outputTokens, output) : output
        result.cachedInputTokens = result.terminalEvent ? plus(result.cachedInputTokens, cached) : cached
        result.cacheWriteTokens = result.terminalEvent ? plus(result.cacheWriteTokens, written) : written
        result.reasoningTokens = result.terminalEvent ? plus(result.reasoningTokens, reasoning) : reasoning
        result.terminalEvent = true
      }
      if (typeof event.model === "string") result.models.push(event.model)
      const item = object(event.item)
      if (event.type === "item.completed" && typeof item.id === "string" && ["command_execution", "file_change", "mcp_tool_call", "collab_tool_call"].includes(String(item.type)))
        calls.set(item.id, JSON.stringify([item.type, item.command ?? item.changes ?? item.arguments]))
    }
    if (format === "claude-jsonl") {
      const message = object(event.message)
      if (typeof message.model === "string") result.models.push(message.model)
      if (Array.isArray(message.content)) for (const block of message.content) {
        const item = object(block)
        if (item.type === "tool_use" && typeof item.id === "string")
          calls.set(item.id, JSON.stringify([item.name, item.input]))
      }
      if (event.type === "result") {
        const usage = object(event.usage)
        if (Object.hasOwn(event, "usage")) result.rawProviderUsage.push(event.usage)
        const modelUsage = object(event.modelUsage)
        const models = Object.values(modelUsage).map(object)
        const cached = models.length ? sumModelUsage(models, "cacheReadInputTokens") : count(usage.cache_read_input_tokens)
        const written = models.length ? sumModelUsage(models, "cacheCreationInputTokens") : count(usage.cache_creation_input_tokens)
        const ordinary = models.length ? sumModelUsage(models, "inputTokens") : count(usage.input_tokens)
        result.inputTokens = plus(plus(ordinary, cached), written)
        result.cachedInputTokens = cached
        result.cacheWriteTokens = written
        result.outputTokens = models.length ? sumModelUsage(models, "outputTokens") : count(usage.output_tokens)
        const thinking = count(object(usage.output_tokens_details).thinking_tokens)
        result.reasoningTokens = models.length > 1 ? null : thinking
        result.extensions.primaryModelReasoningTokens = thinking
        result.extensions.modelUsage = modelUsage
        result.extensions.usageScope = models.length ? "all-reported-models" : "session-result"
        result.extensions.permissionDenials = Array.isArray(event.permission_denials) ? event.permission_denials.length : null
        result.reportedCostUSD = count(event.total_cost_usd)
        result.models.push(...Object.keys(object(event.modelUsage)))
        result.terminalEvent = true
        result.hostError = event.is_error === true
      }
    }
  }
  result.models = [...new Set(result.models)].filter((model) => model !== "<synthetic>").sort()
  if (result.reportedCostUSD !== null) result.costBasis = "host-estimate"
  result.toolCalls = calls.size
  result.repeatedToolCalls = calls.size - new Set(calls.values()).size
  return result
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`Expected a nonempty string for ${field}`)
  return value
}

export function parseEfficiencyRecord(value: unknown): EfficiencyRecord {
  if (!isObject(value)) throw new TypeError("Efficiency record must be an object")
  const id = requiredString(value.id, "record.id")
  const durationMs = count(value.durationMs)
  if (durationMs === null) throw new TypeError(`Efficiency record ${id} requires a non-negative finite durationMs`)
  if (typeof value.artifactPassed !== "boolean") throw new TypeError(`Efficiency record ${id} requires boolean artifactPassed`)
  if (value.harnessSucceeded !== undefined && typeof value.harnessSucceeded !== "boolean")
    throw new TypeError(`Efficiency record ${id} requires boolean harnessSucceeded when present`)
  const handoffReview = value.handoffReview
  if (handoffReview !== "pending" && handoffReview !== "passed" && handoffReview !== "failed")
    throw new TypeError(`Efficiency record ${id} has invalid handoffReview`)
  if (!isObject(value.usage)) throw new TypeError(`Efficiency record ${id} requires a usage object`)
  const { harnessSucceeded, ...fields } = value
  return {
    ...fields,
    id,
    harness: requiredString(value.harness, `${id}.harness`),
    harnessVersion: requiredString(value.harnessVersion, `${id}.harnessVersion`),
    settings: requiredString(value.settings, `${id}.settings`),
    requestedModel: requiredString(value.requestedModel, `${id}.requestedModel`),
    scenario: requiredString(value.scenario, `${id}.scenario`),
    fixtureHash: requiredString(value.fixtureHash, `${id}.fixtureHash`),
    skillHash: requiredString(value.skillHash, `${id}.skillHash`),
    arm: requiredString(value.arm, `${id}.arm`),
    durationMs,
    artifactPassed: value.artifactPassed,
    ...(harnessSucceeded === undefined ? {} : { harnessSucceeded }),
    handoffReview,
    usage: parseNormalizedUsage(JSON.stringify(value.usage)),
  }
}

function summaryCount(records: readonly EfficiencyRecord[], select: (record: EfficiencyRecord) => unknown): number | null {
  let total = 0
  for (const record of records) {
    const value = select(record)
    if (value === null || value === undefined) return null
    const measured = count(value)
    if (measured === null) throw new TypeError(`Efficiency record ${record.id} contains an invalid metric`)
    total += measured
  }
  return total
}

function summarizeAttempts(records: readonly EfficiencyRecord[]): AttemptSummary {
  const input = summaryCount(records, (record) => record.usage.inputTokens)
  const output = summaryCount(records, (record) => record.usage.outputTokens)
  const cost = summaryCount(records, (record) => record.usage.reportedCostUSD)
  const verifiedSuccesses = records.filter((record) =>
    record.artifactPassed === true && record.harnessSucceeded === true && record.handoffReview === "passed"
  ).length
  return {
    attempts: records.length,
    artifactPasses: records.filter((record) => record.artifactPassed === true).length,
    harnessSuccesses: records.filter((record) => record.harnessSucceeded === true).length,
    verifiedSuccesses,
    durationMs: records.reduce((total, record) => total + record.durationMs, 0),
    tokens: {
      input,
      cachedInput: summaryCount(records, (record) => record.usage.cachedInputTokens),
      cacheWrite: summaryCount(records, (record) => record.usage.cacheWriteTokens),
      output,
      reasoning: summaryCount(records, (record) => record.usage.reasoningTokens),
      total: plus(input, output),
    },
    cost: {
      currency: "USD",
      basis: "host-estimate",
      total: cost,
      perVerifiedSuccess: cost === null || verifiedSuccesses === 0 ? null : cost / verifiedSuccesses,
    },
  }
}

function cohortIdentity(record: EfficiencyRecord): CohortIdentity {
  if (!Array.isArray(record.usage.models) || !record.usage.models.every((model) => typeof model === "string"))
    throw new TypeError(`Efficiency record ${record.id} requires resolved model identities`)
  return {
    harness: requiredString(record.harness, "harness"),
    harnessVersion: requiredString(record.harnessVersion, "harnessVersion"),
    settings: requiredString(record.settings, "settings"),
    requestedModel: requiredString(record.requestedModel, "requestedModel"),
    resolvedModels: [...record.usage.models].sort(),
    fixture: requiredString(record.scenario, "scenario"),
    fixtureHash: requiredString(record.fixtureHash, "fixtureHash"),
    skillHash: requiredString(record.skillHash, "skillHash"),
  }
}

/** Groups comparable attempts and computes strict, null-propagating aggregate metrics. */
export function summarizeEfficiency(records: readonly EfficiencyRecord[]): EfficiencySummary {
  const groups = new Map<string, { identity: CohortIdentity, records: EfficiencyRecord[] }>()
  for (const record of records) {
    if (!Number.isFinite(record.durationMs) || record.durationMs < 0) throw new TypeError(`Efficiency record ${record.id} has invalid durationMs`)
    const identity = cohortIdentity(record)
    const key = JSON.stringify(identity)
    const group = groups.get(key) ?? { identity, records: [] }
    group.records.push(record)
    groups.set(key, group)
  }
  return {
    version: 1,
    cohorts: [...groups.values()].sort((left, right) => JSON.stringify(left.identity).localeCompare(JSON.stringify(right.identity))).map((group) => {
      const arms = new Map<string, EfficiencyRecord[]>()
      for (const record of group.records) {
        const arm = requiredString(record.arm, "arm")
        arms.set(arm, [...(arms.get(arm) ?? []), record])
      }
      return {
        identity: group.identity,
        totals: summarizeAttempts(group.records),
        arms: [...arms].sort(([left], [right]) => left.localeCompare(right)).map(([arm, armRecords]) => ({ arm, totals: summarizeAttempts(armRecords) })),
      }
    }),
  }
}

type Config = {
  harness: string
  model: string
  settings: string
  format: UsageFormat
  command: string[]
  versionCommand: string[]
}

function config(value: unknown): Config {
  const item = object(value)
  const format = item.format
  if (format !== "codex-jsonl" && format !== "claude-jsonl" && format !== "normalized-json")
    throw new TypeError("Configuration requires a supported usage format")
  return {
    harness: requiredString(item.harness, "configuration.harness"),
    model: requiredString(item.model, "configuration.model"),
    settings: requiredString(item.settings, "configuration.settings"),
    format,
    command: argumentArray(item.command, "command"),
    versionCommand: argumentArray(item.versionCommand, "versionCommand"),
  }
}

function argumentArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((part) => typeof part === "string"))
    throw new TypeError(`Configuration requires a nonempty ${field} argument array`)
  return value
}

async function hashTree(directory: string): Promise<string> {
  const hash = createHash("sha256")
  async function walk(path: string, prefix = ""): Promise<void> {
    for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${prefix}${item.name}`
      if (item.isDirectory()) await walk(join(path, item.name), `${name}/`)
      else hash.update(name).update("\0").update(await readFile(join(path, item.name))).update("\0")
    }
  }
  await walk(directory)
  return hash.digest("hex")
}

/** Restores staged files whose repository-safe name ends in .fixture. */
export async function restoreFixtureNames(directory: string): Promise<void> {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) await restoreFixtureNames(path)
    else if (item.name.endsWith(".fixture")) await rename(path, path.slice(0, -".fixture".length))
  }
}

const RUN_LIMIT_MS = 180_000
const TERMINATION_GRACE_MS = 2_000
const MAX_REPETITIONS = 5
type CapturePaths = { stdout: string, stderr: string }

async function capture(stream: ReadableStream<Uint8Array>, path?: string): Promise<string> {
  const handle = path === undefined ? undefined : await open(path, "w")
  const chunks: Uint8Array[] = []
  try {
    for await (const chunk of stream) {
      chunks.push(chunk)
      if (handle !== undefined) await handle.write(chunk)
    }
  } finally {
    await handle?.close()
  }
  return Buffer.concat(chunks).toString()
}

async function run(command: string[], cwd: string, input?: string, paths?: CapturePaths) {
  const started = Date.now()
  const child = Bun.spawn(command, { cwd, stdin: input === undefined ? "ignore" : new Blob([input]), stdout: "pipe", stderr: "pipe" })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM") }, RUN_LIMIT_MS - TERMINATION_GRACE_MS)
  const killTimer = setTimeout(() => { timedOut = true; child.kill("SIGKILL") }, RUN_LIMIT_MS)
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      capture(child.stdout, paths?.stdout),
      capture(child.stderr, paths?.stderr),
    ])
    return { exitCode, stdout, stderr, timedOut, durationMs: Date.now() - started }
  } finally { clearTimeout(timer); clearTimeout(killTimer) }
}

const GRADES: Record<string, string> = {
  csv: `import { strict as a } from "node:assert"; import { formatRow } from "./format.mjs";
a.equal(formatRow(["a,b", 'say "hi"', "a\\rb", "a\\nb", "", "界"]), '"a,b","say ""hi""","a\\rb","a\\nb",,界');
a.equal(formatRow([]), ""); a.equal(formatRow([0, false, "plain"]), "0,false,plain");`,
  cache: `import { strict as a } from "node:assert"; import { createCache } from "./cache.mjs";
let t=0; const c=createCache(10,()=>t); c.set("a", false); t=9; a.equal(c.get("a"),false); t=10; a.equal(c.get("a"),undefined);
c.set("a",0); t=15; c.set("a",""); t=20; a.equal(c.get("a"),""); t=25; a.equal(c.get("a"),undefined);
const z=createCache(0,()=>t); z.set("a",1); a.equal(z.get("a"),undefined); a.equal(c.get("missing"),undefined);`,
}

async function runExperiments(configPath: string, outputPath: string, repeatsText: string): Promise<void> {
  const settings = config(JSON.parse(await readFile(configPath, "utf8")))
  const repeats = Number(repeatsText)
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > MAX_REPETITIONS) throw new RangeError(`Repeats must be between 1 and ${MAX_REPETITIONS}`)
  const root = resolve(import.meta.dir, "..")
  const output = resolve(outputPath)
  await mkdir(output)
  await writeFile(join(output, ".gitignore"), "*\n")
  const snapshots = join(output, "snapshots")
  await mkdir(snapshots)
  const skillPath = join(snapshots, "ace")
  await cp(join(root, "skills/ace"), skillPath, { recursive: true })
  await cp(join(root, "evals/ace/efficiency/fixtures"), join(snapshots, "fixtures"), { recursive: true })
  const skillHash = await hashTree(skillPath)
  const version = await run(settings.versionCommand, root)
  if (version.exitCode !== 0) throw new Error(`Could not identify harness version: ${version.stderr}`)
  const records: EfficiencyRecord[] = []
  for (let repetition = 1; repetition <= repeats; repetition++) for (const scenario of Object.keys(GRADES)) {
    const arms = repetition % 2 === 1 ? ["without-ace", "with-ace"] : ["with-ace", "without-ace"]
    for (const arm of arms) {
      const id = `${scenario}-${repetition}-${arm}`
      const artifactDir = join(output, id)
      const workspace = join(artifactDir, "workspace")
      await mkdir(artifactDir)
      const fixture = join(snapshots, "fixtures", scenario)
      await cp(fixture, workspace, { recursive: true })
      await restoreFixtureNames(workspace)
      await cp(skillPath, join(workspace, ".eval/ace"), { recursive: true })
      const testName = `${scenario === "csv" ? "format" : "cache"}.test.mjs`
      const originalTest = await readFile(join(workspace, testName), "utf8")
      const task = scenario === "csv"
        ? "Resume mission.md. I authorize three minutes of local work. Verify the current formatter. I accept C2, external vendor ingestion, as an unverified follow-up for the final local implementation. Record this as user decision U2."
        : "Complete the bounded cache mission in mission.md. Verify exact expiration and overwrite behavior against the final implementation."
      const prompt = `${task}\nPreserve constraints and existing tests. Do not delegate, install, access the network, or write outside this workspace. Update mission.md with the verified outcome, remaining limitations, and execution accounting.\n${arm === "with-ace" ? "Use the portable Ace skill at .eval/ace/SKILL.md and only the references you need." : "Perform this task without loading Ace or any workflow skill, including .eval/ace."}\n`
      await writeFile(join(artifactDir, "prompt.txt"), prompt)
      console.log(`Running ${settings.harness} ${id}`)
      const execution = await run(settings.command, workspace, prompt, {
        stdout: join(artifactDir, "stdout.jsonl"),
        stderr: join(artifactDir, "stderr.txt"),
      })
      const usage = parseUsage(execution.stdout, settings.format)
      const grade = await run(["bun", "--eval", GRADES[scenario]!], workspace)
      const tests = await run(["bun", "test"], workspace)
      const testFile = await readFile(join(workspace, testName), "utf8")
      const mission = await readFile(join(workspace, "mission.md"), "utf8")
      const passed = grade.exitCode === 0 && tests.exitCode === 0 && testFile.includes(originalTest.trim())
      const harnessSucceeded = execution.exitCode === 0 && !execution.timedOut && usage.terminalEvent && !usage.hostError
      const record: EfficiencyRecord = { id, harness: settings.harness, harnessVersion: version.stdout.trim(), requestedModel: settings.model,
        settings: settings.settings, scenario, repetition, arm, skillHash, fixtureHash: await hashTree(fixture),
        durationMs: execution.durationMs, exitCode: execution.exitCode, timedOut: execution.timedOut,
        artifactPassed: passed, harnessSucceeded, handoffReview: "pending", subagentPolicy: "disabled", usage,
        missionBytes: Buffer.byteLength(mission), stdoutHash: createHash("sha256").update(execution.stdout).digest("hex") }
      records.push(record)
      await writeFile(join(artifactDir, "verification.txt"), `${grade.stdout}\n${grade.stderr}\n${tests.stdout}\n${tests.stderr}`)
      await writeFile(join(output, "results.json"), JSON.stringify({ version: 1, configuration: settings, records }, null, 2) + "\n")
      console.log(JSON.stringify(record))
    }
  }
}

async function main(): Promise<void> {
  const [first, second, repeatsText = "1"] = process.argv.slice(2)
  if (first === "summary") {
    if (!second) throw new Error("Usage: bun scripts/ace-efficiency.ts summary <results.json>")
    const source: unknown = JSON.parse(await readFile(second, "utf8"))
    if (!isObject(source) || !Array.isArray(source.records)) throw new TypeError("Results file requires a records array")
    console.log(JSON.stringify(summarizeEfficiency(source.records.map(parseEfficiencyRecord)), null, 2))
    return
  }
  if (!first || !second) throw new Error("Usage: bun scripts/ace-efficiency.ts <harness-config.json> <new-output-directory> [repeats=1]")
  await runExperiments(first, second, repeatsText)
}

if (import.meta.main) await main()
