import { buildResult, scanDocument, visibleFindings } from "./engine.ts"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { changedPaths, readSources, repositoryRoot } from "./input.ts"
import { findConfig, inferProfile } from "./policy.ts"
import { jsonResult, renderJsonError, renderText } from "./render.ts"
import { PROFILES, type Profile } from "./types.ts"

type Arguments = {
  files: string[]
  stdin: boolean
  changed: boolean
  base?: string
  profile: Profile
  format: "text" | "json"
  strict: boolean
  config?: string
  profileSpecified: boolean
  help: boolean
}

const USAGE = "Usage: scan.ts [--stdin | --changed | files...] [--base <ref>] [--type <profile>] [--format text|json] [--strict] [--config <path>] [--]"

class ArgumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArgumentError"
  }
}

function parseArguments(argv: string[]): Arguments {
  const arguments_: Arguments = { files: [], stdin: false, changed: false, profile: "auto", format: "text", strict: false, help: false, profileSpecified: false }
  let pathsOnly = false
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index] ?? ""
    if (pathsOnly) {
      arguments_.files.push(value)
      continue
    }
    if (value === "--") {
      pathsOnly = true
      continue
    }
    if (!value.startsWith("-")) {
      arguments_.files.push(value)
      continue
    }
    if (value === "--help" || value === "-h") {
      arguments_.help = true
      continue
    }
    if (value === "--stdin") {
      arguments_.stdin = true
      continue
    }
    if (value === "--changed") {
      arguments_.changed = true
      continue
    }
    if (value === "--strict") {
      arguments_.strict = true
      continue
    }
    const option = value === "--type" || value === "--format" || value === "--config" || value === "--base" ? value : undefined
    if (!option) throw new ArgumentError(`Unknown option ${value}.`)
    const next = argv[index + 1]
    const isFlag = next === "--help" || next === "-h" || next === "--stdin" || next === "--changed" || next === "--strict" || next === "--type" || next === "--format" || next === "--config" || next === "--base"
    if (!next || next === "--" || (option !== "--base" && next.startsWith("-")) || isFlag) throw new ArgumentError(`${option} requires a value.`)
    index += 1
    if (option === "--type") {
      if (!PROFILES.includes(next as Profile)) throw new ArgumentError(`--type must be one of: ${PROFILES.join(", ")}.`)
      arguments_.profile = next as Profile
      arguments_.profileSpecified = true
    } else if (option === "--format") {
      if (next !== "text" && next !== "json") throw new ArgumentError("--format must be text or json.")
      arguments_.format = next
    } else if (option === "--config") arguments_.config = next
    else arguments_.base = next
  }
  if (arguments_.help) return arguments_
  if (arguments_.stdin && (arguments_.changed || arguments_.files.length)) throw new ArgumentError("--stdin cannot be combined with files or --changed.")
  if (arguments_.changed && arguments_.files.length) throw new ArgumentError("--changed cannot be combined with explicit files.")
  if (!arguments_.changed && arguments_.base) throw new ArgumentError("--base requires --changed.")
  if (!arguments_.stdin && !arguments_.changed && !arguments_.files.length) throw new ArgumentError(`No input files.\n${USAGE}`)
  return arguments_
}

async function stdinSource(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
  } catch {
    throw new Error("Cannot read stdin: invalid UTF-8.")
  }
}

function requestsJson(argv: string[]): boolean {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--") return false
    if (argv[index] === "--format" && argv[index + 1] === "json") return true
  }
  return false
}

async function main(argv: string[]): Promise<number> {
  let parsed: Arguments | undefined
  try {
    parsed = parseArguments(argv)
    if (parsed.help) {
      process.stdout.write(`${USAGE}\n`)
      return 0
    }
    const cwd = process.cwd()
    const arguments_ = parsed
    const root = await repositoryRoot(cwd)
    if (arguments_.changed && !root) throw new Error("--changed requires a Git repository.")
    const config = findConfig(cwd, root, arguments_.config)
    const inputRoot = arguments_.changed ? root ?? cwd : cwd
    const paths = arguments_.changed ? await changedPaths(inputRoot, arguments_.base) : arguments_.files
    const sources = await readSources(inputRoot, paths, arguments_.stdin ? await stdinSource() : undefined)
    const documents = sources.map((input) => {
      const profile = inferProfile(input.file, input.source, arguments_.profile, arguments_.profileSpecified ? "auto" : config.defaultProfile)
      return scanDocument({ ...input, profile, config })
    })
    const result = buildResult(documents)
    const visible = visibleFindings(result, arguments_.strict)
    if (arguments_.format === "json") process.stdout.write(`${JSON.stringify(jsonResult(result, arguments_.strict))}\n`)
    else process.stdout.write(renderText(result, arguments_.strict))
    return visible.length ? 1 : 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const wantsJson = parsed?.format === "json" || requestsJson(argv)
    if (wantsJson) process.stdout.write(renderJsonError(message))
    else process.stderr.write(`${message}\n`)
    return 2
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2))

export { main, parseArguments }
