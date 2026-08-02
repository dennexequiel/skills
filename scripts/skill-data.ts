import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

export type SkillStatus = "experimental" | "stable" | "deprecated"

export type SkillData = {
  name: string
  description: string
  license: string | undefined
  compatibility: string | undefined
  displayName: string
  summary: string
  status: SkillStatus
  areas: string[]
  directory: string
  skillPath: string
  content: string
}

export const repositoryRoot = resolve(import.meta.dir, "..")
export const skillsDirectory = join(repositoryRoot, "skills")

function requiredString(record: Record<string, unknown>, key: string, source: string): string {
  const value = record[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${source} needs a non-empty ${key}`)
  }
  return value.trim()
}

function requiredSingleLine(record: Record<string, unknown>, key: string, source: string): string {
  const value = requiredString(record, key, source)
  if (/[\r\n|]/.test(value)) {
    throw new Error(`${source} ${key} must be one line and cannot contain a table separator`)
  }
  return value
}

function optionalString(record: Record<string, unknown>, key: string, source: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${source} ${key} must be a non-empty string`)
  }
  return value.trim()
}

export function parseSkill(content: string, directory: string, skillPath: string): SkillData {
  const source = relative(repositoryRoot, skillPath)
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) throw new Error(`${source} has no YAML frontmatter`)
  const yaml = frontmatter[1]
  if (yaml === undefined) throw new Error(`${source} has empty YAML frontmatter`)

  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(yaml)
  } catch (error) {
    throw new Error(`${source} has invalid YAML: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} frontmatter must be a mapping`)
  }

  const metadata = (parsed as Record<string, unknown>).metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${source} needs metadata for catalog generation`)
  }

  const fields = parsed as Record<string, unknown>
  const catalog = metadata as Record<string, unknown>
  const name = requiredSingleLine(fields, "name", source)
  const description = requiredSingleLine(fields, "description", source)
  const status = requiredSingleLine(catalog, "status", source)
  if (!["experimental", "stable", "deprecated"].includes(status)) {
    throw new Error(`${source} metadata.status must be experimental, stable, or deprecated`)
  }

  const areas = requiredSingleLine(catalog, "areas", source).split(",").map((area) => area.trim()).filter(Boolean)
  if (!areas.length || new Set(areas).size !== areas.length || areas.some((area) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(area))) {
    throw new Error(`${source} metadata.areas must contain unique comma-separated areas`)
  }

  return {
    name,
    description,
    license: optionalString(fields, "license", source),
    compatibility: optionalString(fields, "compatibility", source),
    displayName: requiredSingleLine(catalog, "display-name", source),
    summary: requiredSingleLine(catalog, "summary", source),
    status: status as SkillStatus,
    areas,
    directory,
    skillPath,
    content,
  }
}

export async function loadSkills(): Promise<SkillData[]> {
  const skills: SkillData[] = []
  for (const entry of await readdir(skillsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = join(skillsDirectory, entry.name)
    const skillPath = join(directory, "SKILL.md")
    const content = await readFile(skillPath, "utf8")
    skills.push(parseSkill(content, directory, skillPath))
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name))
}
