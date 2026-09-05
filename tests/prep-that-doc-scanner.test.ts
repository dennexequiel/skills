import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { scanDocument } from "../skills/prep-that-doc/scripts/engine.ts"
import { DEFAULT_CONFIG } from "../skills/prep-that-doc/scripts/policy.ts"
import { RULES } from "../skills/prep-that-doc/scripts/registry.ts"
import { parseMarkdownRegions } from "../skills/prep-that-doc/scripts/regions.ts"
import type { ResolvedProfile } from "../skills/prep-that-doc/scripts/types.ts"

const root = resolve(import.meta.dir, "..")

function rules(source: string, profile: ResolvedProfile = "generic"): string[] {
  return scanDocument({ file: "sample.md", absoluteFile: resolve(root, "sample.md"), source, profile, config: DEFAULT_CONFIG }).findings.map((finding) => finding.rule)
}

const POSITIVE: Record<string, { source: string; profile?: ResolvedProfile }> = {
  "fence-nolang": { source: "# Sample\n\n```\ntext\n```\n" },
  "frontmatter-unclosed": { source: "---\ntitle: sample\n" },
  "fence-unclosed": { source: "# Sample\n\n```text\ntext\n" },
  "heading-skip": { source: "# Sample\n\n### Skipped\n" },
  "heading-one": { source: "# One\n\n# Two\n" },
  "table-underfit": { source: "# T\n\n| One |\n| --- |\n| a |\n" },
  "link-dead": { source: "# Links\n\n[missing](no-such-file.md)\n" },
  "section-missing": { source: "# Change\n", profile: "pr" },
  "tell-notxbuty": { source: "# Sample\n\nIt is not just a tool, but a service.\n" },
  "tell-significance": { source: "# Sample\n\nThis is a crucial change.\n" },
  "tell-vague-number": { source: "# Sample\n\nRestart quickly.\n" },
  "tell-weasel": { source: "# Sample\n\nStudies show the change works.\n" },
  "tell-history": { source: "# Sample\n\nPreviously the service read headers.\n" },
  "tell-hedge": { source: "# Sample\n\nIt is arguably ready.\n" },
  "tell-filler": { source: "# Sample\n\nIn order to continue, run the command.\n" },
  "tell-emdash": { source: "# Sample\n\nOne — two — three.\n" },
  "tell-conclusion": { source: "# Sample\n\nUltimately the service starts.\n" },
  "tell-signpost": { source: "# Sample\n\nIn this section, the service starts.\n" },
  "tell-curly": { source: "# Sample\n\nIt’s ready.\n" },
  "link-here": { source: "# Sample\n\n[here](https://example.test)\n" },
}

describe("Prep That Doc scanner registry", () => {
  test("gives every retained rule a semantic positive and clean negative", () => {
    const clean = "# Sample\n\nThe service reads tokens from headers.\n"
    for (const rule of RULES) {
      const fixture = POSITIVE[rule.id]
      if (!fixture) throw new Error(`Missing positive fixture for ${rule.id}`)
      expect(rules(fixture.source, fixture.profile)).toContain(rule.id)
      const negative = rule.id === "section-missing" ? "## Summary\n\nThe parser reads headers.\n\n## Validation\n\nTests pass.\n" : clean
      expect(rules(negative, fixture.profile)).not.toContain(rule.id)
    }
  })

  test("masks source syntax while retaining structural table dimensions", () => {
    const source = [
      "# Sample",
      "",
      "```sh",
      "critical --version",
      "```",
      "",
      "`essential` <!-- robust -->",
      "> crucial quoted source",
      "",
      "| A | B |",
      "| --- | --- |",
      "| `critical | value` | escaped\\|pipe |",
      "",
      "[reference]: missing.md",
    ].join("\n")
    const found = rules(source)
    expect(found).not.toContain("tell-significance")
    expect(found).not.toContain("link-dead")
    expect(parseMarkdownRegions(source).tables).toHaveLength(1)
  })

  test("profiles and configuration change actual policy", () => {
    expect(rules("## Summary\n", "pr")).not.toContain("heading-skip")
    expect(rules("# Changes\n\nPreviously the parser read tokens.\n", "changelog")).not.toContain("tell-history")
    expect(rules("# Migration\n\nIt is arguably safe.\n", "generic")).not.toContain("tell-hedge")
    const accepted = scanDocument({
      file: "wcag.md",
      source: "# WCAG\n\nWCAG Essential requirement.\n",
      profile: "generic",
      config: { ...DEFAULT_CONFIG, acceptedTerminology: ["WCAG Essential"] },
    })
    expect(accepted.findings.map((finding) => finding.rule)).not.toContain("tell-significance")
  })

  test("uses a stable fingerprint after an unrelated blank line", () => {
    const first = scanDocument({ file: "doc.md", source: "# Sample\n\nRestart quickly.\n", profile: "generic", config: DEFAULT_CONFIG })
    const second = scanDocument({ file: "doc.md", source: "# Sample\n\n\nRestart quickly.\n", profile: "generic", config: DEFAULT_CONFIG })
    expect(first.findings.find((finding) => finding.rule === "tell-vague-number")?.fingerprint)
      .toBe(second.findings.find((finding) => finding.rule === "tell-vague-number")?.fingerprint)
  })

  test("keeps local link resolution relative to its document", async () => {
    const directory = await mkdtemp(join(tmpdir(), "prepdoc-scanner-"))
    const document = join(directory, "doc.md")
    await writeFile(join(directory, "present.md"), "# Present\n", "utf8")
    const found = scanDocument({
      file: "doc.md",
      absoluteFile: document,
      source: "# Links\n\n[ok](present.md) [missing](absent%20plan.md?raw=1#title)\n",
      profile: "generic",
      config: DEFAULT_CONFIG,
    })
    expect(found.findings.filter((finding) => finding.rule === "link-dead")).toHaveLength(1)
    await rm(directory, { recursive: true, force: true })
  })
})


