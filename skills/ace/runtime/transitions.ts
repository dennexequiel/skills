import { invalidateMilestoneDependents } from "./milestones"
import {
  criterionHasCurrentException,
  criterionHasCurrentProof,
} from "./proof"
import type {
  AceState,
  CriterionState,
  Evidence,
  SourceIdentity,
} from "./types"

export type EvidenceInput = {
  criterionIDs: string[]
  method: string
  result: string
  summary: string
}

function required(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Ace ${field} must not be empty`)
  return trimmed
}

function timestamp(value: string): string {
  const output = required(value, "recordedAt")
  if (!Number.isFinite(Date.parse(output)))
    throw new Error("Ace recordedAt must be a valid timestamp")
  return output
}

function nextID(prefix: string, values: { id: string }[]): string {
  const sequence = values
    .map((item) => new RegExp(`^${prefix}(\\d+)$`).exec(item.id)?.[1])
    .filter((item): item is string => item !== undefined)
    .reduce((maximum, item) => Math.max(maximum, Number(item)), 0)
  return `${prefix}${sequence + 1}`
}

function appendAudit(
  state: AceState,
  type: string,
  summary: string,
  recordedAt: string,
): AceState {
  return {
    ...state,
    audit: [
      ...state.audit,
      {
        id: nextID("A", state.audit),
        type,
        recordedAt,
        summary,
      },
    ],
  }
}

export function recordEvidence(
  state: AceState,
  input: EvidenceInput,
  recordedAt: string,
): AceState {
  const time = timestamp(recordedAt)
  const criterionIDs = [
    ...new Set(
      input.criterionIDs.map((value, index) =>
        required(value, `evidence.criterionIDs[${index}]`),
      ),
    ),
  ].sort()
  if (!criterionIDs.length)
    throw new Error("Ace evidence.criterionIDs must contain at least one item")
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
    const entry: Evidence = {
      id: nextID("E", [
        ...output.currentEvidence,
        ...output.evidenceHistory,
      ]),
      criterionIDs: [criterionID],
      method,
      result,
      summary: evidenceSummary,
      sourceIdentity: output.source.value,
      recordedAt: time,
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
    output = {
      ...output,
      criteria: output.criteria.map((item) =>
        item.id === criterionID
          ? {
              ...item,
              state: nextState,
              evidenceIDs: currentForCriterion.map((evidence) => evidence.id),
              verifiedSourceIdentity: entry.sourceIdentity,
              verifiedAt: time,
              reason: allPassed ? undefined : evidenceSummary,
            }
          : item,
      ),
      currentEvidence,
      evidenceHistory: prior
        ? [...output.evidenceHistory, prior]
        : output.evidenceHistory,
      revision: output.revision + 1,
      updatedAt: time,
    }
  }
  return output === state
    ? state
    : appendAudit(
        output,
        "evidence-recorded",
        `Current evidence recorded for ${criterionIDs.join(", ")} using ${method}.`,
        time,
      )
}

export function invalidateForSourceChange(
  state: AceState,
  nextSource: SourceIdentity,
  recordedAt: string,
): AceState {
  const time = timestamp(recordedAt)
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
  return appendAudit(
    {
      ...state,
      source: nextSource,
      criteria,
      milestones: invalidateMilestoneDependents(
        state.milestones,
        staleCriteria,
      ),
      revision: state.revision + 1,
      updatedAt: time,
    },
    "source-changed",
    "Source identity changed. Current criterion proof requiring that source is stale.",
    time,
  )
}

export function closeQualifiedMilestones(
  state: AceState,
  recordedAt: string,
): AceState {
  const time = timestamp(recordedAt)
  let milestones = state.milestones
  let changed = true
  let closedAny = false
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
      closedAny = true
      return { ...item, state: "closed" as const, verifiedAt: time }
    })
  }
  return closedAny ? { ...state, milestones } : state
}
