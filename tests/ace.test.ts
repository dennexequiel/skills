import { describe, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { requireReleaseVersion } from "../scripts/release-version"

const root = resolve(import.meta.dir, "..")
const skill = await readFile(resolve(root, "skills/ace/SKILL.md"), "utf8")
const partnership = await readFile(resolve(root, "skills/ace/references/partnership.md"), "utf8")
const command = await readFile(resolve(root, "adapters/opencode/command/ace.md"), "utf8")
const plugin = await readFile(resolve(root, "adapters/opencode/plugin/ace.ts"), "utf8")
const evaluations = JSON.parse(await readFile(resolve(root, "evals/ace/evals.json"), "utf8")) as {
  cases: Array<{ name: string; expected: string[]; antiPatterns: string[] }>
}
const triggers = JSON.parse(await readFile(resolve(root, "evals/ace/triggers.json"), "utf8")) as {
  positive: string[]
  negative: string[]
  ambiguous: Array<{ prompt: string; expected: string }>
}
const catalog = JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8")) as {
  skills: Array<{ name: string; status: string; areas: string[] }>
}
const compatibility = await readFile(resolve(root, "docs/compatibility.md"), "utf8")

describe("Ace portable contract", () => {
  test("keeps consequential questions and reversible defaults together", () => {
    expect(skill).toContain("Ask a question only when")
    expect(skill).toContain("choose the safest reversible default")
    expect(partnership).toContain("Do not front-load hypothetical edge cases")
  })

  test("preserves distinct delivery and learning responsibilities", () => {
    expect(skill).toContain("In `deliver` mode")
    expect(skill).toContain("In `learn` mode")
    expect(skill).toContain("let the user make the requested architecture or reasoning decisions")
    expect(skill).toContain("one lightweight observable demonstration")
  })

  test("bounds initially open-ended missions with finite defaults", () => {
    expect(skill).toContain("Ace may first bound an open-ended request")
    expect(skill).toContain("20 continuation cycles, 60 minutes, and 3 consecutive stalled iterations")
  })

  test("requires evidence and finite terminal states", () => {
    for (const status of ["completed", "paused", "blocked", "limit-reached", "cancelled"]) {
      expect(skill).toContain(`\`${status}\``)
    }
    expect(skill).toContain("fresh evidence proves every agreed criterion")
  })
})

describe("Ace distribution", () => {
  test("has behavior cases with positive and negative assertions", () => {
    expect(evaluations.cases.length).toBeGreaterThanOrEqual(5)
    for (const evaluation of evaluations.cases) {
      expect(evaluation.expected.length).toBeGreaterThan(0)
      expect(evaluation.antiPatterns.length).toBeGreaterThan(0)
    }
  })

  test("has routing coverage on both sides of its activation boundary", () => {
    expect(triggers.positive.length).toBeGreaterThanOrEqual(5)
    expect(triggers.negative.length).toBeGreaterThanOrEqual(5)
    expect(triggers.ambiguous.length).toBeGreaterThanOrEqual(2)
  })

  test("publishes honest maturity and compatibility metadata", () => {
    expect(catalog.skills).toEqual([
      expect.objectContaining({ name: "ace", status: "experimental", areas: ["workflow", "autonomy"] }),
    ])
    expect(compatibility).toContain("Format-compatible")
    expect(compatibility).toContain("Smoke-tested")
    expect(compatibility).toContain("Enhanced")
    expect(compatibility).toContain("| OpenCode | Yes | Yes (`bun run smoke:opencode`) | Yes |")
    expect(compatibility).toContain("| Claude Code | Yes | Not yet | No |")
  })

  test("wires the OpenCode command to the portable skill and adapter tools", () => {
    expect(command).toContain("`ace` skill")
    for (const tool of ["ace_start", "ace_status", "ace_progress", "ace_complete"]) {
      expect(command).toContain(tool)
      expect(plugin).toContain(`${tool}: tool({`)
    }
  })

  test("installs a complete OpenCode bundle and protects existing files", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "ace-opencode-"))
    await writeFile(resolve(configRoot, "package.json"), JSON.stringify({
      dependencies: { "@opencode-ai/plugin": "1.18.5" },
    }), "utf8")
    const runInstaller = async () => {
      const process = Bun.spawn(["bun", "scripts/install-opencode.ts"], {
        cwd: root,
        env: { ...Bun.env, OPENCODE_CONFIG_DIR: configRoot },
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
      ])
      return { exitCode, stdout, stderr }
    }

    try {
      const first = await runInstaller()
      expect(first.exitCode).toBe(0)
      await access(resolve(configRoot, "skills/ace/LICENSE"))
      await access(resolve(configRoot, "skills/ace/references/evidence.md"))
      await access(resolve(configRoot, "commands/ace.md"))
      await access(resolve(configRoot, "plugins/ace.ts"))

      const second = await runInstaller()
      expect(second.exitCode).not.toBe(0)
      expect(second.stderr).toContain("would overwrite")
    } finally {
      await rm(configRoot, { force: true, recursive: true })
    }
  })
})

describe("Repository releases", () => {
  test("accepts stable and prerelease SemVer", () => {
    expect(requireReleaseVersion("0.1.0")).toBe("0.1.0")
    expect(requireReleaseVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1")
  })

  test("rejects ambiguous or prefixed versions", () => {
    for (const value of ["v1.2.3", "1.2", "01.2.3", "1.2.3-beta.01", "latest", undefined]) {
      expect(() => requireReleaseVersion(value)).toThrow("valid SemVer")
    }
  })
})
