import { createHash } from "node:crypto"
import { execFile as execFileCallback } from "node:child_process"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { isAbsolute, join, relative, sep } from "node:path"
import { promisify } from "node:util"
import { type Plugin, tool } from "@opencode-ai/plugin"

type AceMode = "deliver" | "learn" | "explore" | "decide"
type AceStatus =
  | "active"
  | "paused"
  | "blocked"
  | "limit-reached"
  | "completed"
  | "cancelled"
type CriterionState =
  | "pending"
  | "active"
  | "satisfied"
  | "verification-stale"
  | "blocked"
  | "external"
  | "baseline-qualified"
  | "accepted-exception"
type MilestoneState = "pending" | "active" | "closed"
type SourceIdentity = {
  kind: "git" | "manual"
  value: string
  freshnessPolicy: string
  head?: string | undefined
}
type UserDecision = {
  decisionReference: string
  approver: string
  decidedAt: string
}
type Criterion = {
  id: string
  text: string
  state: CriterionState
  evidenceIDs: string[]
  verifiedSourceIdentity?: string | undefined
  verifiedAt?: string | undefined
  reason?: string | undefined
  exception?:
    | (UserDecision & {
        limitation: string
        sourceIdentity: string
        criterionText: string
      })
    | undefined
}
type Evidence = {
  id: string
  criterionIDs: string[]
  method: string
  result: string
  summary: string
  sourceIdentity: string
  recordedAt: string
  supersedes: string[]
  invalidatedAt?: string | undefined
}
type Audit = {
  id: string
  type: string
  recordedAt: string
  summary: string
  decision?: UserDecision | undefined
}
type Milestone = {
  id: string
  outcome: string
  criterionIDs: string[]
  fileScope: string[]
  verification: string
  dependsOn: string[]
  reviewUnit: string
  branchName: string
  authorizationState: string
  state: MilestoneState
  verifiedAt?: string | undefined
}
type Window = {
  id: string
  startedAt: string
  endedAt?: string | undefined
  elapsedMilliseconds: number
  maxMinutes: number
  maxContinuations: number
  automaticContinuations: number
  warningIssued: boolean
  resumeDecision?: UserDecision | undefined
}
type State = {
  version: 2
  projectID: string
  sessionID: string
  mode: AceMode
  objective: string
  constraints: string[]
  verificationPlan: string[]
  criteria: Criterion[]
  retiredCriteria: Criterion[]
  milestones: Milestone[]
  deliveryPlanRequired: boolean
  source: SourceIdentity
  status: AceStatus
  executionWindows: Window[]
  lifetimeTimingComplete: boolean
  automaticContinuationCount: number
  iterationCount: number
  lastProgressSourceIdentity?: string | undefined
  userResumptionCount: number
  stallCount: number
  maxStalls: number
  revision: number
  currentEvidence: Evidence[]
  evidenceHistory: Evidence[]
  audit: Audit[]
  lastHandledMessageID?: string | undefined
  suppressNextContinuation?: boolean | undefined
  latestSummary?: string | undefined
  nextAction?: string | undefined
  stopReason?: string | undefined
  finalVerification?: string | undefined
  closeQualification?: UserDecision | undefined
  createdAt: string
  updatedAt: string
}
type CurrentState = {
  version: 2
  view: "current"
  history: {
    full: "Use ace_status with detail=full."
    audit: "Use ace_status with detail=audit."
  }
  projectID: string
  sessionID: string
  mode: AceMode
  objective: string
  constraints: string[]
  verificationPlan: string[]
  criteria: Criterion[]
  milestones: Milestone[]
  deliveryPlanRequired: boolean
  source: SourceIdentity
  status: AceStatus
  blocker: string
  currentExecutionWindow: Window & { measuredElapsedMilliseconds: number }
  lifetime: {
    knownElapsedMilliseconds: number
    timingComplete: boolean
    executionWindowCount: number
    automaticContinuationCount: number
    iterationCount: number
    userResumptionCount: number
    stallCount: number
    maxStalls: number
  }
  currentEvidence: Evidence[]
  revision: number
  lastProgressSourceIdentity?: string | undefined
  latestSummary?: string | undefined
  nextAction?: string | undefined
  stopReason?: string | undefined
  finalVerification?: string | undefined
  closeQualification?: UserDecision | undefined
  createdAt: string
  updatedAt: string
}

const execFile = promisify(execFileCallback)
const MODES: AceMode[] = ["deliver", "learn", "explore", "decide"]
const STATUSES: AceStatus[] = [
  "active",
  "paused",
  "blocked",
  "limit-reached",
  "completed",
  "cancelled",
]
const CRITERION_STATES: CriterionState[] = [
  "pending",
  "active",
  "satisfied",
  "verification-stale",
  "blocked",
  "external",
  "baseline-qualified",
  "accepted-exception",
]
const MILESTONE_STATES: MilestoneState[] = ["pending", "active", "closed"]
const DEFAULT_MAX_CONTINUATIONS = 20
const DEFAULT_MAX_MINUTES = 60
const DEFAULT_MAX_STALLS = 3
const MAX_CONTINUATIONS = 100
const MAX_MINUTES = 480
const MAX_STALLS = 10
const WARNING_PERCENT = 75
const MINUTE = 60_000
const MAX_SUMMARY_BYTES = 4096
const stateRoot =
  process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
const stateDirectory = join(stateRoot, "opencode", "ace")
let storageQueue: Promise<void> = Promise.resolve()
const latestAssistantMessage = new Map<string, string>()

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation)
  storageQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
