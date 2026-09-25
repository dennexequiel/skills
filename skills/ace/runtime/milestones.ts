import type { Milestone } from "./types"

function invalid(path: string, field: string, expected: string): never {
  throw new Error(`Invalid Ace state at ${path}: field ${field} ${expected}`)
}
export function validateMilestoneDependencies(
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

export function invalidateMilestoneDependents(
  milestones: Milestone[],
  changedCriterionIDs: ReadonlySet<string>,
): Milestone[] {
  const invalidated = new Set(
    milestones
      .filter((item) =>
        item.criterionIDs.some((criterionID) =>
          changedCriterionIDs.has(criterionID),
        ),
      )
      .map((item) => item.id),
  )
  let changed = true
  while (changed) {
    changed = false
    for (const item of milestones) {
      if (
        !invalidated.has(item.id) &&
        item.dependsOn.some((dependency) => invalidated.has(dependency))
      ) {
        invalidated.add(item.id)
        changed = true
      }
    }
  }
  return milestones.map((item) =>
    invalidated.has(item.id)
      ? { ...item, state: "pending" as const, verifiedAt: undefined }
      : item,
  )
}
