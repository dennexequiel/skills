import { describe, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { requireReleaseVersion } from "../scripts/release-version"
import { hasCompletedAceStatusInvocation } from "../scripts/smoke-opencode"

const root = resolve(import.meta.dir, "..")
const skill = await readFile(resolve(root, "skills/ace/SKILL.md"), "utf8")
const partnership = await readFile(resolve(root, "skills/ace/references/partnership.md"), "utf8")
const command = await readFile(resolve(root, "adapters/opencode/command/ace.md"), "utf8")
const plugin = await readFile(resolve(root, "adapters/opencode/plugin/ace.ts"), "utf8")
const triggers = JSON.parse(await readFile(resolve(root, "evals/ace/triggers.json"), "utf8")) as {
  positive: string[]
  negative: string[]
  ambiguous: Array<{ prompt: string; expected: string }>
}
const catalog = JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8")) as {
  skills: Array<{ name: string; status: string; areas: string[] }>
}
const aceCatalogEntry = catalog.skills.find(({ name }) => name === "ace")
const compatibility = await readFile(resolve(root, "docs/compatibility.md"), "utf8")
const repositoryReadme = await readFile(resolve(root, "README.md"), "utf8")
const aceReadme = await readFile(resolve(root, "skills/ace/README.md"), "utf8")

const WHITESPACE_SCENARIO = String.raw`
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const hooks = await AcePlugin({ client: {}, project: { id: "project" }, directory: process.cwd() })
const tools = hooks.tool
if (!tools) throw new Error("Ace plugin did not register tools")
const context = { sessionID: "whitespace-session" }
const validStart = {
  objective: "Ship the change",
  acceptanceCriteria: ["The check passes"],
  constraints: ["Keep scope narrow"],
  verificationPlan: ["Run the check"],
}
const errorMessage = async (operation) => {
  try {
    await operation()
    return "NO_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const objective = await errorMessage(() => tools.ace_start.execute({ ...validStart, objective: "  " }, context))
const acceptanceCriteria = await errorMessage(() => tools.ace_start.execute({ ...validStart, acceptanceCriteria: ["\t"] }, context))
const constraints = await errorMessage(() => tools.ace_start.execute({ ...validStart, constraints: ["\n"] }, context))
const verificationPlan = await errorMessage(() => tools.ace_start.execute({ ...validStart, verificationPlan: ["  "] }, context))
const statusAfterInvalidStarts = await tools.ace_status.execute({}, context)

await tools.ace_start.execute(validStart, context)
const criterionEvidence = await errorMessage(() => tools.ace_complete.execute({
  criterionEvidence: ["  "],
  finalVerification: "The full check passes",
}, context))
const finalVerification = await errorMessage(() => tools.ace_complete.execute({
  criterionEvidence: ["The full check passes"],
  finalVerification: "\t",
}, context))
const statusAfterInvalidCompletion = await tools.ace_status.execute({}, context)

console.log(JSON.stringify({
  objective,
  acceptanceCriteria,
  constraints,
  verificationPlan,
  statusAfterInvalidStarts,
  criterionEvidence,
  finalVerification,
  statusAfterInvalidCompletion,
}))
`

const CLEAR_COLLISION_SCENARIO = String.raw`
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const firstHooks = await AcePlugin({ client: {}, project: { id: "a/b" }, directory: process.cwd() })
const secondHooks = await AcePlugin({ client: {}, project: { id: "a?b" }, directory: process.cwd() })
if (!firstHooks.tool || !secondHooks.tool) throw new Error("Ace plugin did not register tools")
const context = { sessionID: "shared-session" }
await firstHooks.tool.ace_start.execute({
  objective: "Preserve this mission",
  acceptanceCriteria: ["State remains readable"],
  verificationPlan: ["Read status after the rejected clear"],
}, context)

let clearError = "NO_ERROR"
try {
  await secondHooks.tool.ace_clear.execute({}, context)
} catch (error) {
  clearError = error instanceof Error ? error.message : String(error)
}
const originalStatus = await firstHooks.tool.ace_status.execute({}, context)

console.log(JSON.stringify({ clearError, originalStatus }))
`

