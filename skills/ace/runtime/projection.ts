import type { AceState, CurrentAceState, ExecutionWindow } from "./types"

function measuredElapsed(
  window: ExecutionWindow,
  currentTimeMilliseconds: number,
): number {
  return (
    window.elapsedMilliseconds +
    (window.endedAt
      ? 0
      : Math.max(0, currentTimeMilliseconds - Date.parse(window.startedAt)))
  )
}
function shortBytes(value: string, maximum: number): string {
  const byteLength = (input: string): number =>
    new TextEncoder().encode(input).byteLength
  if (byteLength(value) <= maximum) return value
  const suffix = "..."
  let end = value.length
  while (end > 0 && byteLength(value.slice(0, end) + suffix) > maximum)
    end -= 1
  return value.slice(0, end) + suffix
}

export function currentAceState(
  state: AceState,
  currentTimeMilliseconds: number,
): CurrentAceState {
  const currentWindow = state.executionWindows.at(-1)!
  const blocked = state.criteria.filter((item) =>
    ["blocked", "external", "verification-stale"].includes(item.state),
  )
  const blocker = blocked.length
    ? `${blocked.length} criterion blocker(s); first ${shortBytes(blocked[0]!.id, 80)}: ${shortBytes(blocked[0]!.reason ?? blocked[0]!.state, 180)}`
    : state.stopReason ?? "none"
  return {
    version: 2,
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
    blocker,
    currentExecutionWindow: {
      ...currentWindow,
      measuredElapsedMilliseconds: measuredElapsed(
        currentWindow,
        currentTimeMilliseconds,
      ),
    },
    lifetime: {
      knownElapsedMilliseconds: state.executionWindows.reduce(
        (total, item) =>
          total + measuredElapsed(item, currentTimeMilliseconds),
        0,
      ),
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
