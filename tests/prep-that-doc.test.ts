import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const skill = await readFile(resolve(root, "skills/prep-that-doc/SKILL.md"), "utf8")
const skillReadme = await readFile(resolve(root, "skills/prep-that-doc/README.md"), "utf8")
const triggers = JSON.parse(await readFile(resolve(root, "evals/prep-that-doc/triggers.json"), "utf8")) as {
  positive: string[]
  negative: string[]
  ambiguous: Array<{ prompt: string; expected: string }>
}
const catalog = JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8")) as {
  skills: Array<{ name: string; status: string; areas: string[] }>
}
const skillCatalogEntry = catalog.skills.find(({ name }) => name === "prep-that-doc")
const compatibility = await readFile(resolve(root, "docs/compatibility.md"), "utf8")
const plugin = JSON.parse(await readFile(resolve(root, ".claude-plugin/plugin.json"), "utf8")) as {
  skills: string[]
}

const MAXIMUM_CORE_LINES = 140
const MAXIMUM_CORE_BYTES = 10_000

describe("Prep That Doc instruction budget", () => {
  test("keeps optional workflows out of the default context", () => {
    expect(skill.trimEnd().split("\n").length).toBeLessThanOrEqual(MAXIMUM_CORE_LINES)
    expect(Buffer.byteLength(skill)).toBeLessThanOrEqual(MAXIMUM_CORE_BYTES)
  })
})

describe("Prep That Doc distribution", () => {
  test("has routing coverage on both sides of its activation boundary", () => {
    expect(triggers.positive.length).toBeGreaterThanOrEqual(5)
    expect(triggers.negative.length).toBeGreaterThanOrEqual(5)
    expect(triggers.ambiguous.length).toBeGreaterThanOrEqual(2)
  })

  test("publishes honest maturity and per-skill compatibility metadata", () => {
    expect(skillCatalogEntry).toEqual(
      expect.objectContaining({ name: "prep-that-doc", status: "stable", areas: ["documentation", "writing"] }),
    )
    expect(compatibility).toContain("| [Prep That Doc](../skills/prep-that-doc/) | Claude Code | Yes | Yes (`bun run smoke:claude-code`) | No |")
    expect(compatibility).toContain("| [Prep That Doc](../skills/prep-that-doc/) | OpenCode | Yes | Not yet | No |")
  })

  test("keeps skill installation guidance at the right scope", () => {
    expect(skillReadme).toContain("--skill prep-that-doc")
    expect(skillReadme).toContain("--agent claude-code --global --yes")
  })

  test("declares every catalog skill in the Claude Code plugin manifest", () => {
    expect(plugin.skills.toSorted()).toEqual(catalog.skills.map(({ name }) => `./skills/${name}`).toSorted())
  })
})
