import { lstat, readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { loadSkills, repositoryRoot } from "./skill-data"

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MINIMUM_BEHAVIOR_CASES = 5
const EVALUATION_SCHEMA_VERSION = 1
const TRIGGER_SCHEMA_VERSION = 1
const MAXIMUM_SKILL_NAME_LENGTH = 64
const MAXIMUM_DESCRIPTION_LENGTH = 1024
const MAXIMUM_SUMMARY_LENGTH = 200
const MAXIMUM_COMPATIBILITY_LENGTH = 500
const MAXIMUM_SKILL_LINES = 500
const REQUIRED_BUNDLE_FILES = ["README.md", "LICENSE"]
const REQUIRED_README_HEADINGS = ["Install", "Use", "Compatibility", "Limitations"]
const COMPATIBILITY_CLAIMS = ["Yes", "No", "Not yet", "Unverified"] as const
const SMOKE_CLAIM_PATTERN = /^Yes \(`bun run ([a-z0-9:_-]+)`\)$/

type CompatibilityClaim = typeof COMPATIBILITY_CLAIMS[number]

type CompatibilityRow = {
  skill: string
  host: string
  formatCompatible: CompatibilityClaim
  smokeTested: CompatibilityClaim
  automationAdapter: CompatibilityClaim
  invocation: string
}

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

function rawMarkdownLinkTargets(markdown: string): string[] {
  return [
    ...[...markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].flatMap((match) => match[1] ?? []),
    ...[...markdown.matchAll(/^\s{0,3}\[(?!\^)[^\]]+\]:\s*(\S+)/gm)].flatMap((match) => match[1] ?? []),
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
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

function compatibilityClaim(value: string, source: string, column: string): CompatibilityClaim {
  const claim = COMPATIBILITY_CLAIMS.find((candidate) => candidate === value)
  if (!claim) fail(`${source} has invalid ${column} claim: ${value}`)
  return claim
}

function parseCompatibilityRow(row: string, source: string, packageScripts: Record<string, unknown>): CompatibilityRow {
  const cells = row.split("|").slice(1, -1).map((cell) => cell.trim())
  if (cells.length !== 6 || cells.some((cell) => !cell)) fail(`${source} has an incomplete compatibility entry`)
  const [skill, host, formatValue, smokeValue, automationValue, invocation] = cells
  if (!skill || !host || !formatValue || !smokeValue || !automationValue || !invocation) {
    fail(`${source} has an incomplete compatibility entry`)
  }

  const smokeMatch = smokeValue.match(SMOKE_CLAIM_PATTERN)
  let smokeTested: CompatibilityClaim
  if (smokeMatch) {
    const command = smokeMatch[1]
    if (!command || !isNonEmptyString(packageScripts[command])) {
      fail(`${source} claims smoke command ${JSON.stringify(command)} but package.json scripts does not define it`)
    }
    smokeTested = "Yes"
  } else {
    smokeTested = compatibilityClaim(smokeValue, source, "Smoke-tested")
    if (smokeTested === "Yes") {
      fail(`${source} must name its smoke command as Yes (\`bun run <script>\`)`)
    }
  }

  return {
    skill,
    host,
    formatCompatible: compatibilityClaim(formatValue, source, "Format-compatible"),
    smokeTested,
    automationAdapter: compatibilityClaim(automationValue, source, "Automation adapter"),
    invocation,
  }
}

function directSkillResourceTargets(skillName: string, skillDirectory: string, skillPath: string, markdown: string): Set<string> {
  const targets = new Set<string>()
  for (const rawTarget of rawMarkdownLinkTargets(markdown)) {
    const target = localLinkTarget(rawTarget)
    if (target) targets.add(resolve(dirname(skillPath), target))
  }

  const resourcePathPattern = new RegExp(`(?:skills/${skillName}/)?(?:references|scripts)/[a-zA-Z0-9._/-]+`, "g")
  for (const target of markdown.match(resourcePathPattern) ?? []) {
    targets.add(target.startsWith("skills/") ? resolve(repositoryRoot, target) : resolve(skillDirectory, target))
  }
  return targets
}

const skills = await loadSkills()
const compatibility = await readFile(resolve(repositoryRoot, "docs", "compatibility.md"), "utf8")
const repositoryLicense = await readFile(resolve(repositoryRoot, "LICENSE"), "utf8")
const packageData: unknown = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"))
if (!isRecord(packageData) || !isRecord(packageData.scripts)) {
  fail("package.json scripts must be an object")
}
const packageScripts = packageData.scripts
const compatibilityPairs = new Map<string, string>()

for (const skill of skills) {
  const source = relative(repositoryRoot, skill.skillPath)
  if (skill.name !== skill.directory.split(sep).at(-1)) fail(`${source} name must match its directory`)
  if (!NAME_PATTERN.test(skill.name) || skill.name.length > MAXIMUM_SKILL_NAME_LENGTH) fail(`${source} has an invalid skill name`)
  if (skill.description.length > MAXIMUM_DESCRIPTION_LENGTH) fail(`${source} description exceeds ${MAXIMUM_DESCRIPTION_LENGTH} characters`)
  if (skill.summary.length > MAXIMUM_SUMMARY_LENGTH) fail(`${source} metadata.summary exceeds ${MAXIMUM_SUMMARY_LENGTH} characters`)
  if (skill.compatibility && skill.compatibility.length > MAXIMUM_COMPATIBILITY_LENGTH) fail(`${source} compatibility exceeds ${MAXIMUM_COMPATIBILITY_LENGTH} characters`)
  if (skill.license !== "MIT") fail(`${source} license must be MIT`)

  if (skill.content.split(/\r?\n/).length > MAXIMUM_SKILL_LINES) fail(`${source} exceeds ${MAXIMUM_SKILL_LINES} lines`)

  const files = await filesInside(skill.directory)
  for (const requiredFile of REQUIRED_BUNDLE_FILES) {
    if (!files.some((path) => path === resolve(skill.directory, requiredFile))) {
      fail(`${source} must bundle ${requiredFile}`)
    }
  }
  const bundledLicense = await readFile(resolve(skill.directory, "LICENSE"), "utf8")
  if (bundledLicense !== repositoryLicense) fail(`${source} must bundle the root MIT license`)
  const readmePath = resolve(skill.directory, "README.md")
  const readme = await readFile(readmePath, "utf8")
  for (const requiredText of [`# ${skill.displayName}`, `--skill ${skill.name}`]) {
    if (!readme.includes(requiredText)) fail(`${relative(repositoryRoot, readmePath)} must contain ${requiredText}`)
  }
  for (const requiredHeading of REQUIRED_README_HEADINGS) {
    if (!hasLevelTwoHeading(readme, requiredHeading)) {
      fail(`${relative(repositoryRoot, readmePath)} needs a level-two ${requiredHeading} heading`)
    }
  }

  const compatibilityPrefix = `| [${skill.displayName}](../skills/${skill.name}/) |`
  const compatibilityRows = compatibility.split(/\r?\n/).filter((line) => line.startsWith(compatibilityPrefix))
  if (!compatibilityRows.length) {
    fail(`${source} needs an entry in docs/compatibility.md`)
  }
  for (const [index, row] of compatibilityRows.entries()) {
    const rowSource = `docs/compatibility.md ${skill.displayName} row ${index + 1}`
    const parsed = parseCompatibilityRow(row, rowSource, packageScripts)
    const pair = `${skill.name}\0${normalize(parsed.host)}`
    const previous = compatibilityPairs.get(pair)
    if (previous) fail(`Duplicate compatibility pair for ${skill.name} and ${parsed.host}: ${previous}, ${rowSource}`)
    compatibilityPairs.set(pair, rowSource)
  }

  const directResourceTargets = directSkillResourceTargets(skill.name, skill.directory, skill.skillPath, skill.content)
  for (const path of files) {
    const bundledPath = relative(skill.directory, path)
    if (!bundledPath.startsWith(`references${sep}`) && !bundledPath.startsWith(`scripts${sep}`)) continue
    if (!directResourceTargets.has(path)) fail(`${source} must link directly to ${bundledPath}`)
  }

  for (const markdownPath of files.filter((path) => path.endsWith(".md"))) {
    const markdown = await readFile(markdownPath, "utf8")
    for (const rawTarget of rawMarkdownLinkTargets(markdown)) {
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
  if (evaluations.skill !== skill.name || evaluations.version !== EVALUATION_SCHEMA_VERSION) {
    fail(`${relative(repositoryRoot, evaluationsPath)} must identify ${skill.name} with schema version ${EVALUATION_SCHEMA_VERSION}`)
  }
  if (!Array.isArray(evaluations.cases) || evaluations.cases.length < MINIMUM_BEHAVIOR_CASES) {
    fail(`${relative(repositoryRoot, evaluationsPath)} needs at least ${MINIMUM_BEHAVIOR_CASES} behavior cases`)
  }
  const behaviorNames = new Map<string, number>()
  const behaviorPrompts = new Map<string, number>()
  for (const [index, value] of evaluations.cases.entries()) {
    if (!isRecord(value)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} must be an object`)
    }
    const evaluation: BehaviorCase = value
    if (!isNonEmptyString(evaluation.name) || !isNonEmptyString(evaluation.prompt)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} needs a name and prompt`)
    }
    const normalizedName = normalize(evaluation.name)
    const previousName = behaviorNames.get(normalizedName)
    if (previousName !== undefined) {
      fail(`${relative(repositoryRoot, evaluationsPath)} cases ${previousName + 1} and ${index + 1} have duplicate names`)
    }
    behaviorNames.set(normalizedName, index)

    const normalizedPrompt = normalize(evaluation.prompt)
    const previousPrompt = behaviorPrompts.get(normalizedPrompt)
    if (previousPrompt !== undefined) {
      fail(`${relative(repositoryRoot, evaluationsPath)} cases ${previousPrompt + 1} and ${index + 1} have duplicate prompts`)
    }
    behaviorPrompts.set(normalizedPrompt, index)
    if (!isNonEmptyStringArray(evaluation.expected) || !isNonEmptyStringArray(evaluation.antiPatterns)) {
      fail(`${relative(repositoryRoot, evaluationsPath)} case ${index + 1} needs expected behaviors and anti-patterns`)
    }
  }

  const triggersPath = resolve(evalDirectory, "triggers.json")
  const triggers = JSON.parse(await readFile(triggersPath, "utf8")) as { skill?: string; version?: number }
  if (triggers.skill !== skill.name || triggers.version !== TRIGGER_SCHEMA_VERSION) {
    fail(`${relative(repositoryRoot, triggersPath)} must identify ${skill.name} with schema version ${TRIGGER_SCHEMA_VERSION}`)
  }
}

if (!skills.length) fail("No skills found")
console.log(`Validated ${skills.length} self-contained skill${skills.length === 1 ? "" : "s"}: ${skills.map(({ name }) => name).join(", ")}`)
