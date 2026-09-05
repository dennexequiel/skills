import { describe, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { requireReleaseVersion } from "../scripts/release-version"
import { hasCompletedAceStatusInvocation } from "../scripts/smoke-opencode"

const root = resolve(import.meta.dir, "..")
const skill = await readFile(resolve(root, "skills/ace/SKILL.md"), "utf8")
const partnership = await readFile(
  resolve(root, "skills/ace/references/partnership.md"),
  "utf8",
)
const command = await readFile(
  resolve(root, "adapters/opencode/command/ace.md"),
  "utf8",
)
const plugin = await readFile(
  resolve(root, "adapters/opencode/plugin/ace.ts"),
  "utf8",
)
const triggers = JSON.parse(
  await readFile(resolve(root, "evals/ace/triggers.json"), "utf8"),
) as {
  positive: string[]
  negative: string[]
  ambiguous: Array<{ prompt: string; expected: string }>
}
const catalog = JSON.parse(
  await readFile(resolve(root, "catalog.json"), "utf8"),
) as {
  skills: Array<{ name: string; status: string; areas: string[] }>
}
const aceCatalogEntry = catalog.skills.find(({ name }) => name === "ace")
const compatibility = await readFile(
  resolve(root, "docs/compatibility.md"),
  "utf8",
)
const repositoryReadme = await readFile(resolve(root, "README.md"), "utf8")
const aceReadme = await readFile(resolve(root, "skills/ace/README.md"), "utf8")

const WHITESPACE_SCENARIO = String.raw`
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const hooks = await AcePlugin({ client: {}, project: { id: "project" }, directory: process.cwd() })
const tools = hooks.tool
if (!tools) throw new Error("Ace plugin did not register tools")
const context = { sessionID: "whitespace-session" }
const validStart = {
  objective: "Ship the change",
  acceptanceCriteria: ["The check passes"],
  constraints: ["Keep scope narrow"],
  verificationPlan: ["Run the check"],
}
const errorMessage = async (operation) => {
  try {
    await operation()
    return "NO_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const objective = await errorMessage(() => tools.ace_start.execute({ ...validStart, objective: "  " }, context))
const acceptanceCriteria = await errorMessage(() => tools.ace_start.execute({ ...validStart, acceptanceCriteria: ["\t"] }, context))
const constraints = await errorMessage(() => tools.ace_start.execute({ ...validStart, constraints: ["\n"] }, context))
const verificationPlan = await errorMessage(() => tools.ace_start.execute({ ...validStart, verificationPlan: ["  "] }, context))
const statusAfterInvalidStarts = await tools.ace_status.execute({}, context)

await tools.ace_start.execute(validStart, context)
const criterionEvidence = await errorMessage(() => tools.ace_complete.execute({
  criterionEvidence: ["  "],
  finalVerification: "The full check passes",
}, context))
const finalVerification = await errorMessage(() => tools.ace_complete.execute({
  criterionEvidence: ["The full check passes"],
  finalVerification: "\t",
}, context))
const statusAfterInvalidCompletion = await tools.ace_status.execute({}, context)

console.log(JSON.stringify({
  objective,
  acceptanceCriteria,
  constraints,
  verificationPlan,
  statusAfterInvalidStarts,
  criterionEvidence,
  finalVerification,
  statusAfterInvalidCompletion,
}))
`

const CLEAR_COLLISION_SCENARIO = String.raw`
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const firstHooks = await AcePlugin({ client: {}, project: { id: "a/b" }, directory: process.cwd() })
const secondHooks = await AcePlugin({ client: {}, project: { id: "a?b" }, directory: process.cwd() })
if (!firstHooks.tool || !secondHooks.tool) throw new Error("Ace plugin did not register tools")
const context = { sessionID: "shared-session" }
await firstHooks.tool.ace_start.execute({
  objective: "Preserve this mission",
  acceptanceCriteria: ["State remains readable"],
  verificationPlan: ["Read status after the rejected clear"],
}, context)

let clearError = "NO_ERROR"
try {
  await secondHooks.tool.ace_clear.execute({}, context)
} catch (error) {
  clearError = error instanceof Error ? error.message : String(error)
}
const originalStatus = await firstHooks.tool.ace_status.execute({}, context)

console.log(JSON.stringify({ clearError, originalStatus }))
`

const MALFORMED_STATE_SCENARIO = String.raw`
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const stateDirectory = join(process.env.XDG_STATE_HOME, "opencode", "ace")
await mkdir(stateDirectory, { recursive: true })
const hooks = await AcePlugin({ client: {}, project: { id: "project" }, directory: process.cwd() })
if (!hooks.tool) throw new Error("Ace plugin did not register tools")
const timestamp = "2026-08-07T00:00:00.000Z"
const validState = {
  version: 1,
  projectID: "project",
  sessionID: "fixture",
  mode: "deliver",
  objective: "Validate state",
  acceptanceCriteria: ["Invalid state is rejected"],
  constraints: [],
  verificationPlan: ["Read the state"],
  status: "active",
  continuationCount: 0,
  maxContinuations: 20,
  stallCount: 0,
  maxStalls: 3,
  maxMinutes: 60,
  revision: 1,
  evidence: [{ note: "legacy note", recordedAt: timestamp }],
  lastHandledMessageID: "legacy-message",
  suppressNextContinuation: true,
  createdAt: timestamp,
  budgetStartedAt: timestamp,
  updatedAt: timestamp,
}
const errorMessage = async (sessionID, mutate) => {
  const state = structuredClone(validState)
  state.sessionID = sessionID
  mutate(state)
  await writeFile(join(stateDirectory, "project--" + sessionID + ".json"), JSON.stringify(state))
  try {
    await hooks.tool.ace_status.execute({}, { sessionID })
    return "NO_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const missingArray = await errorMessage("missing-array", (state) => { delete state.evidence })
const invalidStatus = await errorMessage("invalid-status", (state) => { state.status = "running" })
const invalidCounter = await errorMessage("invalid-counter", (state) => { state.continuationCount = "zero" })
await writeFile(join(stateDirectory, "project--migrated.json"), JSON.stringify({ ...validState, sessionID: "migrated" }))
const migrated = await hooks.tool.ace_status.execute({ detail: "full" }, { sessionID: "migrated" })
const migratedAgain = await hooks.tool.ace_status.execute({ detail: "full" }, { sessionID: "migrated" })
const v2Error = async (sessionID, mutate) => {
  const state = JSON.parse(migrated)
  state.sessionID = sessionID
  state.status = "active"
  state.executionWindows = [{
    ...state.executionWindows[0],
    startedAt: timestamp,
    endedAt: undefined,
    elapsedMilliseconds: 0,
  }]
  mutate(state)
  await writeFile(join(stateDirectory, "project--" + sessionID + ".json"), JSON.stringify(state))
  try {
    await hooks.tool.ace_status.execute({}, { sessionID })
    return "NO_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
const activeClosed = await v2Error("active-closed", (state) => {
  state.executionWindows[0].endedAt = timestamp
})
const pausedOpen = await v2Error("paused-open", (state) => {
  state.status = "paused"
})
const duplicateWindows = await v2Error("duplicate-windows", (state) => {
  state.executionWindows[0].endedAt = timestamp
  state.executionWindows.push({ ...state.executionWindows[0], endedAt: undefined })
})
const priorOpen = await v2Error("prior-open", (state) => {
  state.executionWindows.push({ ...state.executionWindows[0], id: "W2" })
})
const reversedWindow = await v2Error("reversed-window", (state) => {
  state.status = "paused"
  state.executionWindows[0].endedAt = "2026-08-06T23:59:59.000Z"
})
console.log(JSON.stringify({ missingArray, invalidStatus, invalidCounter, migrated, migratedAgain, activeClosed, pausedOpen, duplicateWindows, priorOpen, reversedWindow }))
`

const TERMINAL_SNAPSHOT_SCENARIO = String.raw`
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const workspace = await mkdtemp(join(tmpdir(), "ace-terminal-worktree-"))
const git = (args) => Bun.spawnSync(["git", "-C", workspace, ...args])
git(["init"])
await writeFile(join(workspace, "source.txt"), "one\n")
const prompts = []
const hooks = await AcePlugin({ client: { session: { promptAsync: async (input) => { prompts.push(input) } } }, project: { id: "terminal" }, directory: workspace })
if (!hooks.tool || !hooks.event) throw new Error("Ace plugin did not register tools and events")
const tools = hooks.tool
const context = { sessionID: "terminal-session" }
const errorMessage = async (operation) => { try { await operation(); return "NO_ERROR" } catch (error) { return error instanceof Error ? error.message : String(error) } }

await tools.ace_start.execute({ objective: "Complete one mission", acceptanceCriteria: ["Proof is recorded"], verificationPlan: ["Run focused verification"] }, context)
const originalSource = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context)).source.value
await tools.ace_progress.execute({ summary: "Verified", madeProgress: true, nextAction: "Complete", sourceIdentity: originalSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "focused pass" }] }, context)
await tools.ace_complete.execute({ finalVerification: "Focused verification passed" }, context)
const completed = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await writeFile(join(workspace, "source.txt"), "two\n")
const completedAfterEdit = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const completedCancel = await errorMessage(() => tools.ace_cancel.execute({ reason: "rewrite terminal outcome" }, context))
await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: context.sessionID, id: "after-completion" } } } })

await tools.ace_start.execute({ objective: "Start separate work", acceptanceCriteria: ["New mission is active"], verificationPlan: ["Read status"] }, context)
const newMission = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await tools.ace_cancel.execute({ reason: "User ended the new mission" }, context)
const cancelled = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await writeFile(join(workspace, "source.txt"), "three\n")
const cancelledAfterEdit = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const cancelledAgain = await errorMessage(() => tools.ace_cancel.execute({ reason: "rewrite cancellation" }, context))
const cancelledAfterGuard = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))

console.log(JSON.stringify({
  originalSource,
  completedSource: completedAfterEdit.source.value,
  completedStatus: completedAfterEdit.status,
  completedCriterion: completedAfterEdit.criteria[0].state,
  completedEvidencePreserved: JSON.stringify(completed.currentEvidence) === JSON.stringify(completedAfterEdit.currentEvidence),
  completedWindowsPreserved: JSON.stringify(completed.executionWindows) === JSON.stringify(completedAfterEdit.executionWindows),
  completedRevisionPreserved: completed.revision === completedAfterEdit.revision,
  completedCancel,
  prompts: prompts.length,
  newMissionStatus: newMission.status,
  newMissionSourceChanged: newMission.source.value !== completed.source.value,
  cancelledSource: cancelledAfterEdit.source.value,
  cancelledRecordedSource: cancelled.source.value,
  cancelledStatus: cancelledAfterEdit.status,
  cancelledWindowsPreserved: JSON.stringify(cancelled.executionWindows) === JSON.stringify(cancelledAfterEdit.executionWindows),
  cancelledAgain,
  cancelledRevisionPreserved: cancelledAfterEdit.revision === cancelledAfterGuard.revision,
}))
`

const STABILIZATION_SCENARIO = String.raw`
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const workspace = await mkdtemp(join(tmpdir(), "ace-worktree-"))
const git = (args) => Bun.spawnSync(["git", "-C", workspace, ...args])
git(["init"])
await writeFile(join(workspace, "source.txt"), "one\n")
const prompts = []
const hooks = await AcePlugin({ client: { session: { promptAsync: async (input) => { prompts.push(input) } } }, project: { id: "stabilization" }, directory: workspace })
if (!hooks.tool || !hooks.event) throw new Error("Ace plugin did not register tools and events")
const tools = hooks.tool
const context = { sessionID: "stabilization-session" }
const errorMessage = async (operation) => { try { await operation(); return "NO_ERROR" } catch (error) { return error instanceof Error ? error.message : String(error) } }

await tools.ace_start.execute({
  objective: "X".repeat(6000),
  criteria: [{ id: "C1", text: "Proof stays fresh" }, { id: "C2", text: "Exception is explicit" }],
  verificationPlan: ["Run focused verification"],
  maxContinuations: 2,
  maxMinutes: 1,
}, context)
const initialSummary = await tools.ace_status.execute({}, context)
let checkedSource = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context)).source.value
await tools.ace_progress.execute({ summary: "First proof", madeProgress: true, nextAction: "Refresh proof", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "pass" }] }, context)
await tools.ace_progress.execute({ summary: "Replacement proof", madeProgress: true, nextAction: "Change source", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "pass again" }] }, context)
const afterReplacement = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await writeFile(join(workspace, "source.txt"), "two\n")
const staleCriteria = await tools.ace_status.execute({ detail: "criteria" }, context)
checkedSource = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context)).source.value
const unknownCriterion = await errorMessage(() => tools.ace_progress.execute({ summary: "bad", madeProgress: true, nextAction: "bad", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C9"], method: "test", result: "passed", summary: "bad" }] }, context))
await tools.ace_progress.execute({ summary: "Fresh proof", madeProgress: true, nextAction: "Qualify C2", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "fresh" }] }, context)
await tools.ace_accept_exception.execute({ criterionID: "C2", limitation: "External owner must finish rollout", decisionReference: "user-message-42", approver: "user", decidedAt: "2026-09-05T00:00:00.000Z" }, context)
await tools.ace_pause.execute({ reason: "Awaiting qualified handoff" }, context)
await tools.ace_resume.execute({ decisionReference: "user-message-42b", approver: "user", decidedAt: "2026-09-05T00:00:30.000Z" }, context)
await tools.ace_pause.execute({ reason: "Ready for qualified handoff" }, context)
const strictCompletion = await errorMessage(() => tools.ace_complete.execute({ finalVerification: "focused test" }, context))
const qualified = await tools.ace_close_with_qualifications.execute({ finalVerification: "focused test", decisionReference: "user-message-43", approver: "user", decidedAt: "2026-09-05T00:01:00.000Z" }, context)

await tools.ace_start.execute({ objective: "Limit mission", acceptanceCriteria: ["Deadline holds"], verificationPlan: ["Read status"], maxMinutes: 1, replace: true }, context)
const limitedState = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
limitedState.executionWindows[0].startedAt = "2000-01-01T00:00:00.000Z"
const stateDirectory = join(process.env.XDG_STATE_HOME, "opencode", "ace")
await writeFile(join(stateDirectory, "stabilization--stabilization-session.json"), JSON.stringify(limitedState))
const deadlineStatus = await tools.ace_status.execute({}, context)
const deadlineProgress = await errorMessage(() => tools.ace_progress.execute({ summary: "late", madeProgress: true, nextAction: "late" }, context))
const deadlineCompletion = await errorMessage(() => tools.ace_complete.execute({ finalVerification: "late" }, context))
const resumed = await tools.ace_resume.execute({ decisionReference: "user-message-44", approver: "user", decidedAt: "2026-09-05T00:02:00.000Z" }, context)
const resumedState = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))

await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: context.sessionID, id: "m1" } } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: context.sessionID } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: context.sessionID } } })
await tools.ace_status.execute({ suppressContinuation: true }, context)
await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: context.sessionID, id: "m2" } } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: context.sessionID } } })
const eventState = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))

await tools.ace_start.execute({
  objective: "Planned mission",
  criteria: [{ id: "C1", text: "Plan criterion" }],
  verificationPlan: ["Run plan check"],
  deliveryPlanRequired: true,
  milestones: [{ id: "M1", outcome: "Reviewable unit", criterionIDs: ["C1"], fileScope: ["source.txt"], verification: "Run plan check", reviewUnit: "planned-unit", branchName: "feat/planned-unit", authorizationState: "not-authorized" }],
  replace: true,
}, context)
checkedSource = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context)).source.value
await tools.ace_progress.execute({ summary: "Planned proof", madeProgress: true, nextAction: "Close milestone", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "plan-check", result: "passed", summary: "pass" }] }, context)
const unclosedMilestone = await errorMessage(() => tools.ace_complete.execute({ finalVerification: "plan check" }, context))
await tools.ace_progress.execute({ summary: "Milestone closed", madeProgress: true, nextAction: "Complete", milestoneUpdates: [{ id: "M1", state: "closed" }] }, context)
const plannedCompletion = await tools.ace_complete.execute({ finalVerification: "plan check" }, context)

console.log(JSON.stringify({
  initialSummaryBytes: Buffer.byteLength(initialSummary),
  currentEvidence: afterReplacement.currentEvidence.length,
  historyEvidence: afterReplacement.evidenceHistory.length,
  staleCriteria,
  unknownCriterion,
  strictCompletion,
  qualified,
  deadlineStatus,
  deadlineProgress,
  deadlineCompletion,
  resumed,
  windows: resumedState.executionWindows.length,
  firstWindowElapsed: resumedState.executionWindows[0].elapsedMilliseconds,
  qualification: qualified.includes("qualifications"),
  prompts: prompts.length,
  eventContinuations: eventState.automaticContinuationCount,
  eventStatus: eventState.status,
  unclosedMilestone,
  plannedCompletion,
}))
`

const WINDOW_SCENARIO = String.raw`
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const NativeDate = Date
const origin = NativeDate.parse("2026-09-05T00:00:00Z")
let clock = origin
globalThis.Date = class extends NativeDate {
  constructor(value) { super(value === undefined ? clock : value) }
  static now() { return clock }
}
const minute = 60_000
const workspace = await mkdtemp(join(tmpdir(), "ace-window-"))
const hooks = await AcePlugin({ client: { session: { promptAsync: async () => { throw new Error("offline") } } }, project: { id: "windows" }, directory: workspace })
const tools = hooks.tool
const start = { objective: "Verify accounting", acceptanceCriteria: ["Bounded work"], verificationPlan: ["Observe windows"], maxStalls: 1, sourceIdentity: { value: "fixture-v1", freshnessPolicy: "Static fixture" } }
const full = (sessionID) => tools.ace_status.execute({ detail: "full" }, { sessionID }).then(JSON.parse)
const approval = { decisionReference: "user-resume", approver: "user", decidedAt: "2026-09-05T01:02:00Z" }
await tools.ace_start.execute(start, { sessionID: "stall" })
clock += 2 * minute
await tools.ace_progress.execute({ summary: "No new evidence", nextAction: "Wait for input", madeProgress: false }, { sessionID: "stall" })
const blocked = await full("stall")
clock += 60 * minute
const waited = await full("stall")
await tools.ace_resume.execute(approval, { sessionID: "stall" })
clock += 10 * minute
await tools.ace_pause.execute({ reason: "Review handoff" }, { sessionID: "stall" })
const resumed = await full("stall")

await tools.ace_start.execute(start, { sessionID: "error" })
clock += 3 * minute
await hooks.event({ event: { type: "session.error", properties: { sessionID: "error", error: "host unavailable" } } })
clock += 60 * minute
const hostError = await full("error")

await tools.ace_start.execute(start, { sessionID: "submit" })
clock += 4 * minute
await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: "submit", id: "message-submit" } } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: "submit" } } })
clock += 60 * minute
const submission = await full("submit")

await tools.ace_start.execute({ ...start, constraints: ["Preserve the entire approval boundary"], maxMinutes: 4 }, { sessionID: "deadline" })
clock += 3 * minute
const warning = await full("deadline")
const compacted = { context: [] }
await hooks["experimental.session.compacting"]({ sessionID: "deadline" }, compacted)
clock += minute
await hooks.event({ event: { type: "session.idle", properties: { sessionID: "deadline" } } })
const limited = await full("deadline")

const stateDir = join(process.env.XDG_STATE_HOME, "opencode", "ace")
await mkdir(stateDir, { recursive: true })
Bun.spawnSync(["git", "-C", workspace, "init"])
const stamp = (minutes) => new NativeDate(origin + minutes * minute).toISOString()
const legacy = { version: 1, projectID: "windows", sessionID: "legacy", mode: "deliver", objective: "Migrate elapsed time", acceptanceCriteria: ["Time counted once"], constraints: [], verificationPlan: ["Observe known time"], status: "active", continuationCount: 2, maxContinuations: 20, stallCount: 0, maxStalls: 3, maxMinutes: 60, revision: 1, evidence: [{ note: "Prior note", recordedAt: stamp(10) }], createdAt: stamp(0), budgetStartedAt: stamp(0), updatedAt: stamp(10) }
await writeFile(join(stateDir, "windows--legacy.json"), JSON.stringify(legacy))
clock = origin + 15 * minute
const legacyContext = { sessionID: "legacy" }
const migrated = await full("legacy")
await tools.ace_pause.execute({ reason: "Freeze migrated usage" }, legacyContext)
const migratedPaused = await full("legacy")
console.log(JSON.stringify({
  blockedElapsed: blocked.executionWindows[0].elapsedMilliseconds,
  waitedElapsed: waited.executionWindows[0].elapsedMilliseconds,
  windowCount: resumed.executionWindows.length,
  lifetimeElapsed: resumed.executionWindows.reduce((total, window) => total + window.elapsedMilliseconds, 0),
  iterations: resumed.iterationCount,
  resumptions: resumed.userResumptionCount,
  hostErrorElapsed: hostError.executionWindows[0].elapsedMilliseconds,
  submissionElapsed: submission.executionWindows[0].elapsedMilliseconds,
  warning: warning.executionWindows[0].warningIssued,
  limitedStatus: limited.status,
  limitedElapsed: limited.executionWindows[0].elapsedMilliseconds,
  compacted: compacted.context.join("\n"),
  migratedStatus: migrated.status,
  migratedElapsed: migratedPaused.executionWindows[0].elapsedMilliseconds,
  migratedIncomplete: !migrated.lifetimeTimingComplete,
}))
`

const REVISION_SCENARIO = String.raw`
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const workspace = await mkdtemp(join(tmpdir(), "ace-contract-"))
const hooks = await AcePlugin({ client: {}, project: { id: "contract" }, directory: workspace })
const tools = hooks.tool
const context = { sessionID: "revision" }
const errorMessage = async (operation) => { try { await operation(); return "NO_ERROR" } catch (error) { return error instanceof Error ? error.message : String(error) } }
const approval = { decisionReference: "user-message-1", approver: "user", decidedAt: "2026-09-05T01:00:00Z" }
const start = {
  objective: "Verify the local artifact",
  criteria: [{ id: "C1", text: "Both checks pass" }, { id: "C2", text: "External acceptance" }],
  verificationPlan: ["test", "lint"],
  sourceIdentity: { value: "artifact-1", freshnessPolicy: "Caller checks the artifact digest before each cycle" },
  maxMinutes: 1,
}
const check = (method, criterionID = "C1", result = "passed") => ({ criterionIDs: [criterionID], method, result, summary: method + " result" })
const progress = (evidence) => tools.ace_progress.execute({ summary: "Verification cycle", nextAction: "Inspect remaining criteria", madeProgress: true, sourceIdentity: "artifact-1", evidence }, context)
const full = () => tools.ace_status.execute({ detail: "full" }, context).then(JSON.parse)
await tools.ace_start.execute(start, context)
await progress([check("test"), check("lint")])
await tools.ace_accept_exception.execute({ ...approval, criterionID: "C2", limitation: "External validation deferred" }, context)
await tools.ace_revise.execute({ ...approval, reason: "User requires broader output coverage", objective: "Verify all artifact outputs", verificationPlan: ["expanded test", "expanded lint"] }, context)
const revised = await full()
await progress([check("test")])
const partial = await errorMessage(() => tools.ace_complete.execute({ finalVerification: "Partial rerun" }, context))
await progress([check("lint"), check("external", "C2", "failed")])
const beforeAcceptance = await full()
await tools.ace_pause.execute({ reason: "Awaiting accepted qualification" }, context)
const oldException = await errorMessage(() => tools.ace_close_with_qualifications.execute({ ...approval, finalVerification: "Old approval is insufficient" }, context))
await tools.ace_accept_exception.execute({ ...approval, criterionID: "C2", limitation: "User accepts the revised external gap" }, context)
const closed = await tools.ace_close_with_qualifications.execute({ ...approval, finalVerification: "Both local checks and explicit current qualification" }, context)

const retiredContext = { sessionID: "retired" }
await tools.ace_start.execute(start, retiredContext)
await tools.ace_revise.execute({ ...approval, reason: "C2 is outside the revised scope", criteria: [start.criteria[0]] }, retiredContext)
const reusedID = await errorMessage(() => tools.ace_revise.execute({ ...approval, reason: "Try to reuse a retired ID", criteria: start.criteria }, retiredContext))
const retiredReadable = await tools.ace_status.execute({ detail: "full" }, retiredContext)

const limitContext = { sessionID: "limit" }
await tools.ace_start.execute(start, limitContext)
const limitState = JSON.parse(await tools.ace_status.execute({ detail: "full" }, limitContext))
limitState.executionWindows[0].startedAt = "2000-01-01T00:00:00Z"
await writeFile(join(process.env.XDG_STATE_HOME, "opencode", "ace", "contract--limit.json"), JSON.stringify(limitState))
await tools.ace_pause.execute({ reason: "Deadline handoff" }, limitContext)
const pausedTool = await errorMessage(() => hooks["tool.execute.before"]({ sessionID: "limit", tool: "bash" }, { args: {} }))
const pausedControl = await errorMessage(() => hooks["tool.execute.before"]({ sessionID: "limit", tool: "ace_status" }, { args: {} }))

const artifactContext = { sessionID: "artifact" }
await tools.ace_start.execute(start, artifactContext)
await tools.ace_status.execute({ sourceIdentity: "artifact-2" }, artifactContext)
const artifactProgress = { summary: "Artifact updated", nextAction: "Verify", madeProgress: true }
await tools.ace_progress.execute(artifactProgress, artifactContext)
const changedArtifact = JSON.parse(await tools.ace_status.execute({ detail: "full" }, artifactContext))
await tools.ace_progress.execute(artifactProgress, artifactContext)
const repeatedArtifact = JSON.parse(await tools.ace_status.execute({ detail: "full" }, artifactContext))
console.log(JSON.stringify({
  invalidated: revised.currentEvidence.filter((entry) => entry.invalidatedAt).length,
  exceptionCleared: revised.criteria.find((item) => item.id === "C2").exception === undefined,
  partial,
  currentC1: beforeAcceptance.criteria.find((item) => item.id === "C1").state,
  currentC2: beforeAcceptance.criteria.find((item) => item.id === "C2").state,
  oldException,
  closed,
  reusedID,
  retiredReadable,
  pausedTool,
  pausedControl,
  changedArtifactStalls: changedArtifact.stallCount,
  repeatedArtifactStalls: repeatedArtifact.stallCount,
}))
`

const REPAIR_SCENARIO = String.raw`
import { mkdtemp, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const errorMessage = async (operation) => { try { await operation(); return "NO_ERROR" } catch (error) { return error instanceof Error ? error.message : String(error) } }
const workspace = await mkdtemp(join(tmpdir(), "ace-repair-git-"))
Bun.spawnSync(["git", "-C", workspace, "init"])
await writeFile(join(workspace, "source.txt"), "one\n")
Bun.spawnSync(["git", "-C", workspace, "add", "source.txt"])
const prompts = []
const hooks = await AcePlugin({ client: { session: { promptAsync: async (input) => { prompts.push(input) } } }, project: { id: "repair" }, directory: workspace })
const tools = hooks.tool
const context = { sessionID: "repair-session" }
await tools.ace_start.execute({
  objective: "Exercise evidence integrity",
  criteria: [{ id: "C1", text: "Checks pass" }, { id: "C2", text: "Limitation is accepted" }],
  verificationPlan: ["Run test and lint"],
  maxStalls: 3,
  maxContinuations: 1,
  milestones: [{ id: "M1", outcome: "Qualified unit", criterionIDs: ["C2"], fileScope: ["source.txt"], verification: "Inspect exception", reviewUnit: "unit", branchName: "proposal-only", authorizationState: "not-authorized" }],
  deliveryPlanRequired: true,
}, context)
let full = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const originalSource = full.source.value
await writeFile(join(workspace, "source.txt"), "two\n")
const mismatch = await errorMessage(() => tools.ace_progress.execute({ summary: "stale run", madeProgress: true, nextAction: "rerun", sourceIdentity: originalSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "old source" }] }, context))
full = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const checkedSource = full.source.value
await tools.ace_progress.execute({ summary: "broad proof", madeProgress: true, nextAction: "replace one", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1", "C2"], method: "test", result: "passed", summary: "broad pass" }] }, context)
await tools.ace_progress.execute({ summary: "narrow replacement", madeProgress: true, nextAction: "lint", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "test", result: "passed", summary: "narrow pass" }] }, context)
const replacement = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await tools.ace_progress.execute({ summary: "new diagnostic", madeProgress: true, nextAction: "fix lint", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "lint", result: "failed", summary: "lint E1" }] }, context)
await tools.ace_progress.execute({ summary: "duplicate diagnostic", madeProgress: true, nextAction: "fix lint", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "lint", result: "failed", summary: "lint E1" }] }, context)
const duplicate = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
await tools.ace_progress.execute({ summary: "lint repaired", madeProgress: true, nextAction: "baseline", sourceIdentity: checkedSource, evidence: [{ criterionIDs: ["C1"], method: "lint", result: "passed", summary: "lint passes" }, { criterionIDs: ["C2"], method: "rollout", result: "baseline-qualified", summary: "matches accepted candidate baseline" }] }, context)
const baselineStrict = await errorMessage(() => tools.ace_complete.execute({ finalVerification: "baseline only" }, context))
await tools.ace_accept_exception.execute({ criterionID: "C2", limitation: "Accepted rollout gap", decisionReference: "user-accept-1", approver: "user", decidedAt: "2026-09-05T01:00:00.000Z" }, context)
await tools.ace_pause.execute({ reason: "Qualified close" }, context)
const qualified = await tools.ace_close_with_qualifications.execute({ finalVerification: "Reviewed current proof and exception", decisionReference: "user-close-1", approver: "user", decidedAt: "2026-09-05T01:01:00.000Z" }, context)
const qualifiedState = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const terminalRevision = await errorMessage(() => tools.ace_revise.execute({ reason: "should fail", decisionReference: "user-revise-1", approver: "user", decidedAt: "2026-09-05T01:02:00.000Z", objective: "mutated" }, context))

const cycle = await errorMessage(() => tools.ace_start.execute({ objective: "Cycle", criteria: [{ id: "C1", text: "One" }], verificationPlan: ["Inspect"], replace: true, milestones: [
  { id: "M1", outcome: "One", criterionIDs: ["C1"], fileScope: ["a"], verification: "inspect", dependsOn: ["M2"], reviewUnit: "one", branchName: "one", authorizationState: "not-authorized" },
  { id: "M2", outcome: "Two", criterionIDs: ["C1"], fileScope: ["b"], verification: "inspect", dependsOn: ["M1"], reviewUnit: "two", branchName: "two", authorizationState: "not-authorized" },
] }, context))

await tools.ace_start.execute({ objective: "Continuation", acceptanceCriteria: ["One turn"], verificationPlan: ["Inspect"], maxContinuations: 1, replace: true }, context)
await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: context.sessionID, id: "turn-1" } } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: context.sessionID } } })
const afterAllowedTurn = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))
const toolBoundary = await errorMessage(() => hooks["tool.execute.before"]({ tool: "read", sessionID: context.sessionID, callID: "call-1" }, { args: {} }))
await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", sessionID: context.sessionID, id: "turn-2" } } } })
await hooks.event({ event: { type: "session.idle", properties: { sessionID: context.sessionID } } })
const afterRejectedTurn = JSON.parse(await tools.ace_status.execute({ detail: "full" }, context))

const manualDirectory = await mkdtemp(join(tmpdir(), "ace-repair-manual-"))
const manualHooks = await AcePlugin({ client: { session: { promptAsync: async () => {} } }, project: { id: "manual" }, directory: manualDirectory })
const manualTools = manualHooks.tool
const manualContext = { sessionID: "manual-session" }
const noMission = await manualTools.ace_status.execute({}, manualContext)
await manualTools.ace_start.execute({ objective: "Manual", acceptanceCriteria: ["Proof"], verificationPlan: ["Observe"], sourceIdentity: { value: "artifact-v1", freshnessPolicy: "Caller checks artifact revision" } }, manualContext)
const manualStatus = await manualTools.ace_status.execute({}, manualContext)
await manualTools.ace_status.execute({ sourceIdentity: "artifact-v2" }, manualContext)
const manualFull = JSON.parse(await manualTools.ace_status.execute({ detail: "full" }, manualContext))
await manualTools.ace_progress.execute({ summary: "Manual proof", madeProgress: true, nextAction: "pause", sourceIdentity: manualFull.source.value, evidence: [{ criterionIDs: ["C1"], method: "observe", result: "passed", summary: "observed" }] }, manualContext)
await manualTools.ace_pause.execute({ reason: "pause" }, manualContext)
await manualTools.ace_resume.execute({ decisionReference: "user-resume", approver: "user", decidedAt: "2026-09-05T02:00:00.000Z" }, manualContext)
await manualTools.ace_complete.execute({ finalVerification: "observed" }, manualContext)
const manualClear = await manualTools.ace_clear.execute({}, manualContext)

const summaryContext = { sessionID: "summary-session" }
const longCriterionID = "C_" + "x".repeat(200)
await tools.ace_start.execute({ objective: "界".repeat(6000), criteria: [{ id: longCriterionID, text: "界".repeat(2000) }, ...Array.from({ length: 80 }, (_, index) => ({ id: "C" + index, text: "criterion " + index }))], verificationPlan: ["Inspect"], maxStalls: 3 }, summaryContext)
await tools.ace_progress.execute({ summary: "diagnostic", madeProgress: true, nextAction: "界".repeat(3000), criterionStates: [{ id: longCriterionID, state: "blocked", reason: "界".repeat(3000) }] }, summaryContext)
const boundedSummary = await tools.ace_status.execute({}, summaryContext)

await unlink(join(workspace, "source.txt"))
const deletionStatus = await tools.ace_status.execute({}, context)

console.log(JSON.stringify({
  mismatch,
  replacementCurrent: replacement.currentEvidence.length,
  replacementC2Refs: replacement.criteria.find((item) => item.id === "C2").evidenceIDs.length,
  refsResolve: replacement.criteria.every((criterion) => criterion.evidenceIDs.every((id) => replacement.currentEvidence.some((entry) => entry.id === id))),
  failingState: duplicate.criteria.find((item) => item.id === "C1").state,
  duplicateStalls: duplicate.stallCount,
  baselineStrict,
  qualified,
  qualifiedMilestone: qualifiedState.milestones[0].state,
  exceptionDecision: qualifiedState.criteria.find((item) => item.id === "C2").exception.decisionReference,
  terminalRevision,
  cycle,
  prompts: prompts.length,
  allowedStatus: afterAllowedTurn.status,
  toolBoundary,
  rejectedStatus: afterRejectedTurn.status,
  noMission,
  manualStatus,
  manualSource: manualFull.source.value,
  manualClear,
  boundedSummary,
  boundedSummaryBytes: Buffer.byteLength(boundedSummary),
  deletionStatus,
}))
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requireResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Ace plugin scenario must return a JSON object")
  }
  return value
}

function resultString(result: Record<string, unknown>, field: string): string {
  const value = result[field]
  if (typeof value !== "string")
    throw new Error(`Ace plugin scenario field ${field} must be a string`)
  return value
}

function resultNumber(result: Record<string, unknown>, field: string): number {
  const value = result[field]
  if (typeof value !== "number")
    throw new Error(`Ace plugin scenario field ${field} must be a number`)
  return value
}

function resultBoolean(
  result: Record<string, unknown>,
  field: string,
): boolean {
  const value = result[field]
  if (typeof value !== "boolean")
    throw new Error(`Ace plugin scenario field ${field} must be a boolean`)
  return value
}

async function runAcePluginScenario(
  source: string,
): Promise<Record<string, unknown>> {
  const stateRoot = await mkdtemp(join(tmpdir(), "ace-plugin-state-"))
  try {
    const child = Bun.spawn(["bun", "--eval", source], {
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
      throw new Error(`Ace plugin scenario exited with ${exitCode}: ${stderr}`)
    const result: unknown = JSON.parse(stdout)
    return requireResult(result)
  } finally {
    await rm(stateRoot, { force: true, recursive: true })
  }
}

describe("Ace portable contract", () => {
  test("advertises optional modes to clients that support argument hints", () => {
    expect(skill).toContain(
      'argument-hint: "[deliver|learn|explore|decide] <mission>"',
    )
  })

  test("keeps consequential questions and reversible defaults together", () => {
    expect(skill).toContain("Ask a question only when")
    expect(skill).toContain("choose the safest reversible default")
    expect(partnership).toContain("Do not front-load hypothetical edge cases")
  })

  test("preserves distinct delivery and learning responsibilities", () => {
    expect(skill).toContain("In `deliver` mode")
    expect(skill).toContain("In `learn` mode")
    expect(skill).toContain(
      "let the user make the requested architecture or reasoning decisions",
    )
    expect(skill).toContain("one lightweight observable demonstration")
  })

  test("bounds initially open-ended missions with finite defaults", () => {
    expect(skill).toContain("Ace may first bound an open-ended request")
    expect(skill).toContain(
      "20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations",
    )
  })

  test("requires evidence and finite terminal states", () => {
    for (const status of [
      "completed",
      "paused",
      "blocked",
      "limit-reached",
      "cancelled",
    ]) {
      expect(skill).toContain(`\`${status}\``)
    }
    expect(skill).toContain("fresh evidence proves every agreed criterion")
  })
})

