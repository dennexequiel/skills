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

const TYPESCRIPT_NODE = [[22, 18], [23, 6]] as const

async function nodeVersion(): Promise<[number, number] | undefined> {
  let exitCode: number
  let stdout: string
  try {
    const child = Bun.spawn(["node", "--version"], { stdout: "pipe", stderr: "pipe" })
    ;[exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
  } catch {
    return undefined
  }
  if (exitCode !== 0) return undefined
  const parts = stdout.trim().replace(/^v/, "").split(".").map(Number)
  const [major, minor] = parts
  return major === undefined || minor === undefined || Number.isNaN(major) || Number.isNaN(minor)
    ? undefined
    : [major, minor]
}

function runsTypeScript([major, minor]: [number, number]): boolean {
  const floor = TYPESCRIPT_NODE.find(([line]) => line === major)
  return floor ? minor >= floor[1] : major > 23
}

async function withTempDir<T>(prefix: string, use: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), `prep-that-doc-${prefix}-`))
  try {
    return await use(directory)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

async function scanOutput(path: string): Promise<string> {
  const child = Bun.spawn(["bun", "skills/prep-that-doc/scripts/scan.ts", path], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
  expect(exitCode).toBe(0)
  return stdout
}

describe("Prep That Doc portable contract", () => {
  test("advertises its verbs to clients that support argument hints", () => {
    expect(skill).toContain('argument-hint: "[review|fix|roast] <path>"')
  })

  test("derives the verdict from classified findings and refuses to make it a target", () => {
    for (const verdict of ["clean", "minor", "blocked", "rework"]) {
      expect(skill).toContain(`| \`${verdict}\` |`)
    }
    expect(skill).toContain("**Classify before deciding the verdict.**")
    expect(skill).toContain("**`needs-author` is never `clean`.**")
    expect(skill).toContain("**Never optimize the verdict.**")
  })

  test("asks about blocking gaps and keeps deferral free", () => {
    expect(skill).toContain("### 4. Ask")
    expect(skill).toContain("**Answering later is a real answer.**")
    expect(skill).toContain("`review` and `roast` never ask")
    expect(skill).toContain("Record answers as given")
  })

  test("leaves a document alone once classification clears it", () => {
    expect(skill).toContain("**A document that is already good gets left alone.**")
    expect(skill).toContain("Detector output is not a work order")
  })

  test("gives every verb its own report heading", () => {
    for (const verb of ["review", "fix", "roast"]) {
      expect(skill).toContain(`\`## Prep That Doc ${verb}\``)
    }
    expect(skill).toContain("`fix` reports a record of edits rather than a list of findings")
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
    await withTempDir("scan", async (directory) => {
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

      const noisyOutput = await scanOutput(noisy)
      for (const rule of ["tell-notxbuty", "tell-significance", "tell-history", "heading-skip", "fence-nolang"]) {
        expect(noisyOutput).toContain(rule)
      }

      expect(noisyOutput).toContain("Provisional verdict: rework")

      const cleanOutput = await scanOutput(clean)
      expect(cleanOutput).toContain("0 candidates")
      expect(cleanOutput).toContain("Provisional verdict: clean")

      const styleOnly = resolve(directory, "style-only.md")
      await writeFile(styleOnly, "# Sample\n\nUltimately the parser reads tokens.\n", "utf8")
      expect(await scanOutput(styleOnly)).toContain("Provisional verdict: minor")
    })
  })

  test("reads key as a noun rather than a claim of importance", async () => {
    await withTempDir("key", async (directory) => {
      const literal = resolve(directory, "literal.md")
      await writeFile(literal, "# Keys\n\nThe SSH key signs commits. Press the prefix key, then a key from the map.\n", "utf8")
      expect(await scanOutput(literal)).not.toContain("tell-significance")

      const inflated = resolve(directory, "inflated.md")
      await writeFile(inflated, "# Keys\n\nThat is the key takeaway, and the key benefit of the rewrite.\n", "utf8")
      expect(await scanOutput(inflated)).toContain("tell-significance")
    })
  })

  test("keeps a protected region open only until its own closing marker", async () => {
    await withTempDir("fence", async (directory) => {
      const nested = resolve(directory, "nested.md")
      await writeFile(nested, [
        "# Sample",
        "",
        "````text",
        "~~~",
        "It is not just prose, but a crucial shift in the landscape.",
        "~~~",
        "````",
        "",
        "```sh",
        "$ echo hi",
        "```",
        "",
        "```console",
        "$ echo ok",
        "```",
        "",
      ].join("\n"), "utf8")

      const nestedOutput = await scanOutput(nested)
      expect(nestedOutput).toContain("0 HIGH")
      expect(nestedOutput).not.toContain("tell-significance")
      expect(nestedOutput).toContain("fence-prompt")
      expect(nestedOutput.match(/fence-prompt/g)).toHaveLength(1)

      const unclosed = resolve(directory, "unclosed.md")
      await writeFile(unclosed, "# Sample\n\n```text\nswallows the rest\n", "utf8")
      expect(await scanOutput(unclosed)).toContain("fence-unclosed")

      const frontmatter = resolve(directory, "frontmatter.md")
      await writeFile(frontmatter, "---\nname: sample\n\nswallowed\n", "utf8")
      expect(await scanOutput(frontmatter)).toContain("frontmatter-unclosed")
    })
  })

  test("catches a hierarchy that starts below the root and a second root", async () => {
    await withTempDir("heading", async (directory) => {
      const orphan = resolve(directory, "orphan.md")
      await writeFile(orphan, "#### Orphan\n\nText.\n", "utf8")
      expect(await scanOutput(orphan)).toContain("heading-skip")

      const twoRoots = resolve(directory, "two-roots.md")
      await writeFile(twoRoots, "# First\n\nText.\n\n# Second\n\nText.\n", "utf8")
      expect(await scanOutput(twoRoots)).toContain("heading-one")
    })
  })

  test("runs under Node so the published compatibility claim holds", async () => {
    const node = await nodeVersion()
    if (!node) {
      console.log("Skipping the Node claim: node is not on PATH. Bun alone runs the rest of the suite.")
      return
    }
    if (!runsTypeScript(node)) {
      console.log(`Skipping the Node claim: node ${node.join(".")} predates direct TypeScript execution, which the README already excludes.`)
      return
    }

    const child = Bun.spawn(["node", "skills/prep-that-doc/scripts/scan.ts", "README.md"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("candidates")
  })

  test("names the file it could not read instead of throwing a stack trace", async () => {
    const child = Bun.spawn(["bun", "skills/prep-that-doc/scripts/scan.ts", "does-not-exist.md"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    expect(exitCode).toBe(2)
    expect(stderr).toContain("Cannot read does-not-exist.md")
  })

  test("resolves relative links against the file that contains them", async () => {
    await withTempDir("links", async (directory) => {
      const doc = resolve(directory, "doc.md")
      await writeFile(resolve(directory, "plan.md"), "# Plan\n", "utf8")
      await writeFile(doc, [
        "# Links",
        "",
        "Reaches [the plan](./plan.md) and misses [the rollback](rollback.md).",
        "",
        "Leaves [a site](https://example.com), [an anchor](#top), and [mail](mailto:a@b.c) alone.",
        "",
        "![missing](img/none.png)",
        "",
      ].join("\n"), "utf8")

      const output = await scanOutput(doc)
      expect(output).toContain("rollback.md")
      expect(output).toContain("img/none.png")
      expect(output).not.toContain("plan.md")
      expect(output).not.toContain("example.com")
      expect(output.match(/link-dead/g)).toHaveLength(2)
    })
  })

  test("judges a table as a block instead of scoring every row", async () => {
    await withTempDir("table", async (directory) => {
      const oneColumn = resolve(directory, "one-column.md")
      await writeFile(oneColumn, "# T\n\n| One |\n| --- |\n| a |\n| b |\n| c |\n", "utf8")
      const oneColumnOutput = await scanOutput(oneColumn)
      expect(oneColumnOutput.match(/element-table/g)).toHaveLength(1)

      const tooFewRows = resolve(directory, "too-few-rows.md")
      await writeFile(tooFewRows, "# T\n\n| A | B |\n| --- | --- |\n", "utf8")
      expect(await scanOutput(tooFewRows)).toContain("element-table")

      const valid = resolve(directory, "valid.md")
      await writeFile(valid, "# T\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n", "utf8")
      expect(await scanOutput(valid)).not.toContain("element-table")
    })
  })

  test("detects every alternative its reference publishes", async () => {
    await withTempDir("terms", async (directory) => {
      const terms: Array<[string, string]> = [
        ["key insight", "tell-significance"],
        ["critical", "tell-significance"],
        ["it is widely understood", "tell-weasel"],
        ["some argue", "tell-weasel"],
        ["fairly", "tell-hedge"],
        ["ultimately", "tell-conclusion"],
        ["Overall, ", "tell-conclusion"],
      ]
      for (const [term, rule] of terms) {
        const path = resolve(directory, `${rule}-${term.replace(/\W+/g, "-")}.md`)
        await writeFile(path, `# Sample\n\nThe parser ${term} reads tokens.\n`, "utf8")
        expect(await scanOutput(path)).toContain(rule)
      }
    })
  })

  test("documents every rule it detects", async () => {
    const source = await readFile(resolve(root, "skills/prep-that-doc/scripts/scan.ts"), "utf8")
    const documented = `${elements}\n${tells}`
    const detected = [...source.matchAll(/"((?:tell|heading|fence|element|link|frontmatter)(?:-[a-z]+)+)"/g)].map(([, id]) => id)
    expect(detected.length).toBeGreaterThanOrEqual(15)
    for (const rule of new Set(detected)) {
      expect(documented).toContain(`\`${rule}\``)
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
