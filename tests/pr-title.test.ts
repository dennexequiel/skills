import { describe, expect, test } from "bun:test"
import { pullRequestTitleIssues } from "../scripts/check-pr-title"

describe("pull request title convention", () => {
  test.each([
    "feat: add a portable skill",
    "fix(opencode): reject stale evidence",
    "docs(prep-that-doc): clarify scanner limits",
    "chore: enforce pull request titles",
    "refactor(ace): separate skill policy from runtime",
    "test: cover malformed state",
    "perf(runtime): reduce recovery context",
  ])("accepts %s", (title) => {
    expect(pullRequestTitleIssues(title)).toEqual([])
  })

  test.each([
    "Add a portable skill",
    "build: add a portable skill",
    "feat(Prep-That-Doc): add profile support",
    "feat: Add a portable skill",
    "feat: add  a portable skill",
    "feat: add a portable skill.",
    `feat: ${"a".repeat(67)}`,
  ])("rejects %s", (title) => {
    expect(pullRequestTitleIssues(title).length).toBeGreaterThan(0)
  })
})
