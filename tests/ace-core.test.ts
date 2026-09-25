import { describe, expect, test } from "bun:test"
import {
  closeQualifiedMilestones,
  completionIssue,
  currentAceState,
  invalidateForSourceChange,
  invalidateMilestoneDependents,
  parseAceState,
  recordEvidence,
  validateMilestoneDependencies,
  type AceState,
  type Criterion,
  type Evidence,
  type Milestone,
} from "../skills/ace/runtime"

const source = {
  kind: "manual" as const,
  value: "fixture-v1",
  freshnessPolicy: "Static test fixture",
}
const recordedAt = "2026-09-22T00:00:00.000Z"
const laterAt = "2026-09-22T00:01:00.000Z"

function criterion(id: string): Criterion {
  return {
    id,
    text: `Outcome ${id}`,
    state: "pending",
    evidenceIDs: [],
  }
}

function milestone(
  id: string,
  criterionID: string,
  dependsOn: string[] = [],
): Milestone {
  return {
    id,
    outcome: `Deliver ${id}`,
    criterionIDs: [criterionID],
    fileScope: [`${id}.ts`],
    verification: `Verify ${id}`,
    dependsOn,
    reviewUnit: id,
    branchName: `test/${id.toLowerCase()}`,
    authorizationState: "not-authorized",
    state: "closed",
    verifiedAt: recordedAt,
  }
}

function state(): AceState {
  return {
    version: 2,
    projectID: "core",
    sessionID: "session",
    mode: "deliver",
    objective: "Verify the deterministic core",
    constraints: ["No host events"],
    verificationPlan: ["Run core tests"],
    criteria: [criterion("C1"), criterion("C2"), criterion("C3")],
    retiredCriteria: [],
    milestones: [
      milestone("M1", "C1"),
      milestone("M2", "C2"),
      milestone("M3", "C3", ["M1"]),
    ],
    deliveryPlanRequired: true,
    source,
    status: "active",
    executionWindows: [
      {
        id: "W1",
        startedAt: recordedAt,
        elapsedMilliseconds: 0,
        maxMinutes: 60,
        maxContinuations: 20,
        automaticContinuations: 0,
        warningIssued: false,
      },
    ],
    lifetimeTimingComplete: true,
    automaticContinuationCount: 0,
    iterationCount: 0,
    lastProgressSourceIdentity: source.value,
    userResumptionCount: 0,
    stallCount: 0,
    maxStalls: 3,
    revision: 1,
    currentEvidence: [],
    evidenceHistory: [],
    audit: [
      {
        id: "A1",
        type: "started",
        recordedAt,
        summary: "Mission started.",
      },
    ],
    createdAt: recordedAt,
    updatedAt: recordedAt,
  }
}

function proof(id: string, criterionID: string): Evidence {
  return {
    id,
    criterionIDs: [criterionID],
    method: "test",
    result: "passed",
    summary: `${criterionID} passes`,
    sourceIdentity: source.value,
    recordedAt,
    supersedes: [],
  }
}

