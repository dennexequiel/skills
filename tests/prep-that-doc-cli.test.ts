import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { execFileSync, spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const repository = resolve(import.meta.dir, "..")
const scanner = join(repository, "skills/prep-that-doc/scripts/scan.ts")
const node = process.env.PREPDOC_NODE ?? "node"

type Invocation = { status: number | null; stdout: string; stderr: string }
type Category = "structural" | "factualGap" | "stylistic"
type JsonResult = { schemaVersion: string; rulesetVersion: string; profile: string; documents: Array<{ file: string; profile: string; skipped?: { reason: string }; findings: Array<{ rule: string; category: Category; severity: string }> }>; findings: Array<{ rule: string; category: Category; severity: string }>; summary: Record<Category, number> }

function invoke(runtime: string, cwd: string, args: string[], input?: Buffer): Invocation {
  const result = spawnSync(runtime, [scanner, ...args], { cwd, input, encoding: "utf8", timeout: 10_000, killSignal: "SIGKILL" })
  if (result.error) throw result.error
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" })
}

async function temporaryRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "prepdoc-cli-"))
  git(directory, ["init", "--quiet"])
  git(directory, ["config", "user.email", "tests@example.test"])
  git(directory, ["config", "user.name", "Prepdoc tests"])
  return directory
}

function json(result: Invocation): JsonResult {
  return JSON.parse(result.stdout) as JsonResult
}

function error(result: Invocation): string {
  return (JSON.parse(result.stdout) as { error: { message: string } }).error.message
}

async function withDirectory(run: (directory: string) => Promise<void>, gitRepository = false): Promise<void> {
  const directory = gitRepository ? await temporaryRepository() : await mkdtemp(join(tmpdir(), "prepdoc-cli-"))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}

function expectInvariants(output: JsonResult): void {
  expect(output.schemaVersion).toBe("1")
  expect(output.rulesetVersion).toBe("1")
  expect(output.findings).toEqual(output.documents.flatMap((document) => document.findings))
  const summary: Record<Category, number> = { structural: 0, factualGap: 0, stylistic: 0 }
  for (const finding of output.findings) summary[finding.category] += 1
  expect(output.summary).toEqual(summary)
}