const MALFORMED_STATE_SCENARIO = String.raw`
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { AcePlugin } from "./adapters/opencode/plugin/ace.ts"

const stateDirectory = join(process.env.XDG_STATE_HOME, "opencode", "ace")
await mkdir(stateDirectory, { recursive: true })
const hooks = await AcePlugin({ client: {}, project: { id: "project" }, directory: process.cwd() })
if (!hooks.tool) throw new Error("Ace plugin did not register tools")
const timestamp = "2026-08-07T00:00:00.000Z"
const validState = {
  version: 1,
  projectID: "project",
  sessionID: "fixture",
  mode: "deliver",
  objective: "Validate state",
  acceptanceCriteria: ["Invalid state is rejected"],
  constraints: [],
  verificationPlan: ["Read the state"],
  status: "active",
  continuationCount: 0,
  maxContinuations: 20,
  stallCount: 0,
  maxStalls: 3,
  maxMinutes: 60,
  revision: 1,
  evidence: [],
  createdAt: timestamp,
  budgetStartedAt: timestamp,
  updatedAt: timestamp,
}
const errorMessage = async (sessionID, mutate) => {
  const state = structuredClone(validState)
  state.sessionID = sessionID
  mutate(state)
  await writeFile(join(stateDirectory, "project--" + sessionID + ".json"), JSON.stringify(state))
  try {
    await hooks.tool.ace_status.execute({}, { sessionID })
    return "NO_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const missingArray = await errorMessage("missing-array", (state) => { delete state.evidence })
const invalidStatus = await errorMessage("invalid-status", (state) => { state.status = "running" })
const invalidCounter = await errorMessage("invalid-counter", (state) => { state.continuationCount = "zero" })
console.log(JSON.stringify({ missingArray, invalidStatus, invalidCounter }))
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requireResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Ace plugin scenario must return a JSON object")
  }
  return value
}

function resultString(result: Record<string, unknown>, field: string): string {
  const value = result[field]
  if (typeof value !== "string") throw new Error(`Ace plugin scenario field ${field} must be a string`)
  return value
}

async function runAcePluginScenario(source: string): Promise<Record<string, unknown>> {
  const stateRoot = await mkdtemp(join(tmpdir(), "ace-plugin-state-"))
  try {
    const child = Bun.spawn(["bun", "--eval", source], {
      cwd: root,
      env: { ...Bun.env, XDG_STATE_HOME: stateRoot },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error(`Ace plugin scenario exited with ${exitCode}: ${stderr}`)
    const result: unknown = JSON.parse(stdout)
    return requireResult(result)
  } finally {
    await rm(stateRoot, { force: true, recursive: true })
  }
}

describe("Ace portable contract", () => {
  test("advertises optional modes to clients that support argument hints", () => {
    expect(skill).toContain('argument-hint: "[deliver|learn|explore|decide] <mission>"')
  })

  test("keeps consequential questions and reversible defaults together", () => {
    expect(skill).toContain("Ask a question only when")
    expect(skill).toContain("choose the safest reversible default")
    expect(partnership).toContain("Do not front-load hypothetical edge cases")
  })

  test("preserves distinct delivery and learning responsibilities", () => {
    expect(skill).toContain("In `deliver` mode")
    expect(skill).toContain("In `learn` mode")
    expect(skill).toContain("let the user make the requested architecture or reasoning decisions")
    expect(skill).toContain("one lightweight observable demonstration")
  })

  test("bounds initially open-ended missions with finite defaults", () => {
    expect(skill).toContain("Ace may first bound an open-ended request")
    expect(skill).toContain("20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations")
  })

  test("requires evidence and finite terminal states", () => {
    for (const status of ["completed", "paused", "blocked", "limit-reached", "cancelled"]) {
      expect(skill).toContain(`\`${status}\``)
    }
    expect(skill).toContain("fresh evidence proves every agreed criterion")
  })
})

