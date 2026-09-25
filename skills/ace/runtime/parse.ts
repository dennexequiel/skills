import { validateMilestoneDependencies } from "./milestones"
import {
  ACE_CRITERION_STATES,
  ACE_MILESTONE_STATES,
  ACE_MODES,
  ACE_STATUSES,
  type AceState,
  type AceStatus,
  type Criterion,
  type Evidence,
  type ExecutionWindow,
  type Milestone,
  type SourceIdentity,
  type UserDecision,
} from "./types"

export type ParseAceStateContext = {
  path: string
  projectID: string
  sessionID: string
  currentSource: SourceIdentity
  recordedAt: string
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

function decision(
  value: unknown,
  path: string,
  field: string,
): UserDecision {
  if (!isRecord(value)) invalid(path, field, "must be an object")
  return {
    decisionReference: stringValue(value, "decisionReference", path),
    approver: stringValue(value, "approver", path),
    decidedAt: timestamp(value, "decidedAt", path),
  }
}

export function parseSourceIdentity(
  value: unknown,
  path: string,
): SourceIdentity {
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
    state: enumValue(value, "state", path, ACE_CRITERION_STATES),
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
    state: enumValue(value, "state", path, ACE_MILESTONE_STATES),
  }
  if (value.verifiedAt !== undefined)
    output.verifiedAt = timestamp(value, "verifiedAt", path)
  return output
}

function executionWindow(
  value: Record<string, unknown>,
  path: string,
): ExecutionWindow {
  const output: ExecutionWindow = {
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
  windows: ExecutionWindow[],
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

function migrateV1(
  value: Record<string, unknown>,
  context: ParseAceStateContext,
): AceState {
  const { path, projectID, sessionID, currentSource, recordedAt } = context
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
  const status = enumValue(value, "status", path, ACE_STATUSES)
  const updatedAt = timestamp(value, "updatedAt", path)
  const startedAt = timestamp(value, "budgetStartedAt", path)
  const activeMigration = status === "active"
  return {
    version: 2,
    projectID,
    sessionID,
    mode: enumValue(value, "mode", path, ACE_MODES),
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
        recordedAt,
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
    updatedAt: recordedAt,
  }
}

export function parseAceState(
  content: string,
  context: ParseAceStateContext,
): AceState {
  const { path, projectID, sessionID } = context
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
  if (value.version === 1) return migrateV1(value, context)
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
    (entry) => executionWindow(entry, path),
  )
  if (!executionWindows.length)
    invalid(path, "executionWindows", "must contain at least one item")
  const status = enumValue(value, "status", path, ACE_STATUSES)
  validateExecutionWindows(executionWindows, status, path)

  const output: AceState = {
    version: 2,
    projectID,
    sessionID,
    mode: enumValue(value, "mode", path, ACE_MODES),
    objective: stringValue(value, "objective", path),
    constraints: stringArray(value, "constraints", path),
    verificationPlan: stringArray(value, "verificationPlan", path, false),
    criteria,
    retiredCriteria,
    milestones,
    deliveryPlanRequired: bool(value, "deliveryPlanRequired", path),
    source: parseSourceIdentity(value.source, path),
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
