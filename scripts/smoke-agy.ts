import { cp, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { loadSkills, repositoryRoot, skillsDirectory } from "./skill-data"

const PLUGIN_MANIFEST = "plugin.json"
const PROCESSED_SKILLS = /skills\s*:\s*(\d+) processed/
const ANSI = /\[[0-9;]*m/g

// Antigravity resolves a plugin from a manifest at the target root, while Claude Code reads the
// same manifest from .claude-plugin. Staging the layout keeps the check read-only: installing for
// real would write into the caller's own Antigravity configuration.
const staging = await mkdtemp(join(tmpdir(), "ace-agy-"))
try {
  const skills = await loadSkills()
  await cp(skillsDirectory, join(staging, "skills"), { recursive: true })
  await cp(resolve(repositoryRoot, ".claude-plugin", PLUGIN_MANIFEST), join(staging, PLUGIN_MANIFEST))

  const validate = Bun.spawn(["agy", "plugin", "validate", staging], { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    validate.exited,
    new Response(validate.stdout).text(),
    new Response(validate.stderr).text(),
  ])
  const output = `${stdout}\n${stderr}`.replace(ANSI, "")

  if (exitCode !== 0) {
    throw new Error(`Antigravity smoke test exited with ${exitCode}:\n${output}`)
  }
  const processed = output.match(PROCESSED_SKILLS)?.[1]
  if (processed === undefined) {
    throw new Error(`Antigravity did not report a processed skill count:\n${output}`)
  }
  if (Number(processed) !== skills.length) {
    throw new Error(`Antigravity processed ${processed} skills; the catalog publishes ${skills.length}`)
  }

  console.log(`Antigravity loaded the plugin and processed ${processed} skills`)
} finally {
  await rm(staging, { force: true, recursive: true })
}