describe("Ace distribution", () => {
  test("has routing coverage on both sides of its activation boundary", () => {
    expect(triggers.positive.length).toBeGreaterThanOrEqual(5)
    expect(triggers.negative.length).toBeGreaterThanOrEqual(5)
    expect(triggers.ambiguous.length).toBeGreaterThanOrEqual(2)
  })

  test("publishes honest maturity and per-skill compatibility metadata", () => {
    expect(aceCatalogEntry).toEqual(
      expect.objectContaining({ name: "ace", status: "experimental", areas: ["workflow", "autonomy"] }),
    )
    expect(compatibility).toContain("Format-compatible")
    expect(compatibility).toContain("Smoke-tested")
    expect(compatibility).toContain("Automation adapter")
    expect(compatibility).toContain("| [Ace](../skills/ace/) | OpenCode | Yes | Yes (`bun run smoke:opencode`) | Yes |")
    expect(compatibility).toContain("| [Ace](../skills/ace/) | Claude Code | Yes | Yes (`bun run smoke:claude-code`) | No |")
  })

  test("limits the integration gate to automated coverage the repository provides", () => {
    expect(compatibility).toContain("The host discovery and invocation path has a reproducible smoke command")
    expect(compatibility).toContain("forced-upgrade regression tests when present")
    expect(compatibility).not.toContain("stopping, and upgrade behavior have automated smoke tests")
  })

  test("requires a completed structured ace_status tool event for smoke verification", () => {
    const completedToolEvent = JSON.stringify({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "ace_status",
        state: { status: "completed", output: "No Ace mission exists for this session." },
      },
    })
    const echoedTextEvent = JSON.stringify({
      type: "text",
      part: { text: "ace_status: No Ace mission exists for this session." },
    })

    expect(hasCompletedAceStatusInvocation(completedToolEvent)).toBe(true)
    expect(hasCompletedAceStatusInvocation(echoedTextEvent)).toBe(false)
    expect(hasCompletedAceStatusInvocation("ace_status: No Ace mission exists for this session.")).toBe(false)
  })

  test("keeps repository and skill installation guidance at the right scope", () => {
    expect(repositoryReadme).toContain("--skill SKILL_NAME")
    expect(repositoryReadme).not.toContain("Install Ace")
    expect(aceReadme).toContain("--skill ace")
    expect(aceReadme).toContain("--agent claude-code --global --yes")
    expect(aceReadme).toContain("OpenCode Automation Adapter")
  })

  test("wires the OpenCode command to the portable skill and adapter tools", () => {
    expect(command).toContain("`ace` skill")
    for (const tool of ["ace_start", "ace_status", "ace_progress", "ace_complete"]) {
      expect(command).toContain(tool)
      expect(plugin).toContain(`${tool}: tool({`)
    }
  })

  test("installs a complete OpenCode bundle and protects existing files", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "ace-opencode-"))
    await writeFile(resolve(configRoot, "package.json"), JSON.stringify({
      dependencies: { "@opencode-ai/plugin": "1.18.5" },
    }), "utf8")
    const runInstaller = async (...args: string[]) => {
      const process = Bun.spawn(["bun", "scripts/install-opencode.ts", ...args], {
        cwd: root,
        env: { ...Bun.env, OPENCODE_CONFIG_DIR: configRoot },
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
      ])
      return { exitCode, stdout, stderr }
    }

    try {
      const help = await runInstaller("--help")
      expect(help.exitCode).toBe(0)
      expect(help.stdout).toContain("Usage: bun run install:opencode [--force]")
      expect(await access(resolve(configRoot, "skills/ace")).then(() => true, () => false)).toBe(false)

      const first = await runInstaller()
      expect(first.exitCode).toBe(0)
      await access(resolve(configRoot, "skills/ace/LICENSE"))
      await access(resolve(configRoot, "skills/ace/references/evidence.md"))
      await access(resolve(configRoot, "commands/ace.md"))
      await access(resolve(configRoot, "plugins/ace.ts"))

      const second = await runInstaller()
      expect(second.exitCode).not.toBe(0)
      expect(second.stderr).toContain("would overwrite")

      const obsolete = resolve(configRoot, "skills/ace/references/obsolete.md")
      await writeFile(obsolete, "obsolete\n", "utf8")
      const forced = await runInstaller("--force")
      expect(forced.exitCode).toBe(0)
      expect(await access(obsolete).then(() => true, () => false)).toBe(false)
      await access(resolve(configRoot, "skills/ace/references/evidence.md"))
      await access(resolve(configRoot, "commands/ace.md"))
      await access(resolve(configRoot, "plugins/ace.ts"))
    } finally {
      await rm(configRoot, { force: true, recursive: true })
    }
  })
})

describe("Ace OpenCode state", () => {
  test("rejects whitespace-only start and completion fields before writing state", async () => {
    const result = await runAcePluginScenario(WHITESPACE_SCENARIO)

    expect(resultString(result, "objective")).toBe("Ace objective must not be empty")
    expect(resultString(result, "acceptanceCriteria")).toBe("Ace acceptanceCriteria[0] must not be empty")
    expect(resultString(result, "constraints")).toBe("Ace constraints[0] must not be empty")
    expect(resultString(result, "verificationPlan")).toBe("Ace verificationPlan[0] must not be empty")
    expect(resultString(result, "statusAfterInvalidStarts")).toBe("No Ace mission exists for this session.")
    expect(resultString(result, "criterionEvidence")).toBe("Ace criterionEvidence[0] must not be empty")
    expect(resultString(result, "finalVerification")).toBe("Ace finalVerification must not be empty")
    expect(resultString(result, "statusAfterInvalidCompletion")).toContain("Status: active")
  })

  test("refuses to clear a colliding session state", async () => {
    const result = await runAcePluginScenario(CLEAR_COLLISION_SCENARIO)

    expect(resultString(result, "clearError")).toContain("Cannot clear Ace state for project \"a?b\"")
    expect(resultString(result, "clearError")).toContain("field projectID must match \"a?b\"")
    expect(resultString(result, "originalStatus")).toContain("Ace mission: Preserve this mission")
    expect(resultString(result, "originalStatus")).toContain("Status: active")
  })

  test("rejects malformed persisted state at the file boundary", async () => {
    const result = await runAcePluginScenario(MALFORMED_STATE_SCENARIO)

    expect(resultString(result, "missingArray")).toContain("project--missing-array.json: field evidence must be an array")
    expect(resultString(result, "invalidStatus")).toContain("project--invalid-status.json: field status must be one of")
    expect(resultString(result, "invalidCounter")).toContain("project--invalid-counter.json: field continuationCount must be an integer")
  })
})

describe("Repository releases", () => {
  test("accepts stable and prerelease SemVer", () => {
    expect(requireReleaseVersion("0.1.0")).toBe("0.1.0")
    expect(requireReleaseVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1")
  })

  test("rejects ambiguous or prefixed versions", () => {
    for (const value of ["v1.2.3", "1.2", "01.2.3", "1.2.3-beta.01", "latest", undefined]) {
      expect(() => requireReleaseVersion(value)).toThrow("valid SemVer")
    }
  })
})
