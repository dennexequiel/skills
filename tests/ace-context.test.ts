import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

type Measurement = {
  cycles: number
  continuationBytes: number
  legacyContinuationBytes: number
  compactionBytes: number
  currentBytes: number
  fullBytes: number
  current: Record<string, unknown>
  promptCurrent: Record<string, unknown>
  compactionCurrent: Record<string, unknown>
  fullHistoryCounts: {
    audit: number
    evidence: number
    retiredCriteria: number
    historicalWindows: number
  }
  auditHistoryCounts: { audit: number; evidence: number }
}

type ScenarioResult = {
  constraint: string
  qualification: string
  measurements: Measurement[]
}

function parseResult(value: unknown): ScenarioResult {
  if (!value || typeof value !== "object")
    throw new Error("Ace context scenario must return an object")
  const candidate = value as Partial<ScenarioResult>
  if (
    typeof candidate.constraint !== "string" ||
    typeof candidate.qualification !== "string" ||
    !Array.isArray(candidate.measurements)
  )
    throw new Error("Ace context scenario returned an invalid shape")
  return candidate as ScenarioResult
}

const CONTEXT_SCENARIO = String.raw`
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const fixedTime = Date.parse("2026-09-05T02:00:00.000Z")
const NativeDate = Date
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [fixedTime])) }
  static now() { return fixedTime }
}

const { AcePlugin } = await import("./adapters/opencode/plugin/ace.ts")
const stateDirectory = join(process.env.XDG_STATE_HOME, "opencode", "ace")
await mkdir(stateDirectory, { recursive: true })

const constraint = "Authorized boundary: " + "scope must remain portable across harnesses and models; ".repeat(140)
const qualification = "Accepted qualification: " + "the external owner retains the final deployment decision; ".repeat(110)
const source = {
  kind: "manual",
  value: "artifact-current",
  freshnessPolicy: "Compare the deterministic artifact identity before recording every proof.",
}
const decision = {
  decisionReference: "user-authorization-current",
  approver: "user",
  decidedAt: "2026-09-05T01:30:00.000Z",
}
const currentEvidence = [{
  id: "E-current",
  criterionIDs: ["C1"],
  method: "focused test",
  result: "passed",
  summary: "The current projection passes its focused test.",
  sourceIdentity: source.value,
  recordedAt: "2026-09-05T01:50:00.000Z",
  supersedes: [],
}]

const extract = (text, start, end) =>
  JSON.parse(text.slice(text.indexOf(start) + start.length, text.indexOf(end)))
const measurements = []
for (const cycles of [1, 20, 100]) {
  const sessionID = "context-" + cycles
  const historicalWindows = Array.from({ length: cycles }, (_, index) => ({
    id: "W-history-" + index,
    startedAt: new NativeDate(Date.parse("2026-09-04T00:00:00.000Z") + index * 60000).toISOString(),
    endedAt: new NativeDate(Date.parse("2026-09-04T00:01:00.000Z") + index * 60000).toISOString(),
    elapsedMilliseconds: 60000,
    maxMinutes: 60,
    maxContinuations: 100,
    automaticContinuations: 1,
    warningIssued: false,
    resumeDecision: { ...decision, decisionReference: "resume-" + index },
  }))
  const evidenceHistory = Array.from({ length: cycles }, (_, index) => ({
    id: "E-history-" + index,
    criterionIDs: ["C-retired-" + index],
    method: "historical test " + index,
    result: "superseded",
    summary: "Historical evidence " + index,
    sourceIdentity: "artifact-history-" + index,
    recordedAt: "2026-09-04T00:00:00.000Z",
    supersedes: [],
    invalidatedAt: "2026-09-04T00:01:00.000Z",
  }))
  const retiredCriteria = Array.from({ length: cycles }, (_, index) => ({
    id: "C-retired-" + index,
    text: "Historical criterion " + index,
    state: "verification-stale",
    evidenceIDs: [],
    reason: "Superseded by the current contract.",
  }))
  const audit = Array.from({ length: cycles }, (_, index) => ({
    id: "A" + (index + 1),
    type: "revision",
    recordedAt: "2026-09-04T00:00:00.000Z",
    summary: "Historical revision " + index,
    decision: { ...decision, decisionReference: "revision-" + index },
  }))
  const state = {
    version: 2,
    projectID: "context",
    sessionID,
    mode: "deliver",
    objective: "Keep routine recovery proportional to the complete current mission contract.",
    constraints: [constraint],
    verificationPlan: ["Exercise ace_status detail=current.", "Exercise both automatic recovery hooks."],
    criteria: [
      {
        id: "C1",
        text: "Routine recovery contains current proof.",
        state: "satisfied",
        evidenceIDs: ["E-current"],
        verifiedSourceIdentity: source.value,
        verifiedAt: "2026-09-05T01:50:00.000Z",
      },
      {
        id: "C2",
        text: "The current authorization exception remains explicit.",
        state: "accepted-exception",
        evidenceIDs: [],
        exception: {
          ...decision,
          limitation: qualification,
          sourceIdentity: source.value,
          criterionText: "The current authorization exception remains explicit.",
        },
      },
    ],
    retiredCriteria,
    milestones: [{
      id: "M1",
      outcome: "OpenCode current-state recovery is bounded by current complexity.",
      criterionIDs: ["C1", "C2"],
      fileScope: ["adapters/opencode/plugin/ace.ts", "tests/ace-context.test.ts"],
      verification: "Run the focused context test and strict typecheck.",
      dependsOn: [],
      reviewUnit: "One adapter projection and its focused regression test.",
      branchName: "feat/ace-stabilization",
      authorizationState: "User authorized adapter efficiency fixes before PR.",
      state: "active",
    }],
    deliveryPlanRequired: true,
    source,
    status: "active",
    executionWindows: [...historicalWindows, {
      id: "W-current",
      startedAt: "2026-09-05T01:59:00.000Z",
      elapsedMilliseconds: 15000,
      maxMinutes: 60,
      maxContinuations: 100,
      automaticContinuations: 3,
      warningIssued: false,
      resumeDecision: decision,
    }],
    lifetimeTimingComplete: false,
    automaticContinuationCount: cycles,
    iterationCount: cycles,
    lastProgressSourceIdentity: source.value,
    userResumptionCount: cycles,
    stallCount: 0,
    maxStalls: 3,
    revision: cycles,
    currentEvidence,
    evidenceHistory,
    audit,
    latestSummary: "Current implementation and proof are ready for focused verification.",
    nextAction: "Run the focused context test.",
    stopReason: "Awaiting final verification.",
    closeQualification: decision,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-05T01:50:00.000Z",
  }
  await writeFile(join(stateDirectory, "context--" + sessionID + ".json"), JSON.stringify(state))

  const prompts = []
  const hooks = await AcePlugin({
    client: { session: { promptAsync: async (input) => { prompts.push(input.body.parts[0].text) } } },
    project: { id: "context" },
    directory: stateDirectory,
  })
  const context = { sessionID }
  await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID, id: "message-" + cycles } } } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID } } })
  const currentText = await hooks.tool.ace_status.execute({ detail: "current" }, context)
  const fullText = await hooks.tool.ace_status.execute({ detail: "full" }, context)
  const auditText = await hooks.tool.ace_status.execute({ detail: "audit" }, context)
  const compacted = { context: [] }
  await hooks["experimental.session.compacting"]({ sessionID }, compacted)

  const promptText = prompts[0]
  const compactionText = compacted.context[0]
  const current = JSON.parse(currentText)
  const full = JSON.parse(fullText)
  const auditView = JSON.parse(auditText)
  measurements.push({
    cycles,
    continuationBytes: Buffer.byteLength(promptText),
    legacyContinuationBytes: Buffer.byteLength(
      "AUTOMATIC ACE CONTINUATION\n\nFull persistent Ace state:\n" +
        fullText +
        "\n\nLoad and obey the ace skill. Continue only safe work toward an unmet criterion. Record structured evidence with ace_progress using the displayed source identity. Completion requires current proof; qualifications require explicit user approval.",
    ),
    compactionBytes: Buffer.byteLength(compactionText),
    currentBytes: Buffer.byteLength(currentText),
    fullBytes: Buffer.byteLength(fullText),
    current,
    promptCurrent: extract(promptText, "Current Ace state:\n", "\n\nLoad and obey"),
    compactionCurrent: extract(compactionText, "## Current persistent Ace contract\n", "\n\nPreserve every"),
    fullHistoryCounts: {
      audit: full.audit.length,
      evidence: full.evidenceHistory.length,
      retiredCriteria: full.retiredCriteria.length,
      historicalWindows: full.executionWindows.length - 1,
    },
    auditHistoryCounts: {
      audit: auditView.audit.length,
      evidence: auditView.evidenceHistory.length,
    },
  })
}

console.log(JSON.stringify({ constraint, qualification, measurements }))
`