function now(): string {
  return new Date().toISOString()
}
function safeID(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}
function stateFile(projectID: string, sessionID: string): string {
  return join(stateDirectory, `${safeID(projectID)}--${safeID(sessionID)}.json`)
}
function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
function invalid(path: string, field: string, expected: string): never {
  throw new Error(`Invalid Ace state at ${path}: field ${field} ${expected}`)
}
function id(prefix: string, number: number): string {
  return `${prefix}${number}`
}
function required(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Ace ${field} must not be empty`)
  return trimmed
}
function requiredArray(values: string[], field: string): string[] {
  return values.map((value, index) => required(value, `${field}[${index}]`))
}
function enumValue<T extends string>(
  state: Record<string, unknown>,
  field: string,
  path: string,
  values: readonly T[],
): T {
  const value = state[field]
  const found = values.find((candidate) => candidate === value)
  if (!found) invalid(path, field, `must be one of ${values.join(", ")}`)
  return found
}
function stringValue(
  state: Record<string, unknown>,
  field: string,
  path: string,
): string {
  const value = state[field]
  if (typeof value !== "string" || !value)
    invalid(path, field, "must be a non-empty string")
  return value
}
function optionalString(
  state: Record<string, unknown>,
  field: string,
  path: string,
): string | undefined {
  if (state[field] === undefined) return undefined
  const value = state[field]
  if (typeof value !== "string") invalid(path, field, "must be a string")
  return value
}
function timestamp(
  state: Record<string, unknown>,
  field: string,
  path: string,
): string {
  const value = stringValue(state, field, path)
  if (!Number.isFinite(Date.parse(value)))
    invalid(path, field, "must be a valid timestamp")
  return value
}
function integer(
  state: Record<string, unknown>,
  field: string,
  path: string,
  minimum: number,
): number {
  const value = state[field]
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum)
    invalid(
      path,
      field,
      `must be an integer greater than or equal to ${minimum}`,
    )
  return value
}
function bool(
  state: Record<string, unknown>,
  field: string,
  path: string,
): boolean {
  if (typeof state[field] !== "boolean")
    invalid(path, field, "must be a boolean")
  return state[field]
}
function stringArray(
  state: Record<string, unknown>,
  field: string,
  path: string,
  empty = true,
): string[] {
  const value = state[field]
  if (!Array.isArray(value)) invalid(path, field, "must be an array")
  if (!empty && !value.length)
    invalid(path, field, "must contain at least one item")
  return value.map((item, index) => {
    if (typeof item !== "string" || !item)
      invalid(path, `${field}[${index}]`, "must be a non-empty string")
    return item
  })
}
function records(
  state: Record<string, unknown>,
  field: string,
  path: string,
): Record<string, unknown>[] {
  const value = state[field]
  if (!Array.isArray(value)) invalid(path, field, "must be an array")
  return value.map((item, index) => {
    if (!isRecord(item))
      invalid(path, `${field}[${index}]`, "must be an object")
    return item
  })
}
function decision(value: unknown, path: string, field: string): UserDecision {
  if (!isRecord(value)) invalid(path, field, "must be an object")
  return {
    decisionReference: stringValue(value, "decisionReference", path),
    approver: stringValue(value, "approver", path),
    decidedAt: timestamp(value, "decidedAt", path),
  }
}
function source(value: unknown, path: string): SourceIdentity {
  if (!isRecord(value)) invalid(path, "source", "must be an object")
  const output: SourceIdentity = {
    kind: enumValue(value, "kind", path, ["git", "manual"] as const),
    value: stringValue(value, "value", path),
    freshnessPolicy: stringValue(value, "freshnessPolicy", path),
  }
  const head = optionalString(value, "head", path)
  if (head) output.head = head
  return output
}
function criterion(value: Record<string, unknown>, path: string): Criterion {
  const output: Criterion = {
    id: stringValue(value, "id", path),
    text: stringValue(value, "text", path),
    state: enumValue(value, "state", path, CRITERION_STATES),
    evidenceIDs: stringArray(value, "evidenceIDs", path),
  }
  const verifiedSourceIdentity = optionalString(
    value,
    "verifiedSourceIdentity",
    path,
  )
  const verifiedAt =
    value.verifiedAt === undefined
      ? undefined
      : timestamp(value, "verifiedAt", path)
  const reason = optionalString(value, "reason", path)
  if (verifiedSourceIdentity)
    output.verifiedSourceIdentity = verifiedSourceIdentity
  if (verifiedAt) output.verifiedAt = verifiedAt
  if (reason) output.reason = reason
  if (value.exception !== undefined) {
    if (!isRecord(value.exception))
      invalid(path, "exception", "must be an object")
    output.exception = {
      ...decision(value.exception, path, "exception"),
      limitation: stringValue(value.exception, "limitation", path),
      sourceIdentity: stringValue(value.exception, "sourceIdentity", path),
      criterionText: stringValue(value.exception, "criterionText", path),
    }
  }
  return output
}
function evidence(
  value: Record<string, unknown>,
  path: string,
  allowUnmapped = false,
): Evidence {
  return {
    id: stringValue(value, "id", path),
    criterionIDs: stringArray(value, "criterionIDs", path, allowUnmapped),
    method: stringValue(value, "method", path),
    result: stringValue(value, "result", path),
    summary: stringValue(value, "summary", path),
    sourceIdentity: stringValue(value, "sourceIdentity", path),
    recordedAt: timestamp(value, "recordedAt", path),
    supersedes: stringArray(value, "supersedes", path),
    invalidatedAt:
      value.invalidatedAt === undefined
        ? undefined
        : timestamp(value, "invalidatedAt", path),
  }
}
function milestone(value: Record<string, unknown>, path: string): Milestone {
  const output: Milestone = {
    id: stringValue(value, "id", path),
    outcome: stringValue(value, "outcome", path),
    criterionIDs: stringArray(value, "criterionIDs", path, false),
    fileScope: stringArray(value, "fileScope", path, false),
    verification: stringValue(value, "verification", path),
    dependsOn: stringArray(value, "dependsOn", path),
    reviewUnit: stringValue(value, "reviewUnit", path),
    branchName: stringValue(value, "branchName", path),
    authorizationState: stringValue(value, "authorizationState", path),
    state: enumValue(value, "state", path, MILESTONE_STATES),
  }
  if (value.verifiedAt !== undefined)
    output.verifiedAt = timestamp(value, "verifiedAt", path)
  return output
}
function window(value: Record<string, unknown>, path: string): Window {
  const output: Window = {
    id: stringValue(value, "id", path),
    startedAt: timestamp(value, "startedAt", path),
    elapsedMilliseconds: integer(value, "elapsedMilliseconds", path, 0),
    maxMinutes: integer(value, "maxMinutes", path, 1),
    maxContinuations: integer(value, "maxContinuations", path, 1),
    automaticContinuations: integer(value, "automaticContinuations", path, 0),
    warningIssued: bool(value, "warningIssued", path),
  }
  if (value.endedAt !== undefined)
    output.endedAt = timestamp(value, "endedAt", path)
  if (value.resumeDecision !== undefined)
    output.resumeDecision = decision(
      value.resumeDecision,
      path,
      "resumeDecision",
    )
  return output
}

function validateExecutionWindows(
  windows: Window[],
  status: AceStatus,
  path: string,
): void {
  const ids = new Set(windows.map((item) => item.id))
  if (ids.size !== windows.length)
    invalid(path, "executionWindows", "must have unique IDs")
  for (const [index, item] of windows.entries()) {
    const startedAt = Date.parse(item.startedAt)
    const endedAt = item.endedAt ? Date.parse(item.endedAt) : undefined
    if (endedAt !== undefined && endedAt < startedAt)
      invalid(
        path,
        "executionWindows",
        `window ${item.id} ends before it starts`,
      )
    if (index < windows.length - 1 && endedAt === undefined)
      invalid(
        path,
        "executionWindows",
        `prior window ${item.id} must be closed`,
      )
    const prior = windows[index - 1]
    if (
      prior?.endedAt !== undefined &&
      startedAt < Date.parse(prior.endedAt)
    )
      invalid(
        path,
        "executionWindows",
        `window ${item.id} starts before prior window ${prior.id} ends`,
      )
  }
  const last = windows[windows.length - 1]!
  if (status === "active" && last.endedAt !== undefined)
    invalid(path, "executionWindows", "last window must be open when active")
  if (status !== "active" && last.endedAt === undefined)
    invalid(
      path,
      "executionWindows",
      `last window must be closed when status is ${status}`,
    )
}

function validateMilestoneDependencies(
  milestones: Milestone[],
  path: string,
): void {
  const byID = new Map(milestones.map((item) => [item.id, item]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (milestoneID: string): void => {
    if (visiting.has(milestoneID))
      invalid(
        path,
        "milestones",
        `contains a dependency cycle at ${milestoneID}`,
      )
    if (visited.has(milestoneID)) return
    visiting.add(milestoneID)
    const item = byID.get(milestoneID)
    if (!item)
      invalid(path, "milestones", `references unknown milestone ${milestoneID}`)
    for (const dependency of item.dependsOn) visit(dependency)
    visiting.delete(milestoneID)
    visited.add(milestoneID)
  }

  for (const item of milestones) visit(item.id)
}

function migrateV1(
  value: Record<string, unknown>,
  path: string,
  projectID: string,
  sessionID: string,
  currentSource: SourceIdentity,
): State {
  if (integer(value, "version", path, 1) !== 1)
    invalid(path, "version", "must be 1")
  if (stringValue(value, "projectID", path) !== projectID)
    invalid(path, "projectID", `must match ${JSON.stringify(projectID)}`)
  if (stringValue(value, "sessionID", path) !== sessionID)
    invalid(path, "sessionID", `must match ${JSON.stringify(sessionID)}`)
  const oldEvidence = records(value, "evidence", path).map((entry) => ({
    note: stringValue(entry, "note", path),
    recordedAt: timestamp(entry, "recordedAt", path),
  }))
  const status = enumValue(value, "status", path, STATUSES)
  const updatedAt = timestamp(value, "updatedAt", path)
  const startedAt = timestamp(value, "budgetStartedAt", path)
  const time = now()
  const activeMigration = status === "active"
  return {
    version: 2,
    projectID,
    sessionID,
    mode: enumValue(value, "mode", path, MODES),
    objective: stringValue(value, "objective", path),
    constraints: stringArray(value, "constraints", path),
    verificationPlan: stringArray(value, "verificationPlan", path, false),
    criteria: stringArray(value, "acceptanceCriteria", path, false).map(
      (text, index) => ({
        id: id("C", index + 1),
        text,
        state: "pending",
        evidenceIDs: [],
      }),
    ),
    retiredCriteria: [],
    milestones: [],
    deliveryPlanRequired: false,
    source: currentSource,
    status: status === "completed" ? "paused" : status,
    executionWindows: [
      {
        id: "W1",
        startedAt: activeMigration ? updatedAt : startedAt,
        ...(status === "active" ? {} : { endedAt: updatedAt }),
        elapsedMilliseconds: Math.max(
          0,
          Date.parse(updatedAt) - Date.parse(startedAt),
        ),
        maxMinutes: integer(value, "maxMinutes", path, 1),
        maxContinuations: integer(value, "maxContinuations", path, 1),
        automaticContinuations: integer(value, "continuationCount", path, 0),
        warningIssued: false,
      },
    ],
    lifetimeTimingComplete: false,
    automaticContinuationCount: integer(value, "continuationCount", path, 0),
    iterationCount: 0,
    userResumptionCount: 0,
    stallCount: integer(value, "stallCount", path, 0),
    maxStalls: integer(value, "maxStalls", path, 1),
    revision: integer(value, "revision", path, 1) + 1,
    currentEvidence: [],
    evidenceHistory: oldEvidence.map((entry, index) => ({
      id: id("L", index + 1),
      criterionIDs: [],
      method: "legacy-unstructured",
      result: "unverified",
      summary: entry.note,
      sourceIdentity: "legacy-unverified",
      recordedAt: entry.recordedAt,
      supersedes: [],
    })),
    audit: [
      {
        id: "A1",
        type: "migration",
        recordedAt: time,
        summary:
          "Migrated version-1 state. Legacy evidence is audit-only, and lifetime timing is incomplete because older execution windows were not retained.",
      },
    ],
    lastHandledMessageID: optionalString(value, "lastHandledMessageID", path),
    suppressNextContinuation:
      value.suppressNextContinuation === undefined
        ? undefined
        : bool(value, "suppressNextContinuation", path),
    latestSummary: optionalString(value, "latestSummary", path),
    nextAction: optionalString(value, "nextAction", path),
    stopReason:
      optionalString(value, "stopReason", path) ??
      (status === "completed"
        ? "Version-1 completion requires structured proof before closing."
        : undefined),
    finalVerification: optionalString(value, "finalVerification", path),
    createdAt: timestamp(value, "createdAt", path),
    updatedAt: time,
  }
}
function parseState(
  content: string,
  path: string,
  projectID: string,
  sessionID: string,
  currentSource: SourceIdentity,
): State {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    invalid(
      path,
      "JSON",
      `could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!isRecord(value)) invalid(path, "root", "must be an object")
  if (value.version === 1)
    return migrateV1(value, path, projectID, sessionID, currentSource)
  if (value.version !== 2) invalid(path, "version", "must be 2")
  if (stringValue(value, "projectID", path) !== projectID)
    invalid(path, "projectID", `must match ${JSON.stringify(projectID)}`)
  if (stringValue(value, "sessionID", path) !== sessionID)
    invalid(path, "sessionID", `must match ${JSON.stringify(sessionID)}`)
  const criteria = records(value, "criteria", path).map((entry) =>
    criterion(entry, path),
  )
  const retiredCriteria =
    value.retiredCriteria === undefined
      ? []
      : records(value, "retiredCriteria", path).map((entry) =>
          criterion(entry, path),
        )
  const criteriaIDs = new Set(criteria.map((item) => item.id))
  const allCriteriaIDs = new Set(
    [...criteria, ...retiredCriteria].map((item) => item.id),
  )
  if (
    criteriaIDs.size !== criteria.length ||
    allCriteriaIDs.size !== criteria.length + retiredCriteria.length
  )
    invalid(path, "criteria", "must have unique IDs")
  const milestones = records(value, "milestones", path).map((entry) =>
    milestone(entry, path),
  )
  const milestoneIDs = new Set(milestones.map((item) => item.id))
  if (milestoneIDs.size !== milestones.length)
    invalid(path, "milestones", "must have unique IDs")
  for (const item of milestones) {
    for (const criterionID of item.criterionIDs)
      if (!criteriaIDs.has(criterionID))
        invalid(
          path,
          "milestones",
          `references unknown criterion ${criterionID}`,
        )
    for (const dependency of item.dependsOn)
      if (!milestoneIDs.has(dependency) || dependency === item.id)
        invalid(path, "milestones", `has invalid dependency ${dependency}`)
  }
  validateMilestoneDependencies(milestones, path)
  const currentEvidence = records(value, "currentEvidence", path).map((entry) =>
    evidence(entry, path),
  )
  const evidenceHistory = records(value, "evidenceHistory", path).map((entry) =>
    evidence(entry, path, true),
  )
  for (const item of [...currentEvidence, ...evidenceHistory])
    for (const criterionID of item.criterionIDs)
      if (!allCriteriaIDs.has(criterionID))
        invalid(path, "evidence", `references unknown criterion ${criterionID}`)
  const currentEvidenceIDs = new Set(currentEvidence.map((item) => item.id))
  if (currentEvidenceIDs.size !== currentEvidence.length)
    invalid(path, "currentEvidence", "must have unique IDs")
  for (const item of criteria)
    for (const evidenceID of item.evidenceIDs)
      if (!currentEvidenceIDs.has(evidenceID))
        invalid(
          path,
          "criteria",
          `references missing current evidence ${evidenceID}`,
        )
  const audit = records(value, "audit", path).map((entry, index) => ({
    id: stringValue(entry, "id", path),
    type: stringValue(entry, "type", path),
    recordedAt: timestamp(entry, "recordedAt", path),
    summary: stringValue(entry, "summary", path),
    ...(entry.decision === undefined
      ? {}
      : {
          decision: decision(entry.decision, path, `audit[${index}].decision`),
        }),
  }))
  const executionWindows = records(value, "executionWindows", path).map(
    (entry) => window(entry, path),
  )
  if (!executionWindows.length)
    invalid(path, "executionWindows", "must contain at least one item")
  const status = enumValue(value, "status", path, STATUSES)
  validateExecutionWindows(executionWindows, status, path)
  const output: State = {
    version: 2,
    projectID,
    sessionID,
    mode: enumValue(value, "mode", path, MODES),
    objective: stringValue(value, "objective", path),
    constraints: stringArray(value, "constraints", path),
    verificationPlan: stringArray(value, "verificationPlan", path, false),
    criteria,
    retiredCriteria,
    milestones,
    deliveryPlanRequired: bool(value, "deliveryPlanRequired", path),
    source: source(value.source, path),
    status,
    executionWindows,
    lifetimeTimingComplete:
      value.lifetimeTimingComplete === undefined
        ? true
        : bool(value, "lifetimeTimingComplete", path),
    automaticContinuationCount: integer(
      value,
      "automaticContinuationCount",
      path,
      0,
    ),
    iterationCount: integer(value, "iterationCount", path, 0),
    userResumptionCount: integer(value, "userResumptionCount", path, 0),
    stallCount: integer(value, "stallCount", path, 0),
    maxStalls: integer(value, "maxStalls", path, 1),
    revision: integer(value, "revision", path, 1),
    currentEvidence,
    evidenceHistory,
    audit,
    createdAt: timestamp(value, "createdAt", path),
    updatedAt: timestamp(value, "updatedAt", path),
  }
  for (const key of [
    "lastHandledMessageID",
    "latestSummary",
    "nextAction",
    "stopReason",
    "finalVerification",
    "lastProgressSourceIdentity",
  ] as const) {
    const item = optionalString(value, key, path)
    if (item !== undefined) output[key] = item
  }
  if (value.suppressNextContinuation !== undefined)
    output.suppressNextContinuation = bool(
      value,
      "suppressNextContinuation",
      path,
    )
  if (value.closeQualification !== undefined)
    output.closeQualification = decision(
      value.closeQualification,
      path,
      "closeQualification",
    )
  if (output.deliveryPlanRequired && !output.milestones.length)
    invalid(
      path,
      "milestones",
      "must be present when deliveryPlanRequired is true",
    )
  return output
}

