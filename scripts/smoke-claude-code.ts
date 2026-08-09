import { cp, mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { repositoryRoot, skillsDirectory } from "./skill-data"

const MANIFEST_DIRECTORY = ".claude-plugin"
const PLUGIN_MANIFEST = "plugin.json"
const PASSED = "Validation passed"
const ANSI = /\[[0-9;]*m/g

async function validate(target: string, label: string): Promise<void> {
  const child = Bun.spawn(["claude", "plugin", "validate", "--strict", target], { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  const output = `${stdout}\n${stderr}`.replace(ANSI, "")

  if (exitCode !== 0) {
    throw new Error(`Claude Code rejected the ${label} with exit ${exitCode}:\n${output}`)
  }
  // A zero exit with no verdict line means the command changed shape rather than that it approved
  // anything, so treat a silent pass as a failure.
  if (!output.includes(PASSED)) {
    throw new Error(`Claude Code exited 0 without reporting a verdict on the ${label}:\n${output}`)
  }
  console.log(`Claude Code accepted the ${label}`)
}

// The plugin manifest resolves skills relative to the directory that holds `.claude-plugin`, so the
// staged copy has to mirror that layout. Staging keeps the check read-only: validating in place
// would still pass, but installing for real would write into the caller's own configuration.
const staging = await mkdtemp(join(tmpdir(), "skills-claude-code-"))
try {
  await mkdir(join(staging, MANIFEST_DIRECTORY))
  await cp(resolve(repositoryRoot, MANIFEST_DIRECTORY, PLUGIN_MANIFEST), join(staging, MANIFEST_DIRECTORY, PLUGIN_MANIFEST))
  await cp(skillsDirectory, join(staging, "skills"), { recursive: true })

  await validate(staging, "plugin manifest")
  await validate(repositoryRoot, "marketplace manifest")
} finally {
  await rm(staging, { force: true, recursive: true })
}
