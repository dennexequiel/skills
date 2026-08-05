import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const skill = await readFile(resolve(root, "skills/prep-that-doc/SKILL.md"), "utf8")
const elements = await readFile(resolve(root, "skills/prep-that-doc/references/elements.md"), "utf8")
const tells = await readFile(resolve(root, "skills/prep-that-doc/references/tells.md"), "utf8")
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

describe("Prep That Doc portable contract", () => {
  test("advertises its verbs to clients that support argument hints", () => {
    expect(skill).toContain('argument-hint: "[review|fix|roast] <path>"')
  })

  test("computes the score from confirmed findings and refuses to make it a target", () => {
    expect(skill).toContain("points  = 5 x HIGH + 2 x MED + 1 x LOW")
    expect(skill).toContain("**Score confirmed findings only.**")
    expect(skill).toContain("**Below 300 words, report points and no density.**")
    expect(skill).toContain("**Never optimize the score.**")
  })

  test("keeps roast a reporting mode with the standards intact", () => {
    expect(skill).toContain("It roasts the document, never the person who wrote it")
    expect(skill).toContain("It never invents a finding to have more to say")
    expect(skill).toContain("Asked to **roast**, report everything and still change nothing.")
  })

  test("states both sides of its scope boundary", () => {
    expect(skill).toContain("- **IS:**")
    expect(skill).toContain("- **IS NOT:**")
  })

  test("keeps structural judgment ahead of style cleanup", () => {
    expect(skill).toContain("decide what the content actually is, then give it that form")
    expect(skill).toContain("Structure first, because structure changes delete style problems for free")
    expect(skill).toContain("A one-column table is a list wearing a costume.")
    expect(elements).toContain("at least two columns carrying distinct information")
  })

  test("classifies every finding before editing", () => {
    for (const label of ["confirmed", "intentional", "protected", "false-positive", "needs-author"]) {
      expect(skill).toContain(`\`${label}\``)
    }
    expect(skill).toContain("never gets an invented fix")
  })

  test("protects facts and author authority", () => {
    expect(skill).toContain("Never change a fact, number, URL, command, path, or citation target")
    expect(skill).toContain("Asked to **review**, report findings and propose fixes. Do not rewrite the file.")
  })

  test("applies stricter rules to documents with operational consequence", () => {
    expect(skill).toContain("### Risk-Bearing Documents")
    expect(skill).toContain("**Qualified language is data, not hedging.**")
    expect(skill).toContain("**Never reorder steps.**")
    expect(skill).toContain("**Structural change is proposed, never applied**")
    expect(tells).toContain("**Exempt in risk-bearing documents.**")
  })

  test("refuses a restructure that cannot carry every claim", () => {
    expect(skill).toContain("### Restructuring Is Lossless")
    expect(skill).toContain("Every fact, condition, exception, and qualifier lands somewhere in the replacement, or the restructure is rejected")
    expect(skill).toContain("When a restructure cannot carry everything, say so and leave the original")
  })

  test("bounds the rewrite loop and refuses a zero-count victory", () => {
    expect(skill).toContain("capped at four passes")
    expect(skill).toContain("Overcorrection is its own failure")
    expect(skill).toContain("A lower count does not prove the document got better")
  })
})

describe("Prep That Doc detector", () => {
  test("reports planted tells and stays silent on clean markdown", async () => {
    const directory = await mkdtemp(join(tmpdir(), "prep-that-doc-scan-"))
    try {
      const noisy = resolve(directory, "noisy.md")
      await writeFile(noisy, [
        "# Sample",
        "",
        "It is not just a tool, but a crucial shift in the landscape.",
        "Previously the parser read the body.",
        "",
        "#### Skipped heading",
        "",
        "```",
        "no language",
        "```",
        "",
      ].join("\n"), "utf8")

      const clean = resolve(directory, "clean.md")
      await writeFile(clean, "# Sample\n\nThe parser reads tokens from headers.\n", "utf8")

      const run = async (path: string) => {
        const child = Bun.spawn(["bun", "skills/prep-that-doc/scripts/scan.ts", path], {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
        })
        const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
        return { exitCode, stdout }
      }

      const noisyResult = await run(noisy)
      expect(noisyResult.exitCode).toBe(0)
      for (const rule of ["tell-notxbuty", "tell-significance", "tell-history", "heading-skip", "fence-nolang"]) {
        expect(noisyResult.stdout).toContain(rule)
      }

      expect(noisyResult.stdout).toContain("Provisional score:")
      expect(noisyResult.stdout).toContain("Density withheld below 300 words")

      const cleanResult = await run(clean)
      expect(cleanResult.stdout).toContain("0 candidates")

      const long = resolve(directory, "long.md")
      await writeFile(long, `# Long\n\n${"The parser reads tokens from headers. ".repeat(60)}\n\nIt is not just a tool, but a crucial shift.\n`, "utf8")
      const longResult = await run(long)
      expect(longResult.stdout).toMatch(/points per 1000 words, band (clean|light|rough|heavy|severe)/)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  test("documents every rule it detects", () => {
    for (const rule of ["tell-notxbuty", "tell-significance", "tell-history", "tell-emdash", "tell-curly"]) {
      expect(tells).toContain(`\`${rule}\``)
    }
    for (const rule of ["heading-skip", "element-table"]) {
      expect(elements).toContain(`\`${rule}\``)
    }
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
      expect.objectContaining({ name: "prep-that-doc", status: "experimental", areas: ["documentation", "writing"] }),
    )
    expect(compatibility).toContain("| [Prep That Doc](../skills/prep-that-doc/) | Claude Code | Yes | Not yet | No |")
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