describe("Prep That Doc protected content and context", () => {
  test.each([
    "---\ntitle: critical\n---\n# Guide\n",
    "# Guide\n\n```sh\ncrucial --essential\n```\n",
    "# Guide\n\n~~~text\n```\ncrucial\n~~~\n",
    "# Guide\n\n``A crucial\ninline example``\n",
    "# Guide\n\n<!-- crucial\ncritical -->\n",
    "# Guide\n\n> crucial quote\ncritical continuation\n\nNormal prose.\n",
    "# Guide\n\nThe source says \"This is essential.\"\n",
    "# Guide\n\n    critical command output\n",
    "# Guide\n\n$ command --critical\n",
    "# Guide\n\nRun ./critical.sh or inspect essential.json.\n",
    "# Guide\n\nSee https://critical.example/essential and version 1.2.3.\n",
    "# Guide\n\n![critical example](https://example.test/essential.png)\n",
    "# Guide\n\nA | B\n--- | ---\ncritical | essential\n",
  ])("keeps protected example %s out of prose findings", (literal) => {
    const source = literal.replace(/\\"/g, '"')
    expect(rules(source)).not.toContain("tell-significance")
  })

  test("preserves prose beside comments and code", () => {
    const source = "# Guide\n\n`critical` is essential. <!-- pivotal --> This is crucial.\n"
    const findings = scanDocument({ file: "guide.md", source, profile: "generic", config: DEFAULT_CONFIG }).findings
    const significance = findings.filter((finding) => finding.rule === "tell-significance")
    expect(significance.map((finding) => finding.evidence)).toEqual(["essential", "crucial"])
    expect(significance[0]?.location).toEqual({ line: 3, column: 15 })
  })

  test("literal comment markers in code do not hide later prose", () => {
    expect(rules("# Guide\n\nThe marker is `<!--`.\n\nThis is crucial.\n")).toContain("tell-significance")
    expect(rules("# Guide\n\n```text\n<!--\n```\n\nThis is crucial.\n")).toContain("tell-significance")
  })

  test("headings inside a multiline code span do not alter hierarchy", () => {
    const source = "# Guide\n\n``example\n#### critical\nend``\n\n## Usage\n"
    expect(rules(source)).not.toContain("heading-skip")
    expect(parseMarkdownRegions(source).headings.map((heading) => heading.title)).toEqual(["Guide", "Usage"])
  })

  test("PR H2 is valid but an orphan H4 still requires review", () => {
    expect(rules("## Summary\n", "pr")).not.toContain("heading-skip")
    expect(rules("#### Summary\n", "pr")).toContain("heading-skip")
  })

  test("Setext titles participate in the heading hierarchy", () => {
    expect(rules("Guide\n=====\n\n## Usage\n")).not.toContain("heading-skip")
    expect(rules("Guide\n=====\n\n#### Usage\n")).toContain("heading-skip")
  })

  test("GFM tables support terminal dividers, escaped pipes and inline code pipes", () => {
    expect(rules("# Guide\n\n| Name | Value |\n| --- | --- |")).toContain("table-underfit")
    const source = "# Guide\n\nName | Value\n--- | ---\n``a | `b` `` | escaped\\|pipe\n"
    expect(parseMarkdownRegions(source).tables).toMatchObject([{ columns: 2, rows: 1 }])
    expect(rules(source)).not.toContain("table-underfit")
  })

  test("accepted phrases do not exempt unrelated words on the same line", () => {
    const findings = scanDocument({ file: "guide.md", profile: "generic", config: { ...DEFAULT_CONFIG, acceptedTerminology: ["Robust Mode"] }, source: "# Guide\n\nWCAG Essential and Robust Mode are critical.\n" }).findings
    expect(findings.filter((finding) => finding.rule === "tell-significance").map((finding) => finding.evidence)).toEqual(["critical"])
  })

  test("accepted terminology applies to every prose detector", () => {
    const findings = scanDocument({ file: "guide.md", profile: "generic", config: { ...DEFAULT_CONFIG, acceptedTerminology: ["In Order To"] }, source: "# Guide\n\nThe product In Order To reads headers.\n" }).findings
    expect(findings.map((finding) => finding.rule)).not.toContain("tell-filler")
  })

  test("protected sections exclude only their own subtree from candidates and density", () => {
    const source = "# Guide\n\n## Quoted Rules\n\ncritical — essential — vital\n\n### Example\n\nRestart quickly.\n\n## Usage\n\nRestart slowly.\n"
    const findings = scanDocument({ file: "guide.md", source, profile: "generic", config: { ...DEFAULT_CONFIG, protectedSections: ["quoted rules"] } }).findings
    expect(findings.map((finding) => finding.rule)).toEqual(["tell-vague-number"])
    expect(findings[0]?.evidence).toBe("slowly")
  })

  test("dense em dashes are contextual while sparse dashes and ranges are quiet", () => {
    expect(rules("# Guide\n\nOne — two — three.\n")).toContain("tell-emdash")
    expect(rules("# Guide\n\nOne — two.\n")).not.toContain("tell-emdash")
    expect(rules(`# Guide\n\n${"Useful prose carries a concrete fact. ".repeat(70)} One — two — three.\n`)).not.toContain("tell-emdash")
    expect(rules("# Guide\n\nVersions 1–3 use values 10–20.\n")).not.toContain("tell-emdash")
  })

  test("a generated marker is metadata only outside protected examples", () => {
    expect(scanDocument({ file: "guide.md", source: "<!-- @generated -->\n# Guide\n\ncritical\n", profile: "generic", config: DEFAULT_CONFIG }).skipped).toBeDefined()
    expect(scanDocument({ file: "guide.md", source: "# Guide\n\n```md\n<!-- @generated -->\n```\n", profile: "generic", config: DEFAULT_CONFIG }).skipped).toBeUndefined()
  })

  test("link detection masks inline code while retaining actual table links", async () => {
    const directory = await mkdtemp(join(tmpdir(), "prepdoc-links-"))
    try {
      await writeFile(join(directory, "plan(ready).md"), "# Plan\n")
      await writeFile(join(directory, "ready plan.md"), "# Plan\n")
      const source = '# Links\n\n`[example](absent.md)`\n\n| A | B |\n| --- | --- |\n| [missing](absent.md) | critical |\n\n[plan](plan(ready).md) [space](<ready plan.md> "a title")\n\n[reference][ready]\n\n[ready]: ready%20plan.md#title\n'
      const result = scanDocument({ file: "doc.md", absoluteFile: join(directory, "doc.md"), source, profile: "generic", config: DEFAULT_CONFIG })
      expect(result.findings.filter((finding) => finding.rule === "link-dead")).toHaveLength(1)
      expect(result.findings.find((finding) => finding.rule === "link-dead")?.location.line).toBe(7)
      expect(result.findings.map((finding) => finding.rule)).not.toContain("tell-significance")
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})

describe("Prep That Doc review regressions", () => {
  test("a leading thematic break does not hide Markdown", () => {
    const source = "---\n# Guide\n\nRestart quickly.\n"
    expect(rules(source)).not.toContain("frontmatter-unclosed")
    expect(rules(source)).toContain("tell-vague-number")
    expect(parseMarkdownRegions(source).headings).toHaveLength(1)
    expect(rules("---\ntitle: Guide\n")).toContain("frontmatter-unclosed")
  })

  test("balanced labels and parenthesized link titles retain target checks", () => {
    expect(rules('[outer [inner]](no-such-file.md)')).toContain("link-dead")
    expect(rules('[target](no-such-file.md (title))')).toContain("link-dead")
  })

  test("formatting inside a heading does not create missing sections", () => {
    for (const summary of ["**Summary**", "_Summary_", "`Summary`", "[Summary](#summary)"]) {
      expect(rules(`## ${summary}\n\n## Testing\n`, "pr")).not.toContain("section-missing")
    }
  })

  test("reference links are counted once and footnotes are not filesystem paths", () => {
    const source = "# Guide\n\n[details][plan] and a note[^1].\n\n[plan]: no-such-file.md\n[^1]: Critical refers to the incident severity.\n"
    const findings = scanDocument({ file: "guide.md", source, profile: "generic", config: DEFAULT_CONFIG }).findings
    expect(findings.filter((finding) => finding.rule === "link-dead")).toHaveLength(1)
  })

  test("quoted link examples and separate-paragraph backticks stay scoped", () => {
    expect(rules('The source says "[example](no-such-file.md)".')).not.toContain("link-dead")
    expect(rules("# Guide\n\nA literal ` marker.\n\n### Missing parent\n\nAnother literal ` marker.\n")).toContain("heading-skip")
  })
})