async function gitSource(
  directory: string,
): Promise<SourceIdentity | undefined> {
  let inside: string
  try {
    const result = await execFile(
      "git",
      ["-C", directory, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8" },
    )
    inside = result.stdout
  } catch {
    return undefined
  }
  if (inside.trim() !== "true") return undefined

  try {
    const { stdout: rootResult } = await execFile(
      "git",
      ["-C", directory, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    )
    const root = rootResult.trim()
    const [{ stdout: headResult }, { stdout: filesResult }] = await Promise.all(
      [
        execFile("git", ["-C", root, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).catch(() => ({ stdout: "unborn\n" })),
        execFile(
          "git",
          ["-C", root, "ls-files", "-co", "--exclude-standard", "-z"],
          { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
        ),
      ],
    )
    const hash = createHash("sha256")
    const paths = Buffer.from(filesResult)
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .sort()
    const statePath = relative(root, stateDirectory)
    const statePathIsInside =
      statePath !== "" &&
      statePath !== ".." &&
      !statePath.startsWith(`..${sep}`) &&
      !isAbsolute(statePath)
    for (const relativePath of paths) {
      if (
        statePathIsInside &&
        (relativePath === statePath ||
          relativePath.startsWith(`${statePath}${sep}`))
      )
        continue
      hash.update(relativePath).update("\0")
      try {
        hash.update(await readFile(join(root, relativePath)))
      } catch (error) {
        if (!isMissing(error)) throw error
        hash.update("<deleted>")
      }
      hash.update("\0")
    }
    const head = String(headResult).trim()
    return {
      kind: "git",
      value: `git:${head}:worktree:${hash.digest("hex")}`,
      head,
      freshnessPolicy:
        "Git HEAD plus tracked and non-ignored untracked source content. Ignored files, .git internals, and Ace state are excluded.",
    }
  } catch (error) {
    throw new Error(
      `Could not capture Ace Git source identity for ${directory}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
async function captureSource(
  directory: string,
  manual?: SourceIdentity,
): Promise<SourceIdentity> {
  const detected = await gitSource(directory)
  if (detected) return detected
  if (!manual || manual.kind !== "manual")
    throw new Error(
      "Ace requires sourceIdentity { value, freshnessPolicy } outside a Git worktree; freshness cannot be inferred automatically.",
    )
  return manual
}
function sameSource(left: SourceIdentity, right: SourceIdentity): boolean {
  return left.kind === right.kind && left.value === right.value
}
function activeWindow(state: State): Window {
  return state.executionWindows[state.executionWindows.length - 1]!
}
function elapsed(window: Window): number {
  return (
    window.elapsedMilliseconds +
    (window.endedAt
      ? 0
      : Math.max(0, Date.now() - Date.parse(window.startedAt)))
  )
}
function lifetime(state: State): number {
  return state.executionWindows.reduce(
    (total, item) => total + elapsed(item),
    0,
  )
}
function closed(window: Window): Window {
  return { ...window, elapsedMilliseconds: elapsed(window), endedAt: now() }
}
function audit(
  state: State,
  type: string,
  summary: string,
  userDecision?: UserDecision,
): State {
  return {
    ...state,
    audit: [
      ...state.audit,
      {
        id: id("A", state.audit.length + 1),
        type,
        recordedAt: now(),
        summary,
        ...(userDecision ? { decision: userDecision } : {}),
      },
    ],
  }
}
function stale(state: State, nextSource: SourceIdentity): State {
  if (state.status === "completed" || state.status === "cancelled") return state
  const criteria = state.criteria.map((item) => {
    const hasSourceBoundClaim =
      item.evidenceIDs.length > 0 || item.exception !== undefined
    return !hasSourceBoundClaim
      ? item
      : {
          ...item,
          state: "verification-stale" as const,
          reason:
            "Source identity changed; proof and exceptions require fresh verification or explicit reconfirmation.",
        }
  })
  const staleCriteria = new Set(
    criteria
      .filter((item) => item.state === "verification-stale")
      .map((item) => item.id),
  )
  const milestones = state.milestones.map((item) =>
    item.criterionIDs.some((criterionID) => staleCriteria.has(criterionID))
      ? { ...item, state: "pending" as const, verifiedAt: undefined }
      : item,
  )
  return audit(
    {
      ...state,
      source: nextSource,
      criteria,
      milestones,
      revision: state.revision + 1,
      updatedAt: now(),
    },
    "source-changed",
    "Source identity changed. Current criterion proof requiring that source is stale.",
  )
}
function enforce(state: State): State {
  if (state.status !== "active") return state
  const current = activeWindow(state)
  let output = state
  if (
    elapsed(current) >= (current.maxMinutes * MINUTE * WARNING_PERCENT) / 100 &&
    !current.warningIssued
  )
    output = audit(
      {
        ...output,
        executionWindows: [
          ...output.executionWindows.slice(0, -1),
          { ...current, warningIssued: true },
        ],
        revision: output.revision + 1,
        updatedAt: now(),
      },
      "budget-warning",
      `Execution window reached ${WARNING_PERCENT}% of its time budget.`,
    )
  const windowNow = activeWindow(output)
  const reason =
    elapsed(windowNow) >= windowNow.maxMinutes * MINUTE
      ? `Reached the ${windowNow.maxMinutes}-minute Ace execution-window limit`
      : undefined
  return reason
    ? audit(
        {
          ...output,
          status: "limit-reached",
          stopReason: reason,
          executionWindows: [
            ...output.executionWindows.slice(0, -1),
            closed(windowNow),
          ],
          revision: output.revision + 1,
          updatedAt: now(),
        },
        "limit-reached",
        reason,
      )
    : output
}
async function load(
  projectID: string,
  sessionID: string,
  directory: string,
  manual?: SourceIdentity,
): Promise<State> {
  const path = stateFile(projectID, sessionID)
  const content = await readFile(path, "utf8")
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    raw = undefined
  }
  const persistedSource =
    isRecord(raw) && raw.version === 2 ? source(raw.source, path) : undefined
  const sourceIdentity = await captureSource(
    directory,
    manual ??
      (persistedSource?.kind === "manual" ? persistedSource : undefined),
  )
  const state = parseState(content, path, projectID, sessionID, sourceIdentity)
  return !sameSource(state.source, sourceIdentity)
    ? stale(state, sourceIdentity)
    : state
}
async function write(state: State): Promise<void> {
  await mkdir(stateDirectory, { recursive: true })
  const destination = stateFile(state.projectID, state.sessionID)
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  await rename(temporary, destination)
}
async function stateOp<T>(
  projectID: string,
  sessionID: string,
  directory: string,
  operation: (
    state: State,
  ) => Promise<{ state: State; result: T }> | { state: State; result: T },
  allowLimited = false,
  manual?: SourceIdentity,
  verifySourceBeforeWrite = false,
): Promise<T> {
  return serialized(async () => {
    let state: State
    try {
      state = await load(projectID, sessionID, directory, manual)
    } catch (error) {
      if (isMissing(error))
        throw new Error("No Ace mission exists for this session")
      throw error
    }
    const guarded = enforce(state)
    await write(guarded)
    if (guarded.status === "limit-reached" && !allowLimited)
      throw new Error(
        `${guarded.stopReason}. The limit state is persisted; use ace_pause, ace_cancel, ace_resume with user authorization, or ace_close_with_qualifications.`,
      )
    const output = await operation(guarded)
    if (verifySourceBeforeWrite) {
      const actualSource = await captureSource(
        directory,
        output.state.source.kind === "manual" ? output.state.source : undefined,
      )
      if (!sameSource(output.state.source, actualSource))
        throw new Error(
          `Ace source changed while evidence was being recorded. Expected ${output.state.source.value}, found ${actualSource.value}; rerun verification against the current source.`,
        )
    }
    await write(output.state)
    return output.result
  })
}
function clamp(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.max(1, Math.min(Math.trunc(value), maximum))
}
function bounded(value: string): string {
  if (Buffer.byteLength(value) < MAX_SUMMARY_BYTES) return value
  const suffix = "\n[output truncated]"
  let end = value.length
  while (
    end > 0 &&
    Buffer.byteLength(value.slice(0, end) + suffix) >= MAX_SUMMARY_BYTES
  )
    end -= 1
  return value.slice(0, end) + suffix
}
function short(value: string | undefined, maximum = 280): string | undefined {
  if (!value) return undefined
  if (Buffer.byteLength(value) <= maximum) return value
  const suffix = "..."
  let end = value.length
  while (end > 0 && Buffer.byteLength(value.slice(0, end) + suffix) > maximum)
    end -= 1
  return value.slice(0, end) + suffix
}
function criteriaCounts(state: State): string {
  const counts = new Map<CriterionState, number>()
  for (const item of state.criteria)
    counts.set(item.state, (counts.get(item.state) ?? 0) + 1)
  return CRITERION_STATES.filter((item) => counts.has(item))
    .map((item) => `${item}=${counts.get(item)}`)
    .join(", ")
}
function blockerSummary(state: State): string {
  const blocked = state.criteria.filter((item) =>
    ["blocked", "external", "verification-stale"].includes(item.state),
  )
  if (!blocked.length) return state.stopReason ?? "none"
  const first = blocked[0]!
  return `${blocked.length} criterion blocker(s); first ${short(first.id, 80)}: ${short(first.reason ?? first.state, 180)}`
}
function currentState(state: State): CurrentState {
  const window = activeWindow(state)
  return {
    version: state.version,
    view: "current",
    history: {
      full: "Use ace_status with detail=full.",
      audit: "Use ace_status with detail=audit.",
    },
    projectID: state.projectID,
    sessionID: state.sessionID,
    mode: state.mode,
    objective: state.objective,
    constraints: state.constraints,
    verificationPlan: state.verificationPlan,
    criteria: state.criteria,
    milestones: state.milestones,
    deliveryPlanRequired: state.deliveryPlanRequired,
    source: state.source,
    status: state.status,
    blocker: blockerSummary(state),
    currentExecutionWindow: {
      ...window,
      measuredElapsedMilliseconds: elapsed(window),
    },
    lifetime: {
      knownElapsedMilliseconds: lifetime(state),
      timingComplete: state.lifetimeTimingComplete,
      executionWindowCount: state.executionWindows.length,
      automaticContinuationCount: state.automaticContinuationCount,
      iterationCount: state.iterationCount,
      userResumptionCount: state.userResumptionCount,
      stallCount: state.stallCount,
      maxStalls: state.maxStalls,
    },
    currentEvidence: state.currentEvidence,
    revision: state.revision,
    lastProgressSourceIdentity: state.lastProgressSourceIdentity,
    latestSummary: state.latestSummary,
    nextAction: state.nextAction,
    stopReason: state.stopReason,
    finalVerification: state.finalVerification,
    closeQualification: state.closeQualification,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  }
}
function summary(state: State): string {
  const window = activeWindow(state)
  return bounded(
    [
      `Status: ${state.status}`,
      `Criteria (${state.criteria.length} total): ${criteriaCounts(state)}`,
      `Window: ${Math.floor(elapsed(window) / MINUTE)}/${window.maxMinutes} minutes; automatic continuations: ${window.automaticContinuations}/${window.maxContinuations}`,
      `Lifetime known usage: ${Math.floor(lifetime(state) / MINUTE)} minutes across ${state.executionWindows.length} windows${state.lifetimeTimingComplete ? "" : "; historical total incomplete"}; iterations: ${state.iterationCount}; user resumptions: ${state.userResumptionCount}`,
      `Blockers: ${short(blockerSummary(state), 400)}`,
      `Next: ${short(state.nextAction, 400) ?? "none"}`,
      window.warningIssued && state.status === "active"
        ? `Budget warning: ${WARNING_PERCENT}% of the execution window is used.`
        : undefined,
      `Mode: ${state.mode}`,
      `Current evidence: ${state.currentEvidence.length}; audit evidence: ${state.evidenceHistory.length}`,
      `Source identity: ${short(state.source.value, 500)}`,
      `Ace mission: ${short(state.objective, 500)}`,
      state.latestSummary ? `Latest: ${short(state.latestSummary)}` : undefined,
      state.stopReason ? `Stop reason: ${short(state.stopReason)}` : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  )
}
function criteriaView(state: State): string {
  return `${summary(state)}\n\n${state.criteria.map((item) => `${item.id} | ${item.state} | ${item.text}${item.reason ? ` | ${item.reason}` : ""} | evidence=${item.evidenceIDs.join(",") || "none"}`).join("\n")}`
}
function compact(state: State, message: string): string {
  const window = activeWindow(state)
  return bounded(
    `${short(message, 300)}\nStatus: ${state.status}\nCriteria (${state.criteria.length} total): ${criteriaCounts(state)}\nBudget: ${Math.floor(elapsed(window) / MINUTE)}/${window.maxMinutes} minutes; continuations ${window.automaticContinuations}/${window.maxContinuations}\nBlockers: ${short(blockerSummary(state), 400)}\nNext: ${short(state.nextAction, 400) ?? "none"}`,
  )
}
function active(state: State): void {
  if (state.status !== "active")
    throw new Error(`Ace mission is ${state.status}, not active`)
}
function userDecision(input: {
  decisionReference: string
  approver: string
  decidedAt: string
}): UserDecision {
  const decidedAt = required(input.decidedAt, "decidedAt")
  if (!Number.isFinite(Date.parse(decidedAt)))
    throw new Error("Ace decidedAt must be a valid timestamp")
  return {
    decisionReference: required(input.decisionReference, "decisionReference"),
    approver: required(input.approver, "approver"),
    decidedAt,
  }
}
function normalizeCriteria(
  input: Array<{ id: string; text: string }>,
): Criterion[] {
  const seen = new Set<string>()
  return input.map((item) => {
    const criterionID = required(item.id, "criteria.id")
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(criterionID))
      throw new Error(
        `Ace criterion ID ${criterionID} must use letters, digits, hyphens, or underscores and start with a letter`,
      )
    if (seen.has(criterionID))
      throw new Error(`Ace criterion ID ${criterionID} is duplicated`)
    seen.add(criterionID)
    return {
      id: criterionID,
      text: required(item.text, `criterion ${criterionID}`),
      state: "pending",
      evidenceIDs: [],
    }
  })
}
function normalizeMilestones(
  input: Array<{
    id: string
    outcome: string
    criterionIDs: string[]
    fileScope: string[]
    verification: string
    dependsOn?: string[] | undefined
    reviewUnit: string
    branchName: string
    authorizationState: string
  }>,
  criteria: Criterion[],
): Milestone[] {
  const validCriteria = new Set(criteria.map((item) => item.id))
  const ids = new Set<string>()
  const output = input.map((item) => {
    const milestoneID = required(item.id, "milestone.id")
    if (ids.has(milestoneID))
      throw new Error(`Ace milestone ID ${milestoneID} is duplicated`)
    ids.add(milestoneID)
    const criterionIDs = requiredArray(
      item.criterionIDs,
      `milestone ${milestoneID}.criterionIDs`,
    )
    for (const criterionID of criterionIDs)
      if (!validCriteria.has(criterionID))
        throw new Error(
          `Ace milestone ${milestoneID} references unknown criterion ${criterionID}`,
        )
    return {
      id: milestoneID,
      outcome: required(item.outcome, `milestone ${milestoneID}.outcome`),
      criterionIDs,
      fileScope: requiredArray(
        item.fileScope,
        `milestone ${milestoneID}.fileScope`,
      ),
      verification: required(
        item.verification,
        `milestone ${milestoneID}.verification`,
      ),
      dependsOn: requiredArray(
        item.dependsOn ?? [],
        `milestone ${milestoneID}.dependsOn`,
      ),
      reviewUnit: required(
        item.reviewUnit,
        `milestone ${milestoneID}.reviewUnit`,
      ),
      branchName: required(
        item.branchName,
        `milestone ${milestoneID}.branchName`,
      ),
      authorizationState: required(
        item.authorizationState,
        `milestone ${milestoneID}.authorizationState`,
      ),
      state: "pending" as const,
    }
  })
  for (const item of output)
    for (const dependency of item.dependsOn)
      if (!ids.has(dependency) || dependency === item.id)
        throw new Error(
          `Ace milestone ${item.id} has invalid dependency ${dependency}`,
        )
  validateMilestoneDependencies(output, "Ace milestone plan")
  return output
}
function manualUpdate(state: State, sourceIdentity: string | undefined): State {
  return state.source.kind !== "manual" ||
    !sourceIdentity ||
    sourceIdentity === state.source.value
    ? state
    : stale(state, {
        ...state.source,
        value: required(sourceIdentity, "sourceIdentity"),
      })
}
function recordEvidence(
  state: State,
  input: {
    criterionIDs: string[]
    method: string
    result: string
    summary: string
  },
): State {
  const criterionIDs = [
    ...new Set(requiredArray(input.criterionIDs, "evidence.criterionIDs")),
  ].sort()
  const valid = new Set(state.criteria.map((item) => item.id))
  for (const criterionID of criterionIDs)
    if (!valid.has(criterionID))
      throw new Error(
        `Ace evidence references unknown criterion ${criterionID}`,
      )
  const method = required(input.method, "evidence.method")
  const result = required(input.result, "evidence.result")
  const evidenceSummary = required(input.summary, "evidence.summary")
  let output = state
  for (const criterionID of criterionIDs) {
    const prior = output.currentEvidence.find(
      (item) =>
        item.method === method &&
        item.criterionIDs.length === 1 &&
        item.criterionIDs[0] === criterionID,
    )
    if (
      prior?.result === result &&
      prior.summary === evidenceSummary &&
      prior.sourceIdentity === output.source.value &&
      !prior.invalidatedAt
    )
      continue
    const sequence = [...output.currentEvidence, ...output.evidenceHistory]
      .map((item) => /^E(\d+)$/.exec(item.id)?.[1])
      .filter((item): item is string => item !== undefined)
      .reduce((maximum, item) => Math.max(maximum, Number(item)), 0)
    const entry: Evidence = {
      id: id("E", sequence + 1),
      criterionIDs: [criterionID],
      method,
      result,
      summary: evidenceSummary,
      sourceIdentity: output.source.value,
      recordedAt: now(),
      supersedes: prior ? [prior.id] : [],
    }
    const currentEvidence = [
      ...output.currentEvidence.filter((item) => item !== prior),
      entry,
    ]
    const currentForCriterion = currentEvidence.filter((item) =>
      item.criterionIDs.includes(criterionID),
    )
    const allPassed = currentForCriterion.every(
      (item) =>
        item.result === "passed" &&
        item.sourceIdentity === output.source.value &&
        !item.invalidatedAt,
    )
    const criterion = output.criteria.find((item) => item.id === criterionID)!
    const nextState: CriterionState = allPassed
      ? "satisfied"
      : criterion.exception?.sourceIdentity === output.source.value &&
          criterion.exception.criterionText === criterion.text
        ? "accepted-exception"
        : "active"
    const criteria = output.criteria.map((item) =>
      item.id === criterionID
        ? {
            ...item,
            state: nextState,
            evidenceIDs: currentForCriterion.map((evidence) => evidence.id),
            verifiedSourceIdentity: entry.sourceIdentity,
            verifiedAt: entry.recordedAt,
            reason: allPassed ? undefined : evidenceSummary,
          }
        : item,
    )
    output = {
      ...output,
      criteria,
      currentEvidence,
      evidenceHistory: prior
        ? [...output.evidenceHistory, prior]
        : output.evidenceHistory,
      revision: output.revision + 1,
      updatedAt: now(),
    }
  }
  if (output === state) return state
  return audit(
    output,
    "evidence-recorded",
    `Current evidence recorded for ${criterionIDs.join(", ")} using ${method}.`,
  )
}
function criterionHasCurrentProof(state: State, item: Criterion): boolean {
  if (item.state !== "satisfied" || item.evidenceIDs.length === 0) return false
  const current = new Map(
    state.currentEvidence.map((entry) => [entry.id, entry]),
  )
  return item.evidenceIDs.every((evidenceID) => {
    const entry = current.get(evidenceID)
    return (
      entry?.result === "passed" &&
      entry.sourceIdentity === state.source.value &&
      !entry.invalidatedAt &&
      entry.criterionIDs.includes(item.id)
    )
  })
}
function criterionHasCurrentException(state: State, item: Criterion): boolean {
  return (
    item.state === "accepted-exception" &&
    item.exception?.sourceIdentity === state.source.value &&
    item.exception.criterionText === item.text
  )
}
function closeQualifiedMilestones(state: State): State {
  let milestones = state.milestones
  let changed = true
  while (changed) {
    changed = false
    milestones = milestones.map((item) => {
      if (item.state === "closed") return item
      const dependenciesClosed = item.dependsOn.every(
        (dependency) =>
          milestones.find((candidate) => candidate.id === dependency)?.state ===
          "closed",
      )
      const criteriaAccepted = item.criterionIDs.every((criterionID) => {
        const criterion = state.criteria.find(
          (candidate) => candidate.id === criterionID,
        )
        return (
          criterion !== undefined &&
          (criterionHasCurrentProof(state, criterion) ||
            criterionHasCurrentException(state, criterion))
        )
      })
      if (!dependenciesClosed || !criteriaAccepted) return item
      changed = true
      return { ...item, state: "closed" as const, verifiedAt: now() }
    })
  }
  return milestones === state.milestones ? state : { ...state, milestones }
}
function completionIssue(state: State, qualified: boolean): string | undefined {
  for (const item of state.criteria) {
    const proof = criterionHasCurrentProof(state, item)
    const exception = qualified && criterionHasCurrentException(state, item)
    if (!proof && !exception)
      return `Criterion ${item.id} is ${item.state} and lacks current proof${qualified ? " or an explicit current exception" : ""}`
  }
  const milestone = state.milestones.find((item) => {
    if (item.state !== "closed" || !item.verifiedAt) return true
    if (
      item.dependsOn.some(
        (dependency) =>
          state.milestones.find((candidate) => candidate.id === dependency)
            ?.state !== "closed",
      )
    )
      return true
    return item.criterionIDs.some((criterionID) => {
      const criterion = state.criteria.find(
        (candidate) => candidate.id === criterionID,
      )
      return (
        criterion === undefined ||
        (!criterionHasCurrentProof(state, criterion) &&
          !(qualified && criterionHasCurrentException(state, criterion)))
      )
    })
  })
  return milestone
    ? `Milestone ${milestone.id} is not closed and verified`
    : undefined
}
async function claim(
  projectID: string,
  sessionID: string,
  directory: string,
  messageID: string,
): Promise<{ state: State; shouldPrompt: boolean }> {
  return serialized(async () => {
    const loaded = await load(projectID, sessionID, directory)
    const guarded = enforce(loaded)
    if (guarded !== loaded) await write(guarded)
    if (
      guarded.status !== "active" ||
      guarded.lastHandledMessageID === messageID
    )
      return { state: guarded, shouldPrompt: false }
    if (guarded.suppressNextContinuation) {
      const suppressed = {
        ...guarded,
        suppressNextContinuation: false,
        lastHandledMessageID: messageID,
        updatedAt: now(),
      }
      await write(suppressed)
      return { state: suppressed, shouldPrompt: false }
    }
    const window = activeWindow(guarded)
    if (window.automaticContinuations >= window.maxContinuations) {
      const reason = `Reached the ${window.maxContinuations}-continuation Ace execution-window limit`
      const limited = audit(
        {
          ...guarded,
          status: "limit-reached",
          stopReason: reason,
          executionWindows: [
            ...guarded.executionWindows.slice(0, -1),
            closed(window),
          ],
          lastHandledMessageID: messageID,
          revision: guarded.revision + 1,
          updatedAt: now(),
        },
        "limit-reached",
        reason,
      )
      await write(limited)
      return { state: limited, shouldPrompt: false }
    }
    const incremented = {
      ...guarded,
      executionWindows: [
        ...guarded.executionWindows.slice(0, -1),
        {
          ...window,
          automaticContinuations: window.automaticContinuations + 1,
        },
      ],
      automaticContinuationCount: guarded.automaticContinuationCount + 1,
      lastHandledMessageID: messageID,
      revision: guarded.revision + 1,
      updatedAt: now(),
    }
    await write(incremented)
    return { state: incremented, shouldPrompt: true }
  })
}
function prompt(state: State): string {
  return `AUTOMATIC ACE CONTINUATION\n\nCurrent Ace state:\n${JSON.stringify(currentState(state), null, 2)}\n\nLoad and obey the ace skill. Continue only safe work toward an unmet criterion. Record structured evidence with ace_progress using the displayed source identity. Completion requires current proof; qualifications require explicit user approval. Retrieve complete persisted state with ace_status detail=full or audit history with ace_status detail=audit.`
}

export const AcePlugin: Plugin = async ({ client, project, directory }) => ({
  event: async ({ event }) => {
    if (
      event.type === "message.updated" &&
      event.properties.info.role === "assistant"
    ) {
      latestAssistantMessage.set(
        event.properties.info.sessionID,
        event.properties.info.id,
      )
      return
    }
    if (event.type !== "session.idle" && event.type !== "session.error") return
    const sessionID = event.properties.sessionID
    if (!sessionID) return
    if (event.type === "session.error") {
      await stateOp(
        project.id,
        sessionID,
        directory,
        (state) => ({
          state: audit(
            {
              ...state,
              status: state.status === "active" ? "blocked" : state.status,
              stopReason:
                state.status === "active"
                  ? `OpenCode session error: ${JSON.stringify(event.properties.error ?? "unknown")}`
                  : state.stopReason,
              executionWindows:
                state.status === "active"
                  ? [
                      ...state.executionWindows.slice(0, -1),
                      closed(activeWindow(state)),
                    ]
                  : state.executionWindows,
              revision: state.revision + 1,
              updatedAt: now(),
            },
            "host-error",
            "OpenCode reported a session error.",
          ),
          result: undefined,
        }),
        true,
      ).catch(() => undefined)
      return
    }
    const messageID = latestAssistantMessage.get(sessionID)
    if (!messageID) {
      await stateOp(
        project.id,
        sessionID,
        directory,
        (state) => ({ state, result: undefined }),
        true,
      ).catch(() => undefined)
      return
    }
    const continuation = await claim(
      project.id,
      sessionID,
      directory,
      messageID,
    ).catch(() => undefined)
    if (!continuation?.shouldPrompt) return
    try {
      await client.session.promptAsync({
        path: { id: sessionID },
        query: { directory },
        body: {
          parts: [
            { type: "text", text: prompt(continuation.state), synthetic: true },
          ],
        },
        throwOnError: true,
      })
    } catch (error) {
      await stateOp(
        project.id,
        sessionID,
        directory,
        (state) => ({
          state: audit(
            {
              ...state,
              status: "blocked",
              stopReason: `Could not submit the next Ace turn: ${error instanceof Error ? error.message : String(error)}`,
              executionWindows:
                state.status === "active"
                  ? [
                      ...state.executionWindows.slice(0, -1),
                      closed(activeWindow(state)),
                    ]
                  : state.executionWindows,
              revision: state.revision + 1,
              updatedAt: now(),
            },
            "continuation-failed",
            "Automatic continuation submission failed.",
          ),
          result: undefined,
        }),
        true,
      ).catch(() => undefined)
    }
  },
  "tool.execute.before": async (input) => {
    const missionControl = input.tool.startsWith("ace_")
    await stateOp(
      project.id,
      input.sessionID,
      directory,
      (state) => {
        if (!missionControl && ["paused", "blocked"].includes(state.status))
          throw new Error(
            `Ace mission is ${state.status}. Use mission controls to record an authorized resume before further work.`,
          )
        return { state, result: undefined }
      },
      missionControl,
    ).catch((error) => {
      if (
        error instanceof Error &&
        error.message === "No Ace mission exists for this session"
      )
        return
      throw error
    })
  },
  "experimental.session.compacting": async (input, output) => {
    const state = await stateOp(
      project.id,
      input.sessionID,
      directory,
      (current) => ({ state: current, result: current }),
      true,
    ).catch(() => undefined)
    if (state && state.status !== "cancelled")
      output.context.push(
        `## Current persistent Ace contract\n${JSON.stringify(currentState(state), null, 2)}\n\nPreserve every constraint and authorization boundary. Retrieve complete persisted state with ace_status detail=full or audit history with ace_status detail=audit.`,
      )
  },
  tool: {
    ace_start: tool({
      description:
        "Start a bounded persistent Ace mission with stable criteria and source identity.",
      args: {
        mode: tool.schema.string().optional(),
        objective: tool.schema.string().min(1),
        acceptanceCriteria: tool.schema
          .array(tool.schema.string().min(1))
          .min(1)
          .optional(),
        criteria: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              text: tool.schema.string().min(1),
            }),
          )
          .min(1)
          .optional(),
        constraints: tool.schema.array(tool.schema.string().min(1)).optional(),
        verificationPlan: tool.schema.array(tool.schema.string().min(1)).min(1),
        milestones: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              outcome: tool.schema.string().min(1),
              criterionIDs: tool.schema
                .array(tool.schema.string().min(1))
                .min(1),
              fileScope: tool.schema.array(tool.schema.string().min(1)).min(1),
              verification: tool.schema.string().min(1),
              dependsOn: tool.schema
                .array(tool.schema.string().min(1))
                .optional(),
              reviewUnit: tool.schema.string().min(1),
              branchName: tool.schema.string().min(1),
              authorizationState: tool.schema.string().min(1),
            }),
          )
          .optional(),
        deliveryPlanRequired: tool.schema.boolean().optional(),
        sourceIdentity: tool.schema
          .object({
            value: tool.schema.string().min(1),
            freshnessPolicy: tool.schema.string().min(1),
          })
          .optional(),
        maxContinuations: tool.schema.number().int().optional(),
        maxMinutes: tool.schema.number().int().optional(),
        maxStalls: tool.schema.number().int().optional(),
        replace: tool.schema.boolean().optional(),
      },
      async execute(args, context) {
        const manual = args.sourceIdentity
          ? {
              kind: "manual" as const,
              value: required(
                args.sourceIdentity.value,
                "sourceIdentity.value",
              ),
              freshnessPolicy: required(
                args.sourceIdentity.freshnessPolicy,
                "sourceIdentity.freshnessPolicy",
              ),
            }
          : undefined
        const old = await stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => ({ state, result: state }),
          true,
          manual,
        ).catch((error) => {
          if (
            error instanceof Error &&
            error.message === "No Ace mission exists for this session"
          )
            return undefined
          throw error
        })
        if (
          old &&
          ["active", "paused", "blocked", "limit-reached"].includes(
            old.status,
          ) &&
          !args.replace
        )
          throw new Error(
            "An unfinished Ace mission exists. Confirm replacement before using replace=true.",
          )
        const sourceIdentity = await captureSource(directory, manual)
        const raw =
          args.criteria ??
          (args.acceptanceCriteria ?? []).map((text, index) => ({
            id: id("C", index + 1),
            text,
          }))
        if (!raw.length)
          throw new Error("Ace requires criteria or acceptanceCriteria")
        const criteria = normalizeCriteria(raw)
        const milestones = normalizeMilestones(args.milestones ?? [], criteria)
        if (args.deliveryPlanRequired && !milestones.length)
          throw new Error(
            "Ace requires milestones when deliveryPlanRequired is true",
          )
        const time = now()
        const state: State = {
          version: 2,
          projectID: project.id,
          sessionID: context.sessionID,
          mode: args.mode
            ? MODES.includes(args.mode as AceMode)
              ? (args.mode as AceMode)
              : (() => {
                  throw new Error(
                    `Ace mode must be one of: ${MODES.join(", ")}`,
                  )
                })()
            : "deliver",
          objective: required(args.objective, "objective"),
          constraints: requiredArray(args.constraints ?? [], "constraints"),
          verificationPlan: requiredArray(
            args.verificationPlan,
            "verificationPlan",
          ),
          criteria,
          retiredCriteria: [],
          milestones,
          deliveryPlanRequired: args.deliveryPlanRequired ?? false,
          source: sourceIdentity,
          status: "active",
          executionWindows: [
            {
              id: "W1",
              startedAt: time,
              elapsedMilliseconds: 0,
              maxMinutes: clamp(
                args.maxMinutes,
                DEFAULT_MAX_MINUTES,
                MAX_MINUTES,
              ),
              maxContinuations: clamp(
                args.maxContinuations,
                DEFAULT_MAX_CONTINUATIONS,
                MAX_CONTINUATIONS,
              ),
              automaticContinuations: 0,
              warningIssued: false,
            },
          ],
          lifetimeTimingComplete: true,
          automaticContinuationCount: 0,
          iterationCount: 0,
          lastProgressSourceIdentity: sourceIdentity.value,
          userResumptionCount: 0,
          stallCount: 0,
          maxStalls: clamp(args.maxStalls, DEFAULT_MAX_STALLS, MAX_STALLS),
          revision: 1,
          currentEvidence: [],
          evidenceHistory: [],
          audit: [
            {
              id: "A1",
              type: "started",
              recordedAt: time,
              summary:
                "Mission started with a source identity and explicit criteria.",
            },
          ],
          nextAction:
            "Inspect current state and begin with the highest-risk unmet criterion.",
          createdAt: time,
          updatedAt: time,
        }
        return serialized(async () => {
          await write(state)
          return compact(state, "Ace mission started")
        })
      },
    }),
    ace_status: tool({
      description:
        "Read Ace state. Current is the routine recovery view; summary, criteria, full, and audit provide other detail levels.",
      args: {
        detail: tool.schema
          .enum(["summary", "current", "criteria", "full", "audit"])
          .optional(),
        suppressContinuation: tool.schema.boolean().optional(),
        sourceIdentity: tool.schema.string().min(1).optional(),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            const sourceChecked = manualUpdate(state, args.sourceIdentity)
            const updated =
              args.suppressContinuation && sourceChecked.status === "active"
                ? {
                    ...sourceChecked,
                    suppressNextContinuation: true,
                    updatedAt: now(),
                  }
                : sourceChecked
            return {
              state: updated,
              result:
                args.detail === "full"
                  ? JSON.stringify(updated, null, 2)
                  : args.detail === "current"
                    ? JSON.stringify(currentState(updated), null, 2)
                  : args.detail === "audit"
                    ? JSON.stringify(
                        {
                          audit: updated.audit,
                          evidenceHistory: updated.evidenceHistory,
                        },
                        null,
                        2,
                      )
                    : args.detail === "criteria"
                      ? criteriaView(updated)
                      : summary(updated),
            }
          },
          true,
        ).catch((error) => {
          if (
            error instanceof Error &&
            error.message === "No Ace mission exists for this session"
          )
            return "No Ace mission exists for this session."
          throw error
        })
      },
    }),
    ace_progress: tool({
      description:
        "Record one bounded iteration, structured current evidence, and the next action.",
      args: {
        summary: tool.schema.string().min(1),
        evidence: tool.schema
          .array(
            tool.schema.object({
              criterionIDs: tool.schema
                .array(tool.schema.string().min(1))
                .min(1),
              method: tool.schema.string().min(1),
              result: tool.schema.string().min(1),
              summary: tool.schema.string().min(1),
            }),
          )
          .optional(),
        criterionStates: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              state: tool.schema
                .enum(["pending", "active", "blocked", "external"])
                .optional(),
              reason: tool.schema.string().min(1).optional(),
            }),
          )
          .optional(),
        milestoneUpdates: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              state: tool.schema.enum(["pending", "active", "closed"]),
            }),
          )
          .optional(),
        madeProgress: tool.schema.boolean(),
        nextAction: tool.schema.string().min(1),
        blocker: tool.schema.string().min(1).optional(),
        sourceIdentity: tool.schema.string().min(1).optional(),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            active(state)
            if ((args.evidence?.length ?? 0) > 0 && !args.sourceIdentity)
              throw new Error(
                "Ace requires the checked sourceIdentity from ace_status when recording evidence.",
              )
            if (
              args.sourceIdentity !== undefined &&
              args.sourceIdentity !== state.source.value
            )
              throw new Error(
                `Ace evidence sourceIdentity mismatch. Expected ${state.source.value}, received ${args.sourceIdentity}; rerun verification against the current source.`,
              )
            let updated = state
            for (const item of args.evidence ?? [])
              updated = recordEvidence(updated, item)
            const known = new Set(updated.criteria.map((item) => item.id))
            for (const change of args.criterionStates ?? [])
              if (!known.has(change.id))
                throw new Error(`Ace criterion ${change.id} does not exist`)
            const criteria = updated.criteria.map((item) => {
              const change = args.criterionStates?.find(
                (candidate) => candidate.id === item.id,
              )
              return !change
                ? item
                : {
                    ...item,
                    state: change.state ?? item.state,
                    reason: change.reason
                      ? required(change.reason, "criterionStates.reason")
                      : item.reason,
                  }
            })
            let milestones = updated.milestones
            for (const change of args.milestoneUpdates ?? []) {
              const item = milestones.find(
                (candidate) => candidate.id === change.id,
              )
              if (!item)
                throw new Error(`Ace milestone ${change.id} does not exist`)
              if (
                change.state === "closed" &&
                item.criterionIDs.some(
                  (criterionID) =>
                    !criterionHasCurrentProof(
                      { ...updated, criteria },
                      criteria.find(
                        (candidate) => candidate.id === criterionID,
                      )!,
                    ),
                )
              )
                throw new Error(
                  `Ace milestone ${change.id} cannot close until its criteria have current proof`,
                )
              if (
                change.state === "closed" &&
                item.dependsOn.some(
                  (dependency) =>
                    milestones.find((candidate) => candidate.id === dependency)
                      ?.state !== "closed",
                )
              )
                throw new Error(
                  `Ace milestone ${change.id} cannot close before its dependencies`,
                )
              milestones = milestones.map((candidate) =>
                candidate.id === change.id
                  ? {
                      ...candidate,
                      state: change.state,
                      ...(change.state === "closed"
                        ? { verifiedAt: now() }
                        : {}),
                    }
                  : candidate,
              )
            }
            const observableProgress =
              (state.lastProgressSourceIdentity !== undefined &&
                state.lastProgressSourceIdentity !== state.source.value) ||
              updated.revision !== state.revision ||
              JSON.stringify(criteria) !== JSON.stringify(state.criteria) ||
              JSON.stringify(milestones) !== JSON.stringify(state.milestones) ||
              (args.blocker !== undefined && args.blocker !== state.stopReason)
            const materialProgress = args.madeProgress && observableProgress
            const stalls = materialProgress ? 0 : updated.stallCount + 1
            const blocked = stalls >= updated.maxStalls
            updated = audit(
              {
                ...updated,
                criteria,
                milestones,
                status: blocked ? "blocked" : "active",
                executionWindows: blocked
                  ? [
                      ...updated.executionWindows.slice(0, -1),
                      closed(activeWindow(updated)),
                    ]
                  : updated.executionWindows,
                stallCount: stalls,
                iterationCount: updated.iterationCount + 1,
                lastProgressSourceIdentity: updated.source.value,
                latestSummary: required(args.summary, "summary"),
                nextAction: required(args.nextAction, "nextAction"),
                stopReason: blocked
                  ? args.blocker
                    ? required(args.blocker, "blocker")
                    : `No material progress for ${stalls} consecutive iterations`
                  : args.blocker
                    ? required(args.blocker, "blocker")
                    : undefined,
                revision: updated.revision + 1,
                updatedAt: now(),
              },
              "progress",
              "Recorded a bounded Ace iteration.",
            )
            return {
              state: updated,
              result: compact(updated, "Ace progress recorded"),
            }
          },
          false,
          undefined,
          (args.evidence?.length ?? 0) > 0,
        )
      },
    }),
    ace_pause: tool({
      description:
        "Pause an Ace mission for consequential user input or authorization.",
      args: { reason: tool.schema.string().min(1) },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (state.status !== "active" && state.status !== "limit-reached")
              throw new Error(`Cannot pause a ${state.status} Ace mission`)
            const updated = audit(
              {
                ...state,
                status: "paused",
                stopReason: required(args.reason, "reason"),
                executionWindows:
                  state.status === "active"
                    ? [
                        ...state.executionWindows.slice(0, -1),
                        closed(activeWindow(state)),
                      ]
                    : state.executionWindows,
                revision: state.revision + 1,
                updatedAt: now(),
              },
              "paused",
              "Mission paused for user input or authorization.",
            )
            return {
              state: updated,
              result: compact(updated, "Ace mission paused"),
            }
          },
          true,
        )
      },
    }),
    ace_resume: tool({
      description:
        "Resume paused, blocked, or limited work only with explicit user authorization and a new execution window.",
      args: {
        nextAction: tool.schema.string().min(1).optional(),
        maxContinuations: tool.schema.number().int().optional(),
        maxMinutes: tool.schema.number().int().optional(),
        maxStalls: tool.schema.number().int().optional(),
        decisionReference: tool.schema.string().min(1),
        approver: tool.schema.string().min(1),
        decidedAt: tool.schema.string().min(1),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (!["paused", "blocked", "limit-reached"].includes(state.status))
              throw new Error(`Cannot resume a ${state.status} Ace mission`)
            const approval = userDecision(args)
            const prior = activeWindow(state)
            const time = now()
            const updated = audit(
              {
                ...state,
                status: "active",
                executionWindows: [
                  ...state.executionWindows,
                  {
                    id: id("W", state.executionWindows.length + 1),
                    startedAt: time,
                    elapsedMilliseconds: 0,
                    maxMinutes: clamp(
                      args.maxMinutes,
                      prior.maxMinutes,
                      MAX_MINUTES,
                    ),
                    maxContinuations: clamp(
                      args.maxContinuations,
                      prior.maxContinuations,
                      MAX_CONTINUATIONS,
                    ),
                    automaticContinuations: 0,
                    warningIssued: false,
                    resumeDecision: approval,
                  },
                ],
                userResumptionCount: state.userResumptionCount + 1,
                stallCount: 0,
                maxStalls: clamp(args.maxStalls, state.maxStalls, MAX_STALLS),
                nextAction: args.nextAction
                  ? required(args.nextAction, "nextAction")
                  : state.nextAction,
                stopReason: undefined,
                revision: state.revision + 1,
                updatedAt: time,
              },
              "resumed",
              "User-authorized execution window resumed.",
              approval,
            )
            return {
              state: updated,
              result: compact(updated, "Ace mission resumed"),
            }
          },
          true,
        )
      },
    }),
    ace_revise: tool({
      description:
        "Apply an audited user-approved contract revision; changed criteria invalidate their proof and exceptions.",
      args: {
        decisionReference: tool.schema.string().min(1),
        approver: tool.schema.string().min(1),
        decidedAt: tool.schema.string().min(1),
        reason: tool.schema.string().min(1),
        objective: tool.schema.string().min(1).optional(),
        criteria: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              text: tool.schema.string().min(1),
            }),
          )
          .min(1)
          .optional(),
        constraints: tool.schema.array(tool.schema.string().min(1)).optional(),
        verificationPlan: tool.schema
          .array(tool.schema.string().min(1))
          .min(1)
          .optional(),
        milestones: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1),
              outcome: tool.schema.string().min(1),
              criterionIDs: tool.schema
                .array(tool.schema.string().min(1))
                .min(1),
              fileScope: tool.schema.array(tool.schema.string().min(1)).min(1),
              verification: tool.schema.string().min(1),
              dependsOn: tool.schema
                .array(tool.schema.string().min(1))
                .optional(),
              reviewUnit: tool.schema.string().min(1),
              branchName: tool.schema.string().min(1),
              authorizationState: tool.schema.string().min(1),
            }),
          )
          .optional(),
        deliveryPlanRequired: tool.schema.boolean().optional(),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (["completed", "cancelled"].includes(state.status))
              throw new Error(`Cannot revise a ${state.status} Ace mission`)
            const approval = userDecision(args)
            const reason = required(args.reason, "reason")
            const previous = new Map(
              state.criteria.map((item) => [item.id, item]),
            )
            const normalized = args.criteria
              ? normalizeCriteria(args.criteria)
              : state.criteria
            const retiredIDs = new Set(
              state.retiredCriteria.map((item) => item.id),
            )
            for (const item of normalized)
              if (retiredIDs.has(item.id))
                throw new Error(
                  `Ace criterion ID ${item.id} is retired; use a new ID to preserve its history`,
                )
            const nextIDs = new Set(normalized.map((item) => item.id))
            const removed = state.criteria.filter(
              (item) => !nextIDs.has(item.id),
            )
            if (
              removed.some((criterion) =>
                state.milestones.some((milestone) =>
                  milestone.criterionIDs.includes(criterion.id),
                ),
              ) &&
              !args.milestones
            )
              throw new Error(
                "Ace criterion removal requires a revised milestone plan because the current plan references retired criteria",
              )
            const objective = args.objective
              ? required(args.objective, "objective")
              : state.objective
            const verificationPlan = args.verificationPlan
              ? requiredArray(args.verificationPlan, "verificationPlan")
              : state.verificationPlan
            const constraints = args.constraints
              ? requiredArray(args.constraints, "constraints")
              : state.constraints
            const acceptanceChanged =
              objective !== state.objective ||
              JSON.stringify(constraints) !== JSON.stringify(state.constraints) ||
              JSON.stringify(verificationPlan) !==
                JSON.stringify(state.verificationPlan)
            const changedIDs = new Set(
              normalized
                .filter((item) => {
                  const old = previous.get(item.id)
                  return old && (old.text !== item.text || acceptanceChanged)
                })
                .map((item) => item.id),
            )
            let criteria = normalized.map((item) => {
              const old = previous.get(item.id)
              if (!old) return item
              return old.text === item.text && !acceptanceChanged
                ? old
                : {
                    ...old,
                    text: item.text,
                    state:
                      old.evidenceIDs.length || old.exception
                        ? ("verification-stale" as const)
                        : ("pending" as const),
                    reason:
                      "Acceptance interpretation changed under an explicit user decision; proof and exceptions require reconfirmation.",
                    exception: undefined,
                  }
            })
            const retiredCriteria = [
              ...state.retiredCriteria,
              ...removed.filter((item) => !retiredIDs.has(item.id)),
            ]
            const removedIDs = new Set(removed.map((item) => item.id))
            const retiredEvidence = state.currentEvidence.filter((item) =>
              item.criterionIDs.some((criterionID) =>
                removedIDs.has(criterionID),
              ),
            )
            const retiredEvidenceIDs = new Set(
              retiredEvidence.map((item) => item.id),
            )
            criteria = criteria.map((item) => {
              const evidenceIDs = item.evidenceIDs.filter(
                (evidenceID) => !retiredEvidenceIDs.has(evidenceID),
              )
              if (evidenceIDs.length === item.evidenceIDs.length) return item
              return {
                ...item,
                evidenceIDs,
                state: "verification-stale" as const,
                reason:
                  "Evidence also covered a retired criterion and must be recorded again for the current contract.",
              }
            })
            const currentEvidence = state.currentEvidence
              .filter((item) => !retiredEvidence.includes(item))
              .map((item) =>
                item.criterionIDs.some((criterionID) => changedIDs.has(criterionID))
                  ? { ...item, invalidatedAt: now() }
                  : item,
              )
            const invalidatedCriteria = new Set(
              criteria
                .filter((item) => item.state === "verification-stale")
                .map((item) => item.id),
            )
            const milestones = args.milestones
              ? normalizeMilestones(args.milestones, criteria)
              : state.milestones.map((item) =>
                  item.criterionIDs.some((criterionID) =>
                    invalidatedCriteria.has(criterionID),
                  )
                    ? {
                        ...item,
                        state: "pending" as const,
                        verifiedAt: undefined,
                      }
                    : item,
                )
            const deliveryPlanRequired =
              args.deliveryPlanRequired ?? state.deliveryPlanRequired
            if (deliveryPlanRequired && !milestones.length)
              throw new Error(
                "Ace requires milestones when deliveryPlanRequired is true",
              )
            const previousSnapshot = {
              objective: state.objective,
              criteria: state.criteria,
              constraints: state.constraints,
              verificationPlan: state.verificationPlan,
              milestones: state.milestones,
              deliveryPlanRequired: state.deliveryPlanRequired,
            }
            const revisedSnapshot = {
              objective,
              criteria,
              constraints,
              verificationPlan,
              milestones,
              deliveryPlanRequired,
            }
            const updated = audit(
              {
                ...state,
                ...revisedSnapshot,
                criteria,
                retiredCriteria,
                currentEvidence,
                evidenceHistory: [...state.evidenceHistory, ...retiredEvidence],
                revision: state.revision + 1,
                updatedAt: now(),
              },
              "contract-revised",
              `Reason: ${reason}\nPrevious contract: ${JSON.stringify(previousSnapshot)}\nRevised contract: ${JSON.stringify(revisedSnapshot)}`,
              approval,
            )
            return {
              state: updated,
              result: compact(updated, "Ace contract revised"),
            }
          },
          true,
        )
      },
    }),
    ace_accept_exception: tool({
      description:
        "Record a named user-approved exception for one currently unmet criterion.",
      args: {
        criterionID: tool.schema.string().min(1),
        limitation: tool.schema.string().min(1),
        decisionReference: tool.schema.string().min(1),
        approver: tool.schema.string().min(1),
        decidedAt: tool.schema.string().min(1),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (["completed", "cancelled"].includes(state.status))
              throw new Error(
                `Cannot accept an exception for a ${state.status} Ace mission`,
              )
            const criterionID = required(args.criterionID, "criterionID")
            const item = state.criteria.find(
              (candidate) => candidate.id === criterionID,
            )
            if (!item)
              throw new Error(`Ace criterion ${criterionID} does not exist`)
            if (item.state === "satisfied")
              throw new Error(
                `Ace criterion ${criterionID} already has current proof; do not replace proof with an exception`,
              )
            const approval = userDecision(args)
            const exception = {
              ...approval,
              limitation: required(args.limitation, "limitation"),
              sourceIdentity: state.source.value,
              criterionText: item.text,
            }
            const updated = audit(
              {
                ...state,
                criteria: state.criteria.map((candidate) =>
                  candidate.id === criterionID
                    ? {
                        ...candidate,
                        state: "accepted-exception" as const,
                        exception,
                        reason: exception.limitation,
                      }
                    : candidate,
                ),
                revision: state.revision + 1,
                updatedAt: now(),
              },
              "exception-accepted",
              `User accepted a named exception for ${criterionID}.`,
              approval,
            )
            return {
              state: updated,
              result: compact(updated, `Exception accepted for ${criterionID}`),
            }
          },
          true,
        )
      },
    }),
    ace_complete: tool({
      description:
        "Strictly complete only active missions whose every criterion and milestone has current proof.",
      args: { finalVerification: tool.schema.string().min(1) },
      async execute(args, context) {
        return stateOp(project.id, context.sessionID, directory, (state) => {
          active(state)
          const issue = completionIssue(state, false)
          if (issue)
            throw new Error(
              `Cannot strictly complete Ace mission: ${issue}. Record structured evidence or use an explicit qualified close after user acceptance.`,
            )
          const updated = audit(
            {
              ...state,
              status: "completed",
              finalVerification: required(
                args.finalVerification,
                "finalVerification",
              ),
              latestSummary:
                "Every criterion and milestone has current verification evidence.",
              nextAction: undefined,
              stopReason: undefined,
              executionWindows: [
                ...state.executionWindows.slice(0, -1),
                closed(activeWindow(state)),
              ],
              revision: state.revision + 1,
              updatedAt: now(),
            },
            "completed",
            "Mission completed with strict current proof.",
          )
          return {
            state: updated,
            result: compact(updated, "Ace mission completed"),
          }
        })
      },
    }),
    ace_close_with_qualifications: tool({
      description:
        "Close paused or limited work only when every remaining criterion has a current explicit user acceptance.",
      args: {
        finalVerification: tool.schema.string().min(1),
        decisionReference: tool.schema.string().min(1),
        approver: tool.schema.string().min(1),
        decidedAt: tool.schema.string().min(1),
      },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (!["paused", "limit-reached"].includes(state.status))
              throw new Error(
                `Qualified close requires a paused or limit-reached mission, not ${state.status}`,
              )
            const closable = closeQualifiedMilestones(state)
            const issue = completionIssue(closable, true)
            if (issue)
              throw new Error(
                `Cannot close Ace mission with qualifications: ${issue}`,
              )
            const approval = userDecision(args)
            const updated = audit(
              {
                ...closable,
                status: "completed",
                finalVerification: required(
                  args.finalVerification,
                  "finalVerification",
                ),
                closeQualification: approval,
                latestSummary:
                  "Mission closed with explicit current user-approved qualifications.",
                nextAction: undefined,
                stopReason: "Completed with explicit accepted exceptions.",
                revision: state.revision + 1,
                updatedAt: now(),
              },
              "qualified-close",
              "Mission closed with explicit accepted exceptions.",
              approval,
            )
            return {
              state: updated,
              result: compact(
                updated,
                "Ace mission closed with qualifications",
              ),
            }
          },
          true,
        )
      },
    }),
    ace_cancel: tool({
      description: "Cancel the Ace mission without claiming completion.",
      args: { reason: tool.schema.string().min(1) },
      async execute(args, context) {
        return stateOp(
          project.id,
          context.sessionID,
          directory,
          (state) => {
            if (state.status === "completed")
              throw new Error("Cannot cancel a completed Ace mission")
            if (state.status === "cancelled")
              throw new Error("Ace mission is already cancelled")
            const updated = audit(
              {
                ...state,
                status: "cancelled",
                stopReason: required(args.reason, "reason"),
                executionWindows:
                  state.status === "active"
                    ? [
                        ...state.executionWindows.slice(0, -1),
                        closed(activeWindow(state)),
                      ]
                    : state.executionWindows,
                revision: state.revision + 1,
                updatedAt: now(),
              },
              "cancelled",
              "Mission cancelled.",
            )
            return {
              state: updated,
              result: compact(updated, "Ace mission cancelled"),
            }
          },
          true,
        )
      },
    }),
    ace_clear: tool({
      description:
        "Delete this session's persisted Ace state after an explicit user request.",
      args: {},
      async execute(_args, context) {
        return serialized(async () => {
          const path = stateFile(project.id, context.sessionID)
          try {
            parseState(
              await readFile(path, "utf8"),
              path,
              project.id,
              context.sessionID,
              {
                kind: "manual",
                value: "clear-operation",
                freshnessPolicy: "Clear validates identity only.",
              },
            )
            await unlink(path)
            return "Ace state cleared for this session."
          } catch (error) {
            if (isMissing(error))
              return "No Ace mission exists for this session."
            throw new Error(
              `Cannot clear Ace state for project ${JSON.stringify(project.id)} and session ${JSON.stringify(context.sessionID)}: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        })
      },
    }),
  },
})
