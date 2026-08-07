import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { type Plugin, tool } from "@opencode-ai/plugin"

type AceMode = "deliver" | "learn" | "explore" | "decide"
type AceStatus = "active" | "paused" | "blocked" | "limit-reached" | "completed" | "cancelled"

type AceEvidence = {
  note: string
  recordedAt: string
}

type AceState = {
  version: 1
  projectID: string
  sessionID: string
  mode: AceMode
  objective: string
  acceptanceCriteria: string[]
  constraints: string[]
  verificationPlan: string[]
  status: AceStatus
  continuationCount: number
  maxContinuations: number
  stallCount: number
  maxStalls: number
  maxMinutes: number
  revision: number
  lastHandledMessageID?: string
  suppressNextContinuation?: boolean
  evidence: AceEvidence[]
  latestSummary?: string
  nextAction?: string
  stopReason?: string
  finalVerification?: string
  createdAt: string
  budgetStartedAt: string
  updatedAt: string
}

const DEFAULT_MAX_CONTINUATIONS = 20
const DEFAULT_MAX_MINUTES = 60
const DEFAULT_MAX_STALLS = 3
const MAX_CONTINUATIONS = 100
const MAX_MINUTES = 480
const MAX_STALLS = 10
const MAX_EVIDENCE_ENTRIES = 100
const MILLISECONDS_PER_MINUTE = 60_000
const MODES: AceMode[] = ["deliver", "learn", "explore", "decide"]
const STATUSES: AceStatus[] = ["active", "paused", "blocked", "limit-reached", "completed", "cancelled"]
const PROTECTED_START_STATUSES: AceStatus[] = ["active", "paused"]
const RESUMABLE_STATUSES: AceStatus[] = ["paused", "blocked", "limit-reached"]

const stateRoot = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
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

