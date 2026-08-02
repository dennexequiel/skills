import { lstat, readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { loadSkills, repositoryRoot } from "./skill-data"

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

const skills = await loadSkills()
const names = new Set<string>()

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
  if (!files.some((path) => path === resolve(skill.directory, "LICENSE"))) {
    fail(`${source} must bundle its license`)
  }

  for (const markdownPath of files.filter((path) => path.endsWith(".md"))) {
    const markdown = await readFile(markdownPath, "utf8")
    for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const rawTarget = match[1]
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
  for (const file of ["evals.json", "triggers.json"]) {
    const path = resolve(evalDirectory, file)
    const data = JSON.parse(await readFile(path, "utf8")) as { skill?: string; version?: number }
    if (data.skill !== skill.name || data.version !== 1) {
      fail(`${relative(repositoryRoot, path)} must identify ${skill.name} with schema version 1`)
    }
  }
}

if (!skills.length) fail("No skills found")
console.log(`Validated ${skills.length} self-contained skill${skills.length === 1 ? "" : "s"}: ${[...names].join(", ")}`)
