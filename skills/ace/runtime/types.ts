export type AceMode = "deliver" | "learn" | "explore" | "decide"
export type AceStatus =
  | "active"
  | "paused"
  | "blocked"
  | "limit-reached"
  | "completed"
  | "cancelled"
export type CriterionState =
  | "pending"
  | "active"
  | "satisfied"
  | "verification-stale"
  | "blocked"
  | "external"
  | "baseline-qualified"
  | "accepted-exception"
export type MilestoneState = "pending" | "active" | "closed"

export type SourceIdentity = {
  kind: "git" | "manual"
  value: string
  freshnessPolicy: string
  head?: string | undefined
}

export type UserDecision = {
  decisionReference: string
  approver: string
  decidedAt: string
}

export type Criterion = {
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

export type Evidence = {
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

export type Audit = {
  id: string
  type: string
  recordedAt: string
  summary: string
  decision?: UserDecision | undefined
}

export type Milestone = {
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

export type ExecutionWindow = {
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

export type AceState = {
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
  executionWindows: ExecutionWindow[]
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

export type CurrentAceState = {
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
  currentExecutionWindow: ExecutionWindow & {
    measuredElapsedMilliseconds: number
  }
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

export const ACE_MODES: readonly AceMode[] = [
  "deliver",
  "learn",
  "explore",
  "decide",
]
export const ACE_STATUSES: readonly AceStatus[] = [
  "active",
  "paused",
  "blocked",
  "limit-reached",
  "completed",
  "cancelled",
]
export const ACE_CRITERION_STATES: readonly CriterionState[] = [
  "pending",
  "active",
  "satisfied",
  "verification-stale",
  "blocked",
  "external",
  "baseline-qualified",
  "accepted-exception",
]
export const ACE_MILESTONE_STATES: readonly MilestoneState[] = [
  "pending",
  "active",
  "closed",
]
