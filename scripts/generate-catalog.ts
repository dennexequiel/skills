import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { loadSkills, repositoryRoot } from "./skill-data"

const startMarker = "<!-- catalog:start -->"
const endMarker = "<!-- catalog:end -->"
const write = process.argv.includes("--write")
const skills = await loadSkills()

const catalog = {
  schemaVersion: 1,
  skills: skills.map((skill) => ({
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    summary: skill.summary,
    status: skill.status,
    areas: skill.areas,
    path: `skills/${skill.name}`,
  })),
}

const catalogContent = `${JSON.stringify(catalog, null, 2)}\n`
const table = [
  startMarker,
  "| Skill | Status | Areas | Purpose |",
  "| --- | --- | --- | --- |",
  ...catalog.skills.map((skill) => `| [${skill.displayName}](${skill.path}/) | ${skill.status} | ${skill.areas.join(", ")} | ${skill.summary} |`),
  endMarker,
].join("\n")

const catalogPath = resolve(repositoryRoot, "catalog.json")
const readmePath = resolve(repositoryRoot, "README.md")
const readme = await readFile(readmePath, "utf8")
const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`)
if (!markerPattern.test(readme)) throw new Error("README.md has no generated catalog markers")
const nextReadme = readme.replace(markerPattern, table)

if (write) {
  await writeFile(catalogPath, catalogContent, "utf8")
  await writeFile(readmePath, nextReadme, "utf8")
  console.log(`Generated catalog for ${skills.length} skill${skills.length === 1 ? "" : "s"}`)
} else {
  const existingCatalog = await readFile(catalogPath, "utf8").catch(() => "")
  if (existingCatalog !== catalogContent || readme !== nextReadme) {
    throw new Error("Generated catalog is stale. Run bun run generate:catalog.")
  }
  console.log(`Verified generated catalog for ${skills.length} skill${skills.length === 1 ? "" : "s"}`)
}