// Lossy by design: distinct IDs can collapse to one filename, so every read and delete
// re-checks the stored projectID and sessionID before trusting or removing the file.
function safeID(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function stateFile(projectID: string, sessionID: string): string {
  return join(stateDirectory, `${safeID(projectID)}--${safeID(sessionID)}.json`)
}

function isMissingFileError(error: unknown): boolean {
  return (error as { code?: string }).code === "ENOENT"
}

function invalidState(path: string, field: string, expected: string): never {
  throw new Error(`Invalid Ace state at ${path}: field ${field} ${expected}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stateString(state: Record<string, unknown>, field: string, path: string): string {
  const value = state[field]
  if (typeof value !== "string" || !value) invalidState(path, field, "must be a non-empty string")
  return value
}

function stateStringValue(state: Record<string, unknown>, field: string, path: string): string {
  const value = state[field]
  if (typeof value !== "string") invalidState(path, field, "must be a string")
  return value
}

function stateStringArray(state: Record<string, unknown>, field: string, path: string, allowEmpty: boolean): string[] {
  const value = state[field]
  if (!Array.isArray(value)) invalidState(path, field, "must be an array")
  if (!allowEmpty && !value.length) invalidState(path, field, "must contain at least one item")
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || !item) invalidState(path, `${field}[${index}]`, "must be a non-empty string")
  }
  return value
}

function stateInteger(state: Record<string, unknown>, field: string, path: string, minimum: number): number {
  const value = state[field]
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    invalidState(path, field, `must be an integer greater than or equal to ${minimum}`)
  }
  return value
}

function stateTimestamp(state: Record<string, unknown>, field: string, path: string): string {
  const value = stateString(state, field, path)
  if (!Number.isFinite(Date.parse(value))) invalidState(path, field, "must be a valid timestamp")
  return value
}

function optionalStateString(state: Record<string, unknown>, field: string, path: string): string | undefined {
  if (state[field] === undefined) return undefined
  return stateStringValue(state, field, path)
}

function stateEnum<T extends string>(
  state: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = state[field]
  const matched = allowed.find((candidate) => candidate === value)
  if (!matched) invalidState(path, field, `must be one of ${allowed.join(", ")}`)
  return matched
}

function stateEvidence(state: Record<string, unknown>, path: string): AceEvidence[] {
  const value = state.evidence
  if (!Array.isArray(value)) invalidState(path, "evidence", "must be an array")
  return value.map((entry, index) => {
    if (!isRecord(entry)) invalidState(path, `evidence[${index}]`, "must be an object")
    return {
      note: stateStringValue(entry, "note", path),
      recordedAt: stateTimestamp(entry, "recordedAt", path),
    }
  })
}

function validateState(value: unknown, path: string, projectID: string, sessionID: string): AceState {
  if (!isRecord(value)) invalidState(path, "root", "must be an object")
  if (value.version !== 1) invalidState(path, "version", "must be 1")
  const storedProjectID = stateString(value, "projectID", path)
  if (storedProjectID !== projectID) invalidState(path, "projectID", `must match ${JSON.stringify(projectID)}`)
  const storedSessionID = stateString(value, "sessionID", path)
  if (storedSessionID !== sessionID) invalidState(path, "sessionID", `must match ${JSON.stringify(sessionID)}`)
  const suppressNextContinuation = value.suppressNextContinuation
  if (suppressNextContinuation !== undefined && typeof suppressNextContinuation !== "boolean") {
    invalidState(path, "suppressNextContinuation", "must be a boolean")
  }

  const state: AceState = {
    version: 1,
    projectID: storedProjectID,
    sessionID: storedSessionID,
    mode: stateEnum(value, "mode", path, MODES),
    objective: stateString(value, "objective", path),
    acceptanceCriteria: stateStringArray(value, "acceptanceCriteria", path, false),
    constraints: stateStringArray(value, "constraints", path, true),
    verificationPlan: stateStringArray(value, "verificationPlan", path, false),
    status: stateEnum(value, "status", path, STATUSES),
    continuationCount: stateInteger(value, "continuationCount", path, 0),
    maxContinuations: stateInteger(value, "maxContinuations", path, 1),
    stallCount: stateInteger(value, "stallCount", path, 0),
    maxStalls: stateInteger(value, "maxStalls", path, 1),
    maxMinutes: stateInteger(value, "maxMinutes", path, 1),
    revision: stateInteger(value, "revision", path, 1),
    evidence: stateEvidence(value, path),
    createdAt: stateTimestamp(value, "createdAt", path),
    budgetStartedAt: stateTimestamp(value, "budgetStartedAt", path),
    updatedAt: stateTimestamp(value, "updatedAt", path),
  }

  const lastHandledMessageID = optionalStateString(value, "lastHandledMessageID", path)
  if (lastHandledMessageID !== undefined) state.lastHandledMessageID = lastHandledMessageID
  if (suppressNextContinuation !== undefined) state.suppressNextContinuation = suppressNextContinuation
  const latestSummary = optionalStateString(value, "latestSummary", path)
  if (latestSummary !== undefined) state.latestSummary = latestSummary
  const nextAction = optionalStateString(value, "nextAction", path)
  if (nextAction !== undefined) state.nextAction = nextAction
  const stopReason = optionalStateString(value, "stopReason", path)
  if (stopReason !== undefined) state.stopReason = stopReason
  const finalVerification = optionalStateString(value, "finalVerification", path)
  if (finalVerification !== undefined) state.finalVerification = finalVerification
  return state
}

function parseState(content: string, path: string, projectID: string, sessionID: string): AceState {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    invalidState(path, "JSON", `could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }
  return validateState(value, path, projectID, sessionID)
}

async function loadState(projectID: string, sessionID: string): Promise<AceState> {
  const path = stateFile(projectID, sessionID)
  return parseState(await readFile(path, "utf8"), path, projectID, sessionID)
}

async function readState(projectID: string, sessionID: string): Promise<AceState | undefined> {
  return serialized(async () => {
    try {
      return await loadState(projectID, sessionID)
    } catch (error) {
      if (isMissingFileError(error)) return undefined
      throw error
    }
  })
}

// Write to a temporary file and rename, so a crash mid-write cannot leave truncated state
// that later reads would have to recover from.
async function writeState(state: AceState): Promise<void> {
  await mkdir(stateDirectory, { recursive: true })
  const destination = stateFile(state.projectID, state.sessionID)
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  await rename(temporary, destination)
}

async function replaceState(state: AceState): Promise<AceState> {
  return serialized(async () => {
    await writeState(state)
    return state
  })
}

async function mutateState(
  projectID: string,
  sessionID: string,
  mutate: (state: AceState) => AceState,
): Promise<AceState> {
  return serialized(async () => {
    let current: AceState
    try {
      current = await loadState(projectID, sessionID)
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new Error("No Ace mission exists for this session")
      }
      throw error
    }
    const updated = mutate(current)
    await writeState(updated)
    return updated
  })
}

function clamp(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.trunc(value), maximum))
}

function normalizeMode(value: string | undefined): AceMode {
  if (!value) return "deliver"
  const mode = MODES.find((candidate) => candidate === value)
  if (!mode) {
    throw new Error(`Ace mode must be one of: ${MODES.join(", ")}`)
  }
  return mode
}

