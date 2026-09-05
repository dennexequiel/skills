import { readFile, stat } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"
import { spawn } from "node:child_process"

export class InputError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = "InputError"
  }
}

export type SourceInput = { file: string; absoluteFile?: string; source: string }

export async function runGit(cwd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolveResult, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    const output: Buffer[] = []
    const errors: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk))
    child.once("error", (error) => reject(new InputError(`Cannot run git ${args.join(" ")}: ${error.message}`, error)))
    child.once("close", (code) => {
      if (code === 0) resolveResult(Buffer.concat(output))
      else reject(new InputError(`git ${args.join(" ")} failed: ${Buffer.concat(errors).toString("utf8").trim() || `exit ${code ?? "unknown"}`}`))
    })
  })
}

export async function repositoryRoot(cwd: string): Promise<string | undefined> {
  try {
    return (await runGit(cwd, ["rev-parse", "--show-toplevel"])).toString("utf8").trim() || undefined
  } catch (error) {
    if (error instanceof InputError && /not a git repository/i.test(error.message)) return undefined
    if (error instanceof InputError && error.cause instanceof Error && "code" in error.cause && error.cause.code === "ENOENT") return undefined
    throw error
  }
}

function nulStrings(value: Buffer): string[] {
  return value.toString("utf8").split("\0").filter(Boolean)
}

function changedNames(value: Buffer): string[] {
  const parts = nulStrings(value)
  const names: string[] = []
  for (let index = 0; index < parts.length;) {
    const status = parts[index++] ?? ""
    const state = status[0]
    if (state === "R" || state === "C") {
      index += 1
      const destination = parts[index++]
      if (destination) names.push(destination)
    } else {
      const name = parts[index++]
      if (name && state !== "D") names.push(name)
    }
  }
  return names
}

function isMarkdown(path: string): boolean {
  return /\.(?:md|markdown|mdx)$/i.test(path)
}

function ignoredChangedPath(path: string): boolean {
  return /(?:^|\/)(?:node_modules|vendor|dist|build)(?:\/|$)/i.test(path) || /(?:^|\/)generated(?:\/|$)/i.test(path) || /(?:\.generated|\.gen)\.mdx?$/i.test(path)
}

export async function changedPaths(root: string, base?: string): Promise<string[]> {
  const batches: Buffer[] = []
  if (base) {
    const mergeBase = (await runGit(root, ["merge-base", "--end-of-options", base, "HEAD"])).toString("utf8").trim()
    batches.push(await runGit(root, ["diff", "--name-status", "-z", "-M", mergeBase, "HEAD"]))
  }
  batches.push(
    await runGit(root, ["diff", "--name-status", "-z", "-M"]),
    await runGit(root, ["diff", "--cached", "--name-status", "-z", "-M"]),
    await runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  )
  const names = new Set<string>()
  for (const [index, batch] of batches.entries()) {
    const paths = index === batches.length - 1 ? nulStrings(batch) : changedNames(batch)
    for (const path of paths) if (isMarkdown(path) && !ignoredChangedPath(path)) names.add(path)
  }
  const existing: string[] = []
  for (const path of names) {
    try {
      if ((await stat(resolve(root, path))).isFile()) existing.push(path)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw new InputError(`Cannot inspect changed file ${path}: ${error instanceof Error ? error.message : String(error)}`, error)
      }
    }
  }
  return existing.sort()
}

export async function readSources(cwd: string, paths: string[], stdin?: string): Promise<SourceInput[]> {
  if (stdin !== undefined) return [{ file: "<stdin>", source: stdin }]
  const sources: SourceInput[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    const absoluteFile = resolve(cwd, path)
    if (seen.has(absoluteFile)) continue
    seen.add(absoluteFile)
    let bytes: Buffer
    try {
      bytes = await readFile(absoluteFile)
    } catch (error) {
      throw new InputError(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
    let source: string
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      throw new InputError(`Cannot read ${path}: invalid UTF-8.`)
    }
    const normalized = relative(cwd, absoluteFile).split(sep).join("/") || path
    sources.push({ file: normalized, absoluteFile, source })
  }
  return sources
}