describe("prep-that-doc CLI", () => {
  test("validates inputs and emits JSON errors even after an invalid first flag", async () => {
    await withDirectory(async (directory) => {
      await writeFile(join(directory, "--not-an-option.md"), "# Clean\n", "utf8")
      const cases: Array<[string[], string]> = [
        [["--changed", "doc.md"], "--changed cannot be combined with explicit files."],
        [["--stdin", "doc.md"], "--stdin cannot be combined with files or --changed."],
        [["--stdin", "--changed"], "--stdin cannot be combined with files or --changed."],
        [["--base", "HEAD"], "--base requires --changed."], [[], "No input files."],
        [["--wat"], "Unknown option --wat."], [["--type"], "--type requires a value."],
        [["--format", "--strict"], "--format requires a value."], [["--config", "--"], "--config requires a value."],
        [["--base"], "--base requires a value."],
      ]
      for (const [args, message] of cases) {
        const result = invoke(node, directory, ["--format", "json", ...args])
        expect(result.status).toBe(2)
        expect(error(result)).toContain(message)
      }
      const invalidFirst = invoke(node, directory, ["--wat", "--format", "json"])
      expect(invalidFirst.status).toBe(2)
      expect(error(invalidFirst)).toBe("Unknown option --wat.")
      const filename = invoke(node, directory, ["--format", "json", "--", "--not-an-option.md"])
      expect(filename.status).toBe(0)
      expect(json(filename).documents.map((document) => document.file)).toEqual(["--not-an-option.md"])
      const invalidUtf8 = invoke(node, directory, ["--format", "json", "--stdin"], Buffer.from([0xff]))
      expect(invalidUtf8.status).toBe(2)
      expect(error(invalidUtf8)).toBe("Cannot read stdin: invalid UTF-8.")
    })
  })

  test("selects changed Markdown from the root, including branch, index, rename, and newline names", async () => {
    await withDirectory(async (directory) => {
      await mkdir(join(directory, "docs"))
      await mkdir(join(directory, "vendor"))
      await writeFile(join(directory, "tracked-delete.md"), "# Delete\n", "utf8")
      await writeFile(join(directory, "cached-delete.md"), "# Cache\n", "utf8")
      await writeFile(join(directory, "old name.md"), "# Rename\n", "utf8")
      await writeFile(join(directory, "vendor", "tracked.md"), "# Vendor\n", "utf8")
      await writeFile(join(directory, ".gitignore"), "ignored/\ngenerated/\ndist/\n", "utf8")
      git(directory, ["add", "."])
      git(directory, ["commit", "--quiet", "-m", "initial"])
      git(directory, ["branch", "base"])
      await writeFile(join(directory, "branch.md"), "# Branch\n\nRestart quickly.\n", "utf8")
      git(directory, ["add", "branch.md"])
      git(directory, ["commit", "--quiet", "-m", "branch-only"])
      await writeFile(join(directory, "docs", "unstaged.md"), "# Unstaged\n", "utf8")
      await writeFile(join(directory, "staged.md"), "# Staged\n", "utf8")
      git(directory, ["add", "staged.md"])
      await writeFile(join(directory, "untracked.md"), "# Untracked\n", "utf8")
      for (const path of ["ignored", "generated", "dist"]) {
        await mkdir(join(directory, path))
        await writeFile(join(directory, path, "skip.md"), "# Skip\n", "utf8")
      }
      await writeFile(join(directory, "vendor", "tracked.md"), "# Changed vendor\n", "utf8")
      await writeFile(join(directory, "cached-delete.md"), "# Changed cache\n", "utf8")
      git(directory, ["add", "cached-delete.md"])
      await rm(join(directory, "cached-delete.md"))
      await rm(join(directory, "tracked-delete.md"))
      await rename(join(directory, "old name.md"), join(directory, "renamed\nname.md"))
      const result = invoke(node, join(directory, "docs"), ["--changed", "--base", "base", "--format", "json"])
      expect(result.status).toBe(1)
      const output = json(result)
      expect(output.documents.map((document) => document.file)).toEqual(["branch.md", "docs/unstaged.md", "renamed\nname.md", "staged.md", "untracked.md"])
      expect(output.documents.find((document) => document.file === "branch.md")?.findings.map((finding) => finding.rule)).toContain("tell-vague-number")
      expect(new Set(output.documents.map((document) => document.file)).size).toBe(output.documents.length)
      expectInvariants(output)
    }, true)
  })

  test("returns 2 for Git failures and 0 for an empty changed selection", async () => {
    await withDirectory(async (directory) => {
      const result = invoke(node, directory, ["--changed", "--format", "json"])
      expect(result.status).toBe(2)
      expect(error(result)).toBe("--changed requires a Git repository.")
    })
    await withDirectory(async (directory) => {
      await writeFile(join(directory, "doc.md"), "# Clean\n", "utf8")
      git(directory, ["add", "."])
      git(directory, ["commit", "--quiet", "-m", "initial"])
      const empty = invoke(node, directory, ["--changed", "--format", "json"])
      expect(empty.status).toBe(0)
      expect(json(empty).documents).toEqual([])
      const missingBase = invoke(node, directory, ["--changed", "--base", "does-not-exist", "--format", "json"])
      expect(missingBase.status).toBe(2)
      expect(error(missingBase)).toContain("git merge-base --end-of-options does-not-exist HEAD failed")
    }, true)
  })

  test("applies config validation, terminology, protected sections, and profile precedence", async () => {
    await withDirectory(async (directory) => {
      await writeFile(join(directory, "doc.md"), "# Doc\n\n“curly” critical Restart quickly. word — word —\n\n# Protected\n\ncritical\n", "utf8")
      await writeFile(join(directory, ".prepdocrc"), JSON.stringify({ version: 1, defaultProfile: "pr", acceptedTerminology: ["critical"], protectedSections: ["Protected"], disabledRules: ["tell-vague-number"], severityOverrides: { "tell-curly": "HIGH" }, houseStyle: { allowCurlyQuotes: true } }), "utf8")
      const configured = json(invoke(node, directory, ["--format", "json", "doc.md"]))
      expect(configured.profile).toBe("pr")
      expect(configured.findings.map((finding) => finding.rule)).not.toContain("tell-curly")
      expect(configured.findings.map((finding) => finding.rule)).not.toContain("tell-vague-number")
      expect(configured.findings.map((finding) => finding.rule)).not.toContain("tell-significance")
      expectInvariants(configured)
      expect(json(invoke(node, directory, ["--strict", "--format", "json", "doc.md"])).findings.map((finding) => finding.rule)).toContain("tell-emdash")
      expect(json(invoke(node, directory, ["--type", "generic", "--format", "json", "doc.md"])).profile).toBe("generic")
      expect(json(invoke(node, directory, ["--type", "auto", "--format", "json", "doc.md"])).profile).toBe("generic")
      const invalid: Array<[string, unknown, string]> = [
        ["missing-version", {}, "version must be 1"], ["unknown-key", { version: 1, nope: true }, "unknown key nope"],
        ["unknown-rule", { version: 1, disabledRules: ["nope"] }, "unknown rule nope"],
        ["unknown-profile", { version: 1, defaultProfile: "nope" }, "defaultProfile must be one of"],
        ["unknown-severity", { version: 1, severityOverrides: { "tell-curly": "NOPE" } }, "severityOverrides.tell-curly must be one of"],
      ]
      for (const [name, config, message] of invalid) {
        const configFile = name + ".json"
        await writeFile(join(directory, configFile), JSON.stringify(config), "utf8")
        const result = invoke(node, directory, ["--format", "json", "--config", configFile, "doc.md"])
        expect(result.status).toBe(2)
        expect(error(result)).toContain(message)
      }
      await writeFile(join(directory, "invalid.json"), "{", "utf8")
      expect(error(invoke(node, directory, ["--format", "json", "--config", "invalid.json", "doc.md"]))).toContain("Cannot parse")
      expect(error(invoke(node, directory, ["--format", "json", "--config", "missing.json", "doc.md"]))).toContain("Cannot read configuration")
    })
  })

  test("uses nearest Git config, strict visibility, severity overrides, and both runtimes", async () => {
    await withDirectory(async (directory) => {
      await mkdir(join(directory, "nested"))
      await writeFile(join(directory, "doc.md"), "# Doc\n\n“curly” In conclusion, this is clean.\n", "utf8")
      await writeFile(join(directory, ".prepdocrc"), JSON.stringify({ version: 1, defaultProfile: "generic" }), "utf8")
      await writeFile(join(directory, "profile.json"), JSON.stringify({ version: 1, defaultProfile: "pr" }), "utf8")
      await writeFile(join(directory, "nested", ".prepdocrc"), JSON.stringify({ version: 1, defaultProfile: "readme", houseStyle: { allowCurlyQuotes: true } }), "utf8")
      git(directory, ["add", "."])
      git(directory, ["commit", "--quiet", "-m", "config"])
      const nearest = json(invoke(node, join(directory, "nested"), ["--format", "json", "../doc.md"]))
      expect(nearest.profile).toBe("readme")
      expect(nearest.findings.map((finding) => finding.rule)).not.toContain("tell-curly")
      expect(json(invoke(node, join(directory, "nested"), ["--format", "json", "--config", "../profile.json", "../doc.md"])).profile).toBe("pr")
      expect(invoke(node, directory, ["doc.md"]).status).toBe(0)
      expect(invoke(node, directory, ["--strict", "doc.md"]).status).toBe(1)
      await writeFile(join(directory, "severity.json"), JSON.stringify({ version: 1, severityOverrides: { "tell-conclusion": "HIGH" } }), "utf8")
      expect(json(invoke(node, directory, ["--format", "json", "--config", "severity.json", "doc.md"])).findings.find((finding) => finding.rule === "tell-conclusion")?.severity).toBe("HIGH")
    }, true)
  })

  test("keeps text and JSON documents coherent across Node and Bun without partial output", async () => {
    await withDirectory(async (directory) => {
      await writeFile(join(directory, "README.md"), "# Readme\n\nRestart quickly.\n", "utf8")
      await writeFile(join(directory, "generated.md"), "<!-- generated by test -->\n# Generated\n", "utf8")
      await writeFile(join(directory, "clean.md"), "# Clean\n", "utf8")
      const args = ["--format", "json", "README.md", "generated.md", "clean.md", "./clean.md"]
      const nodeOutput = json(invoke(node, directory, args))
      expect(json(invoke(process.execPath, directory, args))).toEqual(nodeOutput)
      expect(nodeOutput.profile).toBe("mixed")
      expect(nodeOutput.documents.map((document) => document.file)).toEqual(["README.md", "generated.md", "clean.md"])
      expect(nodeOutput.documents.find((document) => document.file === "generated.md")?.skipped?.reason).toBe("generated document comment")
      expect(nodeOutput.documents.find((document) => document.file === "clean.md")?.findings).toEqual([])
      expectInvariants(nodeOutput)
      const text = invoke(node, directory, ["README.md", "generated.md", "clean.md"])
      expect(text.stdout).toContain("generated.md\n  skipped: generated document comment")
      expect(text.stdout).toContain("clean.md\n  no candidates")
      expect(await readFile(join(directory, "README.md"), "utf8")).toBe("# Readme\n\nRestart quickly.\n")
      await writeFile(join(directory, "bad.md"), Buffer.from([0xff]))
      const unreadable = invoke(node, directory, ["--format", "json", "clean.md", "bad.md"])
      expect(unreadable.status).toBe(2)
      expect(error(unreadable)).toBe("Cannot read bad.md: invalid UTF-8.")
    })
  })
})

test("file and stdin scanning work without a Git executable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prepdoc-no-git-"))
  try {
    const executable = execFileSync(node, ["-p", "process.execPath"], { encoding: "utf8" }).trim()
    await writeFile(join(directory, "doc.md"), "# Guide\n\nRestart quickly.\n")
    for (const args of [["--stdin"], ["doc.md"]]) {
      const result = spawnSync(executable, [scanner, "--format", "json", ...args], {
        cwd: directory, encoding: "utf8", input: "# Guide\n\nRestart quickly.\n", env: { ...process.env, PATH: "" }, timeout: 10_000,
      })
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).findings[0].rule).toBe("tell-vague-number")
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