function requiredTrimmed(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Ace ${field} must not be empty`)
  return trimmed
}

function requiredTrimmedArray(values: string[], field: string): string[] {
  return values.map((value, index) => requiredTrimmed(value, `${field}[${index}]`))
}

function elapsedMinutes(state: AceState): number {
  return (Date.now() - Date.parse(state.budgetStartedAt)) / MILLISECONDS_PER_MINUTE
}

function formatState(state: AceState): string {
  return [
    `Ace mission: ${state.objective}`,
    `Mode: ${state.mode}`,
    `Status: ${state.status}`,
    `Evidence entries: ${state.evidence.length}`,
    `Continuations: ${state.continuationCount}/${state.maxContinuations}`,
    `Stalls: ${state.stallCount}/${state.maxStalls}`,
    `Budget time: ${Math.floor(elapsedMinutes(state))}/${state.maxMinutes} minutes`,
    state.latestSummary ? `Latest: ${state.latestSummary}` : undefined,
    state.nextAction ? `Next: ${state.nextAction}` : undefined,
    state.stopReason ? `Stop reason: ${state.stopReason}` : undefined,
    "",
    JSON.stringify(state, null, 2),
  ].filter((line) => line !== undefined).join("\n")
}

function requireActive(state: AceState): void {
  if (state.status !== "active") throw new Error(`Ace mission is ${state.status}, not active`)
}

async function claimContinuation(
  projectID: string,
  sessionID: string,
  assistantMessageID: string,
): Promise<{ state: AceState; shouldPrompt: boolean }> {
  return serialized(async () => {
    let state: AceState
    try {
      state = await loadState(projectID, sessionID)
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new Error("No Ace mission exists for this session")
      }
      throw error
    }

    if (state.status !== "active" || state.lastHandledMessageID === assistantMessageID) {
      return { state, shouldPrompt: false }
    }

    if (state.suppressNextContinuation) {
      const suppressed = { ...state, suppressNextContinuation: false, lastHandledMessageID: assistantMessageID }
      await writeState(suppressed)
      return { state: suppressed, shouldPrompt: false }
    }

    const limitReason = elapsedMinutes(state) >= state.maxMinutes
      ? `Reached the ${state.maxMinutes}-minute Ace budget`
      : state.continuationCount >= state.maxContinuations
        ? `Reached the ${state.maxContinuations}-continuation Ace budget`
        : undefined

    if (limitReason) {
      const limited: AceState = {
        ...state,
        status: "limit-reached",
        stopReason: limitReason,
        revision: state.revision + 1,
        updatedAt: now(),
      }
      await writeState(limited)
      return { state: limited, shouldPrompt: false }
    }

    const claimed: AceState = {
      ...state,
      continuationCount: state.continuationCount + 1,
      lastHandledMessageID: assistantMessageID,
    }
    await writeState(claimed)
    return { state: claimed, shouldPrompt: true }
  })
}

function continuationPrompt(state: AceState): string {
  return `AUTOMATIC ACE CONTINUATION\n\n${formatState(state)}\n\n` +
    "Load and obey the ace skill. Inspect current project state instead of trusting the summary. " +
    "Continue the smallest safe action that advances an unmet criterion or reduces its highest risk. " +
    "Do not broaden scope or ask about routine reversible choices. " +
    "Before yielding, call ace_progress with fresh evidence and the exact next action, even when no material progress occurred. " +
    "If every criterion is proven, perform the completion audit and call ace_complete this turn. " +
    "Pause only when consequential user judgment or authorization is required."
}

export const AcePlugin: Plugin = async ({ client, project, directory }) => ({
  event: async ({ event }) => {
    if (event.type === "message.updated" && event.properties.info.role === "assistant") {
      latestAssistantMessage.set(event.properties.info.sessionID, event.properties.info.id)
      return
    }

    if (event.type !== "session.idle" && event.type !== "session.error") return
    const sessionID = event.properties.sessionID
    if (!sessionID) return

    if (event.type === "session.error") {
      await mutateState(project.id, sessionID, (state) => {
        if (state.status !== "active") return state
        return {
          ...state,
          status: "blocked",
          stopReason: `OpenCode session error: ${JSON.stringify(event.properties.error ?? "unknown")}`,
          revision: state.revision + 1,
          updatedAt: now(),
        }
      }).catch(() => undefined)
      return
    }

    const assistantMessageID = latestAssistantMessage.get(sessionID)
    if (!assistantMessageID) return

    const claim = await claimContinuation(project.id, sessionID, assistantMessageID).catch(() => undefined)
    if (!claim?.shouldPrompt) return

    try {
      await client.session.promptAsync({
        path: { id: sessionID },
        query: { directory },
        body: { parts: [{ type: "text", text: continuationPrompt(claim.state), synthetic: true }] },
        throwOnError: true,
      })
    } catch (error) {
      await mutateState(project.id, sessionID, (state) => ({
        ...state,
        status: "blocked",
        stopReason: `Could not submit the next Ace turn: ${error instanceof Error ? error.message : String(error)}`,
        revision: state.revision + 1,
        updatedAt: now(),
      })).catch(() => undefined)
    }
  },

  "experimental.session.compacting": async (input, output) => {
    const state = await readState(project.id, input.sessionID)
    if (!state || state.status === "cancelled") return
    output.context.push(`## Persistent Ace state\n${formatState(state)}\n\nPreserve this state and obey the Ace contract.`)
  },

  tool: {
    ace_start: tool({
      description: "Start a bounded persistent Ace mission in this OpenCode session.",
      args: {
        mode: tool.schema.string().optional(),
        objective: tool.schema.string().min(1),
        acceptanceCriteria: tool.schema.array(tool.schema.string().min(1)).min(1),
        constraints: tool.schema.array(tool.schema.string().min(1)).optional(),
        verificationPlan: tool.schema.array(tool.schema.string().min(1)).min(1),
        maxContinuations: tool.schema.number().int().optional(),
        maxMinutes: tool.schema.number().int().optional(),
        maxStalls: tool.schema.number().int().optional(),
        replace: tool.schema.boolean().optional(),
      },
      async execute(args, context) {
        const objective = requiredTrimmed(args.objective, "objective")
        const acceptanceCriteria = requiredTrimmedArray(args.acceptanceCriteria, "acceptanceCriteria")
        const constraints = requiredTrimmedArray(args.constraints ?? [], "constraints")
        const verificationPlan = requiredTrimmedArray(args.verificationPlan, "verificationPlan")
        const existing = await readState(project.id, context.sessionID)
        if (existing && PROTECTED_START_STATUSES.includes(existing.status) && !args.replace) {
          throw new Error("An unfinished Ace mission exists. Confirm replacement before using replace=true.")
        }
        const timestamp = now()
        return formatState(await replaceState({
          version: 1,
          projectID: project.id,
          sessionID: context.sessionID,
          mode: normalizeMode(args.mode),
          objective,
          acceptanceCriteria,
          constraints,
          verificationPlan,
          status: "active",
          continuationCount: 0,
          maxContinuations: clamp(args.maxContinuations, DEFAULT_MAX_CONTINUATIONS, MAX_CONTINUATIONS),
          stallCount: 0,
          maxStalls: clamp(args.maxStalls, DEFAULT_MAX_STALLS, MAX_STALLS),
          maxMinutes: clamp(args.maxMinutes, DEFAULT_MAX_MINUTES, MAX_MINUTES),
          revision: 1,
          evidence: [],
          nextAction: "Inspect current state and begin with the highest-risk unmet criterion.",
          createdAt: timestamp,
          budgetStartedAt: timestamp,
          updatedAt: timestamp,
        }))
      },
    }),

    ace_status: tool({
      description: "Read the current Ace mission; user-requested status can suppress one automatic continuation.",
      args: { suppressContinuation: tool.schema.boolean().optional() },
      async execute(args, context) {
        const state = await readState(project.id, context.sessionID)
        if (!state) return "No Ace mission exists for this session."
        if (!args.suppressContinuation || state.status !== "active") return formatState(state)
        return formatState(await mutateState(project.id, context.sessionID, (current) => ({
          ...current,
          suppressNextContinuation: true,
          updatedAt: now(),
        })))
      },
    }),

    ace_progress: tool({
      description: "Record one Ace iteration, its evidence, and the next action.",
      args: {
        summary: tool.schema.string().min(1),
        evidence: tool.schema.array(tool.schema.string().min(1)).optional(),
        madeProgress: tool.schema.boolean(),
        nextAction: tool.schema.string().min(1),
        blocker: tool.schema.string().min(1).optional(),
      },
      async execute(args, context) {
        return formatState(await mutateState(project.id, context.sessionID, (state) => {
          requireActive(state)
          const stallCount = args.madeProgress ? 0 : state.stallCount + 1
          const blocked = stallCount >= state.maxStalls
          const updated: AceState = {
            ...state,
            status: blocked ? "blocked" : "active",
            stallCount,
            evidence: [
              ...state.evidence,
              ...(args.evidence ?? []).map((note) => ({ note: note.trim(), recordedAt: now() })),
            ].slice(-MAX_EVIDENCE_ENTRIES),
            latestSummary: args.summary.trim(),
            nextAction: args.nextAction.trim(),
            revision: state.revision + 1,
            updatedAt: now(),
          }
          if (blocked) {
            updated.stopReason = args.blocker?.trim() ?? `No material progress for ${stallCount} consecutive iterations`
          } else if (args.blocker) {
            updated.stopReason = args.blocker.trim()
          } else {
            delete updated.stopReason
          }
          return updated
        }))
      },
    }),

    ace_pause: tool({
      description: "Pause the Ace mission for consequential user input or authorization.",
      args: { reason: tool.schema.string().min(1) },
      async execute(args, context) {
        return formatState(await mutateState(project.id, context.sessionID, (state) => {
          requireActive(state)
          return {
            ...state,
            status: "paused",
            stopReason: args.reason.trim(),
            revision: state.revision + 1,
            updatedAt: now(),
          }
        }))
      },
    }),

    ace_resume: tool({
      description: "Resume a paused, blocked, or limited Ace mission with a fresh execution budget.",
      args: {
        nextAction: tool.schema.string().min(1).optional(),
        maxContinuations: tool.schema.number().int().optional(),
        maxMinutes: tool.schema.number().int().optional(),
        maxStalls: tool.schema.number().int().optional(),
      },
      async execute(args, context) {
        return formatState(await mutateState(project.id, context.sessionID, (state) => {
          if (!RESUMABLE_STATUSES.includes(state.status)) {
            throw new Error(`Cannot resume a ${state.status} Ace mission`)
          }
          const resumed: AceState = {
            ...state,
            status: "active",
            continuationCount: 0,
            maxContinuations: clamp(args.maxContinuations, state.maxContinuations, MAX_CONTINUATIONS),
            stallCount: 0,
            maxStalls: clamp(args.maxStalls, state.maxStalls, MAX_STALLS),
            maxMinutes: clamp(args.maxMinutes, state.maxMinutes, MAX_MINUTES),
            revision: state.revision + 1,
            budgetStartedAt: now(),
            updatedAt: now(),
          }
          delete resumed.stopReason
          if (args.nextAction) resumed.nextAction = args.nextAction.trim()
          return resumed
        }))
      },
    }),

    ace_complete: tool({
      description: "Complete an Ace mission only after fresh evidence proves every acceptance criterion.",
      args: {
        criterionEvidence: tool.schema.array(tool.schema.string().min(1)).min(1),
        finalVerification: tool.schema.string().min(1),
      },
      async execute(args, context) {
        const criterionEvidence = requiredTrimmedArray(args.criterionEvidence, "criterionEvidence")
        const finalVerification = requiredTrimmed(args.finalVerification, "finalVerification")
        return formatState(await mutateState(project.id, context.sessionID, (state) => {
          requireActive(state)
          if (criterionEvidence.length !== state.acceptanceCriteria.length) {
            throw new Error(`Expected exactly ${state.acceptanceCriteria.length} criterion evidence entries`)
          }
          const completed: AceState = {
            ...state,
            status: "completed",
            evidence: [
              ...state.evidence,
              ...criterionEvidence.map((note) => ({ note, recordedAt: now() })),
            ].slice(-MAX_EVIDENCE_ENTRIES),
            finalVerification,
            latestSummary: "Every acceptance criterion has fresh verification evidence.",
            revision: state.revision + 1,
            updatedAt: now(),
          }
          delete completed.nextAction
          delete completed.stopReason
          return completed
        }))
      },
    }),

    ace_cancel: tool({
      description: "Cancel the Ace mission without claiming completion.",
      args: { reason: tool.schema.string().min(1) },
      async execute(args, context) {
        return formatState(await mutateState(project.id, context.sessionID, (state) => ({
          ...state,
          status: "cancelled",
          stopReason: args.reason.trim(),
          revision: state.revision + 1,
          updatedAt: now(),
        })))
      },
    }),

    ace_clear: tool({
      description: "Delete this session's persisted Ace state after an explicit user request.",
      args: {},
      async execute(_args, context) {
        return serialized(async () => {
          const path = stateFile(project.id, context.sessionID)
          try {
            try {
              parseState(await readFile(path, "utf8"), path, project.id, context.sessionID)
            } catch (error) {
              throw new Error(
                `Cannot clear Ace state for project ${JSON.stringify(project.id)} and session ${JSON.stringify(context.sessionID)}: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
            await unlink(path)
            return "Ace state cleared for this session."
          } catch (error) {
            if (isMissingFileError(error)) {
              return "No Ace mission exists for this session."
            }
            throw error
          }
        })
      },
    }),
  },
})