describe("Ace distribution", () => {
  test("has routing coverage on both sides of its activation boundary", () => {
    expect(triggers.positive.length).toBeGreaterThanOrEqual(5)
    expect(triggers.negative.length).toBeGreaterThanOrEqual(5)
    expect(triggers.ambiguous.length).toBeGreaterThanOrEqual(2)
  })

  test("publishes honest maturity and per-skill compatibility metadata", () => {
    expect(aceCatalogEntry).toEqual(
      expect.objectContaining({
        name: "ace",
        status: "stable",
        areas: ["workflow", "autonomy"],
      }),
    )
    expect(compatibility).toContain("Format-compatible")
    expect(compatibility).toContain("Smoke-tested")
    expect(compatibility).toContain("Automation adapter")
    expect(compatibility).toContain(
      "| [Ace](../skills/ace/) | OpenCode | Yes | Yes (`bun run smoke:opencode`) | Yes |",
    )
    expect(compatibility).toContain(
      "| [Ace](../skills/ace/) | Claude Code | Yes | Yes (`bun run smoke:claude-code`) | No |",
    )
  })

  test("limits the integration gate to automated coverage the repository provides", () => {
    expect(compatibility).toContain(
      "The host discovery and invocation path has a reproducible smoke command",
    )
    expect(compatibility).toContain(
      "forced-upgrade regression tests when present",
    )
    expect(compatibility).not.toContain(
      "stopping, and upgrade behavior have automated smoke tests",
    )
  })

  test("requires a completed structured ace_status tool event for smoke verification", () => {
    const completedToolEvent = JSON.stringify({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "ace_status",
        state: {
          status: "completed",
          output: "No Ace mission exists for this session.",
        },
      },
    })
    const echoedTextEvent = JSON.stringify({
      type: "text",
      part: { text: "ace_status: No Ace mission exists for this session." },
    })

    expect(hasCompletedAceStatusInvocation(completedToolEvent)).toBe(true)
    expect(hasCompletedAceStatusInvocation(echoedTextEvent)).toBe(false)
    expect(
      hasCompletedAceStatusInvocation(
        "ace_status: No Ace mission exists for this session.",
      ),
    ).toBe(false)
  })

  test("keeps repository and skill installation guidance at the right scope", () => {
    expect(repositoryReadme).toContain("--skill SKILL_NAME")
    expect(repositoryReadme).not.toContain("Install Ace")
    expect(aceReadme).toContain("--skill ace")
    expect(aceReadme).toContain("--agent claude-code --global --yes")
    expect(aceReadme).toContain("OpenCode Automation Adapter")
  })

  test("wires the OpenCode command to the portable skill and adapter tools", () => {
    expect(command).toContain("`ace` skill")
    for (const tool of [
      "ace_start",
      "ace_status",
      "ace_progress",
      "ace_complete",
    ]) {
      expect(command).toContain(tool)
      expect(plugin).toContain(`${tool}: tool({`)
    }
  })

  test("installs a complete OpenCode bundle and protects existing files", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "ace-opencode-"))
    await writeFile(
      resolve(configRoot, "package.json"),
      JSON.stringify({
        dependencies: { "@opencode-ai/plugin": "1.18.5" },
      }),
      "utf8",
    )
    const runInstaller = async (...args: string[]) => {
      const process = Bun.spawn(
        ["bun", "scripts/install-opencode.ts", ...args],
        {
          cwd: root,
          env: { ...Bun.env, OPENCODE_CONFIG_DIR: configRoot },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const [exitCode, stdout, stderr] = await Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
      ])
      return { exitCode, stdout, stderr }
    }

    try {
      const help = await runInstaller("--help")
      expect(help.exitCode).toBe(0)
      expect(help.stdout).toContain("Usage: bun run install:opencode [--force]")
      expect(
        await access(resolve(configRoot, "skills/ace")).then(
          () => true,
          () => false,
        ),
      ).toBe(false)

      const first = await runInstaller()
      expect(first.exitCode).toBe(0)
      await access(resolve(configRoot, "skills/ace/LICENSE"))
      await access(resolve(configRoot, "skills/ace/references/evidence.md"))
      await access(resolve(configRoot, "commands/ace.md"))
      await access(resolve(configRoot, "plugins/ace.ts"))

      const second = await runInstaller()
      expect(second.exitCode).not.toBe(0)
      expect(second.stderr).toContain("would overwrite")

      const obsolete = resolve(configRoot, "skills/ace/references/obsolete.md")
      await writeFile(obsolete, "obsolete\n", "utf8")
      const forced = await runInstaller("--force")
      expect(forced.exitCode).toBe(0)
      expect(
        await access(obsolete).then(
          () => true,
          () => false,
        ),
      ).toBe(false)
      await access(resolve(configRoot, "skills/ace/references/evidence.md"))
      await access(resolve(configRoot, "commands/ace.md"))
      await access(resolve(configRoot, "plugins/ace.ts"))
    } finally {
      await rm(configRoot, { force: true, recursive: true })
    }
  })
})