describe("Ace deterministic core", () => {
  test("parses valid state and rejects invalid execution windows", () => {
    const value = state()
    const parsed = parseAceState(JSON.stringify(value), {
      path: "fixture.json",
      projectID: value.projectID,
      sessionID: value.sessionID,
      currentSource: source,
      recordedAt,
    })
    expect(parsed).toEqual(value)

    const invalid = {
      ...value,
      status: "paused",
    }
    expect(() =>
      parseAceState(JSON.stringify(invalid), {
        path: "fixture.json",
        projectID: value.projectID,
        sessionID: value.sessionID,
        currentSource: source,
        recordedAt,
      }),
    ).toThrow("last window must be closed when status is paused")

    const brokenEvidenceReference = {
      ...value,
      criteria: value.criteria.map((item, index) =>
        index === 0 ? { ...item, evidenceIDs: ["missing"] } : item,
      ),
    }
    expect(() =>
      parseAceState(JSON.stringify(brokenEvidenceReference), {
        path: "fixture.json",
        projectID: value.projectID,
        sessionID: value.sessionID,
        currentSource: source,
        recordedAt,
      }),
    ).toThrow("references missing current evidence missing")
  })

  test("migrates version-1 state without promoting legacy notes to proof", () => {
    const migrated = parseAceState(
      JSON.stringify({
        version: 1,
        projectID: "core",
        sessionID: "session",
        mode: "deliver",
        objective: "Migrate the mission",
        acceptanceCriteria: ["Migration remains unverified"],
        constraints: [],
        verificationPlan: ["Run a fresh check"],
        status: "active",
        continuationCount: 2,
        maxContinuations: 20,
        stallCount: 1,
        maxStalls: 3,
        maxMinutes: 60,
        revision: 4,
        evidence: [{ note: "Legacy note", recordedAt }],
        createdAt: recordedAt,
        budgetStartedAt: recordedAt,
        updatedAt: laterAt,
      }),
      {
        path: "legacy.json",
        projectID: "core",
        sessionID: "session",
        currentSource: source,
        recordedAt: laterAt,
      },
    )

    expect(migrated.version).toBe(2)
    expect(migrated.lifetimeTimingComplete).toBe(false)
    expect(migrated.criteria[0]?.state).toBe("pending")
    expect(migrated.currentEvidence).toEqual([])
    expect(migrated.evidenceHistory[0]?.result).toBe("unverified")
    expect(migrated.audit[0]?.type).toBe("migration")
  })

  test("rejects milestone dependency cycles independently of parsing", () => {
    const milestones = state().milestones.map((item) =>
      item.id === "M1" ? { ...item, dependsOn: ["M3"] } : item,
    )
    expect(() =>
      validateMilestoneDependencies(milestones, "milestone fixture"),
    ).toThrow("contains a dependency cycle at M1")
  })

  test("requires current source-bound proof for strict completion", () => {
    const value = state()
    const currentEvidence = value.criteria.map((item, index) =>
      proof(`E${index + 1}`, item.id),
    )
    const proven: AceState = {
      ...value,
      currentEvidence,
      criteria: value.criteria.map((item, index) => ({
        ...item,
        state: "satisfied",
        evidenceIDs: [currentEvidence[index]!.id],
        verifiedSourceIdentity: source.value,
        verifiedAt: recordedAt,
      })),
    }
    expect(completionIssue(proven, false)).toBeUndefined()

    const stale: AceState = {
      ...proven,
      source: { ...source, value: "fixture-v2" },
    }
    expect(completionIssue(stale, false)).toContain(
      "Criterion C1 is satisfied and lacks current proof",
    )
  })

  test("invalidates only affected milestones and reverse dependencies", () => {
    const milestones = invalidateMilestoneDependents(
      state().milestones,
      new Set(["C1"]),
    )
    expect(milestones.map((item) => [item.id, item.state])).toEqual([
      ["M1", "pending"],
      ["M2", "closed"],
      ["M3", "pending"],
    ])
    expect(milestones.find((item) => item.id === "M2")?.verifiedAt).toBe(
      recordedAt,
    )
    expect(milestones.find((item) => item.id === "M1")?.verifiedAt).toBeUndefined()
  })

  test("records, deduplicates, and supersedes evidence deterministically", () => {
    const initial: AceState = {
      ...state(),
      milestones: [],
      deliveryPlanRequired: false,
    }
    const passed = recordEvidence(
      initial,
      {
        criterionIDs: [" C1 ", "C1"],
        method: " bun test ",
        result: " passed ",
        summary: " C1 passes ",
      },
      ` ${recordedAt} `,
    )
    expect(passed.criteria[0]?.state).toBe("satisfied")
    expect(passed.currentEvidence[0]?.id).toBe("E1")
    expect(passed.currentEvidence[0]).toMatchObject({
      criterionIDs: ["C1"],
      method: "bun test",
      result: "passed",
      summary: "C1 passes",
      recordedAt,
    })
    expect(passed.audit.at(-1)?.type).toBe("evidence-recorded")
    expect(passed.revision).toBe(2)

    expect(
      recordEvidence(
        passed,
        {
          criterionIDs: ["C1"],
          method: "bun test",
          result: "passed",
          summary: "C1 passes",
        },
        laterAt,
      ),
    ).toBe(passed)

    const failed = recordEvidence(
      passed,
      {
        criterionIDs: ["C1"],
        method: "bun test",
        result: "failed",
        summary: "C1 regressed",
      },
      laterAt,
    )
    expect(failed.criteria[0]?.state).toBe("active")
    expect(failed.currentEvidence[0]?.id).toBe("E2")
    expect(failed.currentEvidence[0]?.supersedes).toEqual(["E1"])
    expect(failed.evidenceHistory.map((item) => item.id)).toEqual(["E1"])
    expect(failed.revision).toBe(3)
  })

  test("invalidates source-bound work and its reverse dependencies", () => {
    const value = state()
    const passed = recordEvidence(
      value,
      {
        criterionIDs: ["C1"],
        method: "bun test",
        result: "passed",
        summary: "C1 passes",
      },
      recordedAt,
    )
    const invalidated = invalidateForSourceChange(
      passed,
      { ...source, value: "fixture-v2" },
      laterAt,
    )

    expect(invalidated.criteria[0]?.state).toBe("verification-stale")
    expect(invalidated.milestones.map((item) => [item.id, item.state])).toEqual([
      ["M1", "pending"],
      ["M2", "closed"],
      ["M3", "pending"],
    ])
    expect(invalidated.audit.at(-1)?.type).toBe("source-changed")
  })

  test("closes qualified milestone chains and preserves a settled state", () => {
    let proven: AceState = {
      ...state(),
      milestones: state().milestones.map((item) => ({
        ...item,
        state: "pending",
        verifiedAt: undefined,
      })),
    }
    for (const item of proven.criteria)
      proven = recordEvidence(
        proven,
        {
          criterionIDs: [item.id],
          method: `test ${item.id}`,
          result: "passed",
          summary: `${item.id} passes`,
        },
        recordedAt,
      )

    const closed = closeQualifiedMilestones(proven, laterAt)
    expect(closed.milestones.map((item) => item.state)).toEqual([
      "closed",
      "closed",
      "closed",
    ])
    expect(closed.milestones.every((item) => item.verifiedAt === laterAt)).toBe(
      true,
    )
    expect(completionIssue(closed, false)).toBeUndefined()
    expect(closeQualifiedMilestones(closed, laterAt)).toBe(closed)
  })

  test("keeps routine recovery independent of accumulated history", () => {
    const value = state()
    const expanded: AceState = {
      ...value,
      audit: [
        ...value.audit,
        ...Array.from({ length: 100 }, (_, index) => ({
          id: `A${index + 2}`,
          type: "history",
          recordedAt,
          summary: `Historical event ${index}`,
        })),
      ],
      evidenceHistory: Array.from({ length: 100 }, (_, index) =>
        proof(`H${index + 1}`, "C1"),
      ),
    }
    expect(currentAceState(expanded, Date.parse(recordedAt))).toEqual(
      currentAceState(value, Date.parse(recordedAt)),
    )
    expect(JSON.stringify(expanded).length).toBeGreaterThan(
      JSON.stringify(value).length,
    )
  })
})
