const EXPECTED_STATUS_OUTPUT = "No Ace mission exists for this session."
const SMOKE_COMMAND = ["opencode", "run", "--format", "json", "--command", "ace", "status"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function hasCompletedAceStatusInvocation(stdout: string): boolean {
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
    if (part.state.status === "completed" && part.state.output === EXPECTED_STATUS_OUTPUT) return true
  }
  return false
}

if (import.meta.main) {
  const childProcess = Bun.spawn(SMOKE_COMMAND, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    childProcess.exited,
    new Response(childProcess.stdout).text(),
    new Response(childProcess.stderr).text(),
  ])
  const output = `${stdout}\n${stderr}`

  if (exitCode !== 0) {
    throw new Error(`OpenCode Ace smoke test exited with ${exitCode}:\n${output}`)
  }
  if (!hasCompletedAceStatusInvocation(stdout)) {
    throw new Error(`OpenCode did not emit a completed ace_status tool event:\n${output}`)
  }

  console.log("OpenCode loaded Ace and invoked ace_status")
}
