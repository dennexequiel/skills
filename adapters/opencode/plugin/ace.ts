import { createHash } from "node:crypto"
import { execFile as execFileCallback } from "node:child_process"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { isAbsolute, join, relative, sep } from "node:path"
import { promisify } from "node:util"
import { type Plugin, tool } from "@opencode-ai/plugin"
import {
  ACE_CRITERION_STATES as CRITERION_STATES,
  ACE_MODES as MODES,
  completionIssue,
  closeQualifiedMilestones,
  criterionHasCurrentProof,
  currentAceState,
  invalidateForSourceChange,
  invalidateMilestoneDependents,
  parseAceState,
  parseSourceIdentity,
  recordEvidence,
  validateMilestoneDependencies,
  type AceMode,
  type AceState as State,
  type Criterion,
  type CriterionState,
  type ExecutionWindow as Window,
  type Milestone,
  type SourceIdentity,
  type UserDecision,
} from "../../../skills/ace/runtime/index.ts"

const execFile = promisify(execFileCallback)
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
    isRecord(raw) && raw.version === 2
      ? parseSourceIdentity(raw.source, path)
      : undefined
  const sourceIdentity = await captureSource(
    directory,
    manual ??
      (persistedSource?.kind === "manual" ? persistedSource : undefined),
  )
  const state = parseAceState(content, {
    path,
    projectID,
    sessionID,
    currentSource: sourceIdentity,
    recordedAt: now(),
  })
  return !sameSource(state.source, sourceIdentity)
    ? invalidateForSourceChange(state, sourceIdentity, now())
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
    : invalidateForSourceChange(
        state,
        {
          ...state.source,
          value: required(sourceIdentity, "sourceIdentity"),
        },
        now(),
      )
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
  return `AUTOMATIC ACE CONTINUATION\n\nCurrent Ace state:\n${JSON.stringify(currentAceState(state, Date.now()), null, 2)}\n\nLoad and obey the ace skill. Continue only safe work toward an unmet criterion. Record structured evidence with ace_progress using the displayed source identity. Completion requires current proof; qualifications require explicit user approval. Retrieve complete persisted state with ace_status detail=full or audit history with ace_status detail=audit.`
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
        `## Current persistent Ace contract\n${JSON.stringify(currentAceState(state, Date.now()), null, 2)}\n\nPreserve every constraint and authorization boundary. Retrieve complete persisted state with ace_status detail=full or audit history with ace_status detail=audit.`,
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
                    ? JSON.stringify(currentAceState(updated, Date.now()), null, 2)
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
              updated = recordEvidence(updated, item, now())
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
              : invalidateMilestoneDependents(
                  state.milestones,
                  invalidatedCriteria,
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
            const closable = closeQualifiedMilestones(state, now())
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
            parseAceState(await readFile(path, "utf8"), {
              path,
              projectID: project.id,
              sessionID: context.sessionID,
              currentSource: {
                kind: "manual",
                value: "clear-operation",
                freshnessPolicy: "Clear validates identity only.",
              },
              recordedAt: now(),
            })
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
