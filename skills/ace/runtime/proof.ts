import type { AceState, Criterion } from "./types"

export function criterionHasCurrentProof(
  state: AceState,
  item: Criterion,
): boolean {
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
export function criterionHasCurrentException(
  state: AceState,
  item: Criterion,
): boolean {
  return (
    item.state === "accepted-exception" &&
    item.exception?.sourceIdentity === state.source.value &&
    item.exception.criterionText === item.text
  )
}

export function completionIssue(
  state: AceState,
  qualified: boolean,
): string | undefined {
  for (const item of state.criteria) {
    const proof = criterionHasCurrentProof(state, item)
    const exception = qualified && criterionHasCurrentException(state, item)
    if (!proof && !exception)
      return `Criterion ${item.id} is ${item.state} and lacks current proof${qualified ? " or an explicit current exception" : ""}`
  }
  const incomplete = state.milestones.find((item) => {
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
  return incomplete
    ? `Milestone ${incomplete.id} is not closed and verified`
    : undefined
}
