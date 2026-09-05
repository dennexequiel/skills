import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const EXPECTED_STATUS_OUTPUT = "No Ace mission exists for this session."
const SMOKE_COMMAND = ["opencode", "run", "--format", "json", "--command", "ace", "status"]
const SMOKE_TIMEOUT_MS = 120_000
const repositoryRoot = resolve(import.meta.dir, "..")

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function hasCompletedAceStatusInvocation(stdout: string, expectedOutput = EXPECTED_STATUS_OUTPUT): boolean {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (!isRecord(event) || event.type !== "tool_use" || !isRecord(event.part)) continue
    const part = event.part
    if (part.type !== "tool" || part.tool !== "ace_status" || !isRecord(part.state)) continue
    if (part.state.status === "completed" && part.state.output === expectedOutput) return true
  }
  return false
}

if (import.meta.main) {
  const staging = await mkdtemp(join(tmpdir(), "ace-opencode-smoke-"))
  try {
    const config = join(staging, "config")
    const workspace = join(staging, "workspace")
    await mkdir(join(config, "commands"), { recursive: true })
    await mkdir(workspace)
    await cp(resolve(repositoryRoot, "adapters/opencode/command/ace.md"), join(config, "commands/ace.md"))
    await cp(resolve(repositoryRoot, "skills/ace"), join(config, "skills/ace"), { recursive: true })

    const adapter = resolve(repositoryRoot, "adapters/opencode/plugin/ace.ts")
    const adapterURL = pathToFileURL(adapter).href
    const sourceHash = createHash("sha256").update(await Bun.file(adapter).text()).digest("hex")
    const sourceMarker = `Ace adapter source: ${sourceHash}`
    const wrapper = join(staging, "current-ace.mjs")
    // The marker comes from the exact function under test, so an older installed tool cannot pass.
    await writeFile(wrapper, `import { AcePlugin } from ${JSON.stringify(adapterURL)}
export const CurrentAceSmoke = async (context) => {
  const hooks = await AcePlugin(context)
  const status = hooks.tool?.ace_status
  if (!status) throw new Error("Current Ace adapter did not register ace_status")
  return { ...hooks, tool: { ...hooks.tool, ace_status: {
    ...status,
    execute: async (args, context) => (await status.execute(args, context)) + "\\n" + ${JSON.stringify(sourceMarker)},
  } } }
}
`)
    const childProcess = Bun.spawn([...SMOKE_COMMAND, "--dir", workspace], {
      env: {
        ...Bun.env,
        OPENCODE_CONFIG_DIR: config,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({ plugin: [pathToFileURL(wrapper).href] }),
        XDG_STATE_HOME: join(staging, "state"),
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const timer = setTimeout(() => childProcess.kill("SIGKILL"), SMOKE_TIMEOUT_MS)
    let exitCode: number
    let stdout: string
    let stderr: string
    try {
      [exitCode, stdout, stderr] = await Promise.all([
        childProcess.exited,
        new Response(childProcess.stdout).text(),
        new Response(childProcess.stderr).text(),
      ])
    } finally {
      clearTimeout(timer)
    }
    const output = `${stdout}\n${stderr}`
    if (exitCode !== 0) {
      throw new Error(`OpenCode Ace smoke test exited with ${exitCode} (timeout ${SMOKE_TIMEOUT_MS}ms); adapter ${adapter}:\n${output}`)
    }
    if (!hasCompletedAceStatusInvocation(stdout, `${EXPECTED_STATUS_OUTPUT}\n${sourceMarker}`)) {
      throw new Error(`OpenCode did not emit a completed ace_status event from ${adapter}:\n${output}`)
    }
    if (createHash("sha256").update(await Bun.file(adapter).text()).digest("hex") !== sourceHash) {
      throw new Error(`Ace adapter changed during the smoke test: ${adapter}. Run the check against stable source.`)
    }

    console.log(`OpenCode invoked the current Ace adapter: ${sourceHash}`)
  } finally {
    await rm(staging, { force: true, recursive: true })
  }
}