async function runScenario(): Promise<ScenarioResult> {
  const stateRoot = await mkdtemp(join(tmpdir(), "ace-context-state-"))
  try {
    const child = Bun.spawn(["bun", "--eval", CONTEXT_SCENARIO], {
      cwd: root,
      env: { ...Bun.env, XDG_STATE_HOME: stateRoot },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0)
      throw new Error(`Ace context scenario exited with ${exitCode}: ${stderr}`)
    return parseResult(JSON.parse(stdout))
  } finally {
    await rm(stateRoot, { force: true, recursive: true })
  }
}

describe("Ace current-state recovery", () => {
  test("scales routine hook context with current complexity instead of history", async () => {
    const result = await runScenario()
    const continuationSizes = result.measurements.map(
      ({ continuationBytes }) => continuationBytes,
    )
    const compactionSizes = result.measurements.map(
      ({ compactionBytes }) => compactionBytes,
    )

    expect(Math.max(...continuationSizes) - Math.min(...continuationSizes)).toBeLessThan(100)
    expect(Math.max(...compactionSizes) - Math.min(...compactionSizes)).toBeLessThan(100)
    expect(result.measurements[2]!.fullBytes).toBeGreaterThan(
      result.measurements[0]!.fullBytes * 5,
    )
    const legacyContinuationSizes = result.measurements.map(
      ({ legacyContinuationBytes }) => legacyContinuationBytes,
    )
    expect(
      Math.max(...legacyContinuationSizes) -
        Math.min(...legacyContinuationSizes),
    ).toBeGreaterThan(100_000)
    expect(continuationSizes[2]!).toBeLessThan(
      legacyContinuationSizes[2]! / 5,
    )

    for (const measurement of result.measurements) {
      const current = measurement.current
      expect(measurement.promptCurrent).toEqual(current)
      expect(measurement.compactionCurrent).toEqual(current)
      expect(current.constraints).toEqual([result.constraint])
      expect(current).not.toHaveProperty("audit")
      expect(current).not.toHaveProperty("evidenceHistory")
      expect(current).not.toHaveProperty("retiredCriteria")
      expect(current).not.toHaveProperty("executionWindows")
      expect(current.history).toEqual({
        full: "Use ace_status with detail=full.",
        audit: "Use ace_status with detail=audit.",
      })
      const criteria = current.criteria as Array<Record<string, unknown>>
      const exception = criteria[1]!.exception as Record<string, unknown>
      expect(exception.limitation).toBe(result.qualification)
      expect(exception.decisionReference).toBe("user-authorization-current")
      expect(current.currentEvidence).toEqual([
        expect.objectContaining({
          id: "E-current",
          sourceIdentity: "artifact-current",
        }),
      ])
      expect(current.currentExecutionWindow).toEqual(
        expect.objectContaining({
          id: "W-current",
          measuredElapsedMilliseconds: 75000,
          resumeDecision: expect.objectContaining({
            decisionReference: "user-authorization-current",
          }),
        }),
      )
      expect(current.lifetime).toEqual(
        expect.objectContaining({
          timingComplete: false,
          executionWindowCount: measurement.cycles + 1,
        }),
      )
      expect(measurement.fullHistoryCounts).toEqual({
        audit: measurement.cycles,
        evidence: measurement.cycles,
        retiredCriteria: measurement.cycles,
        historicalWindows: measurement.cycles,
      })
      expect(measurement.auditHistoryCounts).toEqual({
        audit: measurement.cycles,
        evidence: measurement.cycles,
      })
    }
  })
})
