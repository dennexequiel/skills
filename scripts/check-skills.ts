import { lstat, readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { loadSkills, repositoryRoot } from "./skill-data"

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MINIMUM_BEHAVIOR_CASES = 5

type BehaviorCase = {
  name?: unknown
  prompt?: unknown
  expected?: unknown
  antiPatterns?: unknown
}

type Evaluations = {
  skill?: string
  version?: number
  cases?: unknown
}

function fail(message: string): never {
  throw new Error(message)
}

async function filesInside(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    const details = await lstat(path)
    if (details.isSymbolicLink()) fail(`${relative(repositoryRoot, path)} must not be a symlink`)
    if (details.isDirectory()) files.push(...await filesInside(path))
    else if (details.isFile()) files.push(path)
  }
  return files
}

function localLinkTarget(rawTarget: string): string | undefined {
  const target = rawTarget.trim().replace(/^<|>$/g, "").split(/\s+["']/)[0]
  if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined
  const path = target.split("#")[0]
  return path === undefined ? undefined : decodeURIComponent(path)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim())
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function hasLevelTwoHeading(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^## ${escaped}\\s*$`, "m").test(markdown)
}

const skills = await loadSkills()
const names = new Set<string>()
const compatibility = await readFile(resolve(repositoryRoot, "docs", "compatibility.md"), "utf8")

for (const skill of skills) {
  const source = relative(repositoryRoot, skill.skillPath)
  if (skill.name !== skill.directory.split(sep).at(-1)) fail(`${source} name must match its directory`)
  if (!NAME_PATTERN.test(skill.name) || skill.name.length > 64) fail(`${source} has an invalid skill name`)
  if (skill.description.length > 1024) fail(`${source} description exceeds 1024 characters`)
  if (skill.summary.length > 200) fail(`${source} metadata.summary exceeds 200 characters`)
  if (skill.compatibility && skill.compatibility.length > 500) fail(`${source} compatibility exceeds 500 characters`)
  if (!skill.license) fail(`${source} needs a license field`)
  if (names.has(skill.name)) fail(`Duplicate skill name: ${skill.name}`)
  names.add(skill.name)

  if (skill.content.split(/\r?\n/).length > 500) fail(`${source} exceeds 500 lines`)

  const files = await filesInside(skill.directory)
  for (const requiredFile of ["README.md", "LICENSE"]) {
    if (!files.some((path) => path === resolve(skill.directory, requiredFile))) {
      fail(`${source} must bundle ${requiredFile}`)
    }
  }
  const readmePath = resolve(skill.directory, "README.md")
  const readme = await readFile(readmePath, "utf8")
  for (const requiredText of [`# ${skill.displayName}`, `--skill ${skill.name}`]) {
    if (!readme.includes(requiredText)) fail(`${relative(repositoryRoot, readmePath)} must contain ${requiredText}`)
  }
  for (const requiredHeading of ["Install", "Use", "Compatibility", "Limitations"]) {
    if (!hasLevelTwoHeading(readme, requiredHeading)) {
      fail(`${relative(repositoryRoot, readmePath)} needs a level-two ${requiredHeading} heading`)
    }
  }

  const compatibilityPrefix = `| [${skill.displayName}](../skills/${skill.name}/) |`
  const compatibilityRows = compatibility.split(/\r?\n/).filter((line) => line.startsWith(compatibilityPrefix))
  if (!compatibilityRows.length) {
    fail(`${source} needs an entry in docs/compatibility.md`)
  }
  for (const row of compatibilityRows) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length !== 6 || cells.some((cell) => !cell)) {
      fail(`${source} has an incomplete entry in docs/compatibility.md`)
    }
  }

  for (const markdownPath of files.filter((path) => path.endsWith(".md"))) {
    const markdown = await readFile(markdownPath, "utf8")
    const rawTargets = [
      ...[...markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]),
      ...[...markdown.matchAll(/^\s{0,3}\[(?!\^)[^\]]+\]:\s*(\S+)/gm)].map((match) => match[1]),
    ]
    for (const rawTarget of rawTargets) {
      if (rawTarget === undefined) continue
      const target = localLinkTarget(rawTarget)
      if (!target) continue
      const destination = resolve(dirname(markdownPath), target)
      const insideBundle = destination === skill.directory || destination.startsWith(`${skill.directory}${sep}`)
      if (!insideBundle) fail(`${relative(repositoryRoot, markdownPath)} links outside its skill bundle: ${target}`)
      if (!(await lstat(destination).catch(() => undefined))) {
        fail(`${relative(repositoryRoot, markdownPath)} links to missing ${target}`)
      }
    }
  }

  const evalDirectory = resolve(repositoryRoot, "evals", skill.name)
  const evaluationsPath = resolve(evalDirectory, "evals.json")
  const evaluations = JSON.parse(await readFile(evaluationsPath, "utf8")) as Evaluations
  if (evaluations.skill !== skill.name || evaluations.version !== 1) {
    fail(`${relative(repositoryRoot, evaluationsPath)} must identify ${skill.name} with schema version 1`)
  }
  if (!Array.isArray(evaluations.cases) || evaluations.cases.length < MINIMUM_BEHAVIOR_CASES) {
    fail(`${relative(repositoryRoot, evaluationsPath)} needs at least ${MINIMUM_BEHAVIOR_CASES} behavior cases`)
  }
  for (const [index, value] of evaluations.cases.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} must be an object`)
    }
    const evaluation = value as BehaviorCase
    if (!isNonEmptyString(evaluation.name) || !isNonEmptyString(evaluation.prompt)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} needs a name and prompt`)
    }
    if (!isNonEmptyStringArray(evaluation.expected) || !isNonEmptyStringArray(evaluation.antiPatterns)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} needs expected behaviors and anti-patterns`)
    }
  }

  const triggersPath = resolve(evalDirectory, "triggers.json")
  const triggers = JSON.parse(await readFile(triggersPath, "utf8")) as { skill?: string; version?: number }
  if (triggers.skill !== skill.name || triggers.version !== 1) {
    fail(`${relative(repositoryRoot, triggersPath)} must identify ${skill.name} with schema version 1`)
  }
}

if (!skills.length) fail("No skills found")
console.log(`Validated ${skills.length} self-contained skill${skills.length === 1 ? "" : "s"}: ${[...names].join(", ")}`)