describe("Ace OpenCode state", () => {
  test("rejects whitespace-only start and completion fields before writing state", async () => {
    const result = await runAcePluginScenario(WHITESPACE_SCENARIO)

    expect(resultString(result, "objective")).toBe(
      "Ace objective must not be empty",
    )
    expect(resultString(result, "acceptanceCriteria")).toBe(
      "Ace criterion C1 must not be empty",
    )
    expect(resultString(result, "constraints")).toBe(
      "Ace constraints[0] must not be empty",
    )
    expect(resultString(result, "verificationPlan")).toBe(
      "Ace verificationPlan[0] must not be empty",
    )
    expect(resultString(result, "statusAfterInvalidStarts")).toBe(
      "No Ace mission exists for this session.",
    )
    expect(resultString(result, "criterionEvidence")).toContain(
      "Cannot strictly complete Ace mission",
    )
    expect(resultString(result, "finalVerification")).toContain(
      "Cannot strictly complete Ace mission",
    )
    expect(resultString(result, "statusAfterInvalidCompletion")).toContain(
      "Status: active",
    )
  })

  test("refuses to clear a colliding session state", async () => {
    const result = await runAcePluginScenario(CLEAR_COLLISION_SCENARIO)

    expect(resultString(result, "clearError")).toContain(
      'Cannot clear Ace state for project "a?b"',
    )
    expect(resultString(result, "clearError")).toContain(
      'field projectID must match "a?b"',
    )
    expect(resultString(result, "originalStatus")).toContain(
      "Ace mission: Preserve this mission",
    )
    expect(resultString(result, "originalStatus")).toContain("Status: active")
  })

  test("rejects malformed persisted state at the file boundary", async () => {
    const result = await runAcePluginScenario(MALFORMED_STATE_SCENARIO)

    expect(resultString(result, "missingArray")).toContain(
      "project--missing-array.json: field evidence must be an array",
    )
    expect(resultString(result, "invalidStatus")).toContain(
      "project--invalid-status.json: field status must be one of",
    )
    expect(resultString(result, "invalidCounter")).toContain(
      "project--invalid-counter.json: field continuationCount must be an integer",
    )
    expect(resultString(result, "migrated")).toContain('"version": 2')
    expect(resultString(result, "migrated")).toContain(
      "Migrated version-1 state",
    )
    expect(resultString(result, "migrated")).toContain(
      '"lifetimeTimingComplete": false',
    )
    expect(resultString(result, "migratedAgain")).toContain("legacy note")
    expect(resultString(result, "migratedAgain")).toContain(
      '"lastHandledMessageID": "legacy-message"',
    )
    expect(resultString(result, "activeClosed")).toContain(
      "last window must be open when active",
    )
    expect(resultString(result, "pausedOpen")).toContain(
      "last window must be closed when status is paused",
    )
    expect(resultString(result, "duplicateWindows")).toContain(
      "must have unique IDs",
    )
    expect(resultString(result, "priorOpen")).toContain(
      "prior window W1 must be closed",
    )
    expect(resultString(result, "reversedWindow")).toContain(
      "window W1 ends before it starts",
    )
  })

  test("preserves terminal missions as source-bound snapshots", async () => {
    const result = await runAcePluginScenario(TERMINAL_SNAPSHOT_SCENARIO)

    expect(resultString(result, "completedSource")).toBe(
      resultString(result, "originalSource"),
    )
    expect(resultString(result, "completedStatus")).toBe("completed")
    expect(resultString(result, "completedCriterion")).toBe("satisfied")
    expect(resultBoolean(result, "completedEvidencePreserved")).toBe(true)
    expect(resultBoolean(result, "completedWindowsPreserved")).toBe(true)
    expect(resultBoolean(result, "completedRevisionPreserved")).toBe(true)
    expect(resultString(result, "completedCancel")).toContain(
      "Cannot cancel a completed Ace mission",
    )
    expect(resultNumber(result, "prompts")).toBe(0)
    expect(resultString(result, "newMissionStatus")).toBe("active")
    expect(resultBoolean(result, "newMissionSourceChanged")).toBe(true)
    expect(resultString(result, "cancelledSource")).toBe(
      resultString(result, "cancelledRecordedSource"),
    )
    expect(resultString(result, "cancelledStatus")).toBe("cancelled")
    expect(resultBoolean(result, "cancelledWindowsPreserved")).toBe(true)
    expect(resultString(result, "cancelledAgain")).toContain(
      "already cancelled",
    )
    expect(resultBoolean(result, "cancelledRevisionPreserved")).toBe(true)
  })

  test("enforces bounded execution, freshness, qualifications, and continuation claims", async () => {
    const result = await runAcePluginScenario(STABILIZATION_SCENARIO)

    expect(resultNumber(result, "initialSummaryBytes")).toBeLessThan(4096)
    expect(resultNumber(result, "currentEvidence")).toBe(1)
    expect(resultNumber(result, "historyEvidence")).toBe(1)
    expect(resultString(result, "staleCriteria")).toContain(
      "C1 | verification-stale",
    )
    expect(resultString(result, "unknownCriterion")).toContain(
      "unknown criterion C9",
    )
    expect(resultString(result, "strictCompletion")).toContain(
      "Ace mission is paused",
    )
    expect(resultString(result, "qualified")).toContain(
      "closed with qualifications",
    )
    expect(resultString(result, "deadlineStatus")).toContain(
      "Status: limit-reached",
    )
    expect(resultString(result, "deadlineProgress")).toContain(
      "limit state is persisted",
    )
    expect(resultString(result, "deadlineCompletion")).toContain(
      "limit state is persisted",
    )
    expect(resultNumber(result, "windows")).toBe(2)
    expect(resultNumber(result, "firstWindowElapsed")).toBeGreaterThan(0)
    expect(resultBoolean(result, "qualification")).toBe(true)
    expect(resultNumber(result, "prompts")).toBe(1)
    expect(resultNumber(result, "eventContinuations")).toBe(1)
    expect(resultString(result, "eventStatus")).toBe("active")
    expect(resultString(result, "unclosedMilestone")).toContain(
      "Milestone M1 is not closed and verified",
    )
    expect(resultString(result, "plannedCompletion")).toContain(
      "Ace mission completed",
    )
  })

  test("freezes inactive windows and counts resumed and migrated time once", async () => {
    const result = await runAcePluginScenario(WINDOW_SCENARIO)

    expect(resultNumber(result, "blockedElapsed")).toBe(120_000)
    expect(resultNumber(result, "waitedElapsed")).toBe(120_000)
    expect(resultNumber(result, "windowCount")).toBe(2)
    expect(resultNumber(result, "lifetimeElapsed")).toBe(720_000)
    expect(resultNumber(result, "iterations")).toBe(1)
    expect(resultNumber(result, "resumptions")).toBe(1)
    expect(resultNumber(result, "hostErrorElapsed")).toBe(180_000)
    expect(resultNumber(result, "submissionElapsed")).toBe(240_000)
    expect(resultBoolean(result, "warning")).toBe(true)
    expect(resultString(result, "limitedStatus")).toBe("limit-reached")
    expect(resultNumber(result, "limitedElapsed")).toBe(240_000)
    expect(resultString(result, "compacted")).toContain("Preserve the entire approval boundary")
    expect(resultString(result, "migratedStatus")).toBe("active")
    expect(resultNumber(result, "migratedElapsed")).toBe(900_000)
    expect(resultBoolean(result, "migratedIncomplete")).toBe(true)
  })

  test("requires every method and exception to match the revised contract", async () => {
    const result = await runAcePluginScenario(REVISION_SCENARIO)

    expect(resultNumber(result, "invalidated")).toBe(2)
    expect(resultBoolean(result, "exceptionCleared")).toBe(true)
    expect(resultString(result, "partial")).toContain("Criterion C1 is active")
    expect(resultString(result, "currentC1")).toBe("satisfied")
    expect(resultString(result, "currentC2")).toBe("active")
    expect(resultString(result, "oldException")).toContain("Criterion C2 is active")
    expect(resultString(result, "closed")).toContain("closed with qualifications")
    expect(resultString(result, "reusedID")).toContain("C2 is retired")
    expect(resultString(result, "retiredReadable")).toContain('"retiredCriteria"')
    expect(resultString(result, "pausedTool")).toContain("mission is paused")
    expect(resultString(result, "pausedControl")).toBe("NO_ERROR")
    expect(resultNumber(result, "changedArtifactStalls")).toBe(0)
    expect(resultNumber(result, "repeatedArtifactStalls")).toBe(1)
  })

  test("repairs evidence, source, milestone, manual, and continuation boundaries", async () => {
    const result = await runAcePluginScenario(REPAIR_SCENARIO)

    expect(resultString(result, "mismatch")).toContain(
      "sourceIdentity mismatch",
    )
    expect(resultNumber(result, "replacementCurrent")).toBe(2)
    expect(resultNumber(result, "replacementC2Refs")).toBe(1)
    expect(resultBoolean(result, "refsResolve")).toBe(true)
    expect(resultString(result, "failingState")).toBe("active")
    expect(resultNumber(result, "duplicateStalls")).toBe(1)
    expect(resultString(result, "baselineStrict")).toContain(
      "Criterion C2 is active",
    )
    expect(resultString(result, "qualified")).toContain(
      "closed with qualifications",
    )
    expect(resultString(result, "qualifiedMilestone")).toBe("closed")
    expect(resultString(result, "exceptionDecision")).toBe("user-accept-1")
    expect(resultString(result, "terminalRevision")).toContain(
      "Cannot revise a completed",
    )
    expect(resultString(result, "cycle")).toContain("dependency cycle")
    expect(resultNumber(result, "prompts")).toBe(1)
    expect(resultString(result, "allowedStatus")).toBe("active")
    expect(resultString(result, "toolBoundary")).toBe("NO_ERROR")
    expect(resultString(result, "rejectedStatus")).toBe("limit-reached")
    expect(resultString(result, "noMission")).toBe(
      "No Ace mission exists for this session.",
    )
    expect(resultString(result, "manualStatus")).toContain(
      "Source identity: artifact-v1",
    )
    expect(resultString(result, "manualSource")).toBe("artifact-v2")
    expect(resultString(result, "manualClear")).toBe(
      "Ace state cleared for this session.",
    )
    expect(resultNumber(result, "boundedSummaryBytes")).toBeLessThan(4096)
    expect(resultString(result, "boundedSummary")).toContain(
      "Criteria (81 total)",
    )
    expect(resultString(result, "boundedSummary")).toContain("Window:")
    expect(resultString(result, "boundedSummary")).toContain("Blockers:")
    expect(resultString(result, "boundedSummary")).toContain("Next:")
    expect(resultString(result, "deletionStatus")).toContain(
      "Status: limit-reached",
    )
  })
})

describe("Repository releases", () => {
  test("accepts stable and prerelease SemVer", () => {
    expect(requireReleaseVersion("0.1.0")).toBe("0.1.0")
    expect(requireReleaseVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1")
  })

  test("rejects ambiguous or prefixed versions", () => {
    for (const value of [
      "v1.2.3",
      "1.2",
      "01.2.3",
      "1.2.3-beta.01",
      "latest",
      undefined,
    ]) {
      expect(() => requireReleaseVersion(value)).toThrow("valid SemVer")
    }
  })
})
