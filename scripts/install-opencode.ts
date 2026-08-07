import { cp, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"

const FORCE_OPTION = "--force"
const HELP_OPTION = "--help"
const PLUGIN_PACKAGE = "@opencode-ai/plugin"
const REPOSITORY_ROOT = resolve(import.meta.dir, "..")
const CONFIG_ROOT = process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode")
const CONFIG_PACKAGE_PATH = join(CONFIG_ROOT, "package.json")
const OPTIONS = process.argv.slice(2)
const MANAGED_COPIES = [
  [join(REPOSITORY_ROOT, "skills", "ace"), join(CONFIG_ROOT, "skills", "ace")],
  [join(REPOSITORY_ROOT, "adapters", "opencode", "command", "ace.md"), join(CONFIG_ROOT, "commands", "ace.md")],
  [join(REPOSITORY_ROOT, "adapters", "opencode", "plugin", "ace.ts"), join(CONFIG_ROOT, "plugins", "ace.ts")],
] as const

const unknownOptions = OPTIONS.filter((option) => option !== FORCE_OPTION && option !== HELP_OPTION)
if (unknownOptions.length) throw new Error(`Unknown option: ${unknownOptions.join(", ")}`)
if (OPTIONS.includes(HELP_OPTION)) {
  console.log("Usage: bun run install:opencode [--force]")
  process.exit(0)
}
const force = OPTIONS.includes(FORCE_OPTION)
const repositoryPackage = JSON.parse(await readFile(join(REPOSITORY_ROOT, "package.json"), "utf8")) as {
  devDependencies?: Record<string, string>
}
const requiredPluginVersion = repositoryPackage.devDependencies?.[PLUGIN_PACKAGE]
if (!requiredPluginVersion) throw new Error(`${PLUGIN_PACKAGE} must be pinned in the repository devDependencies`)

function isMissingFileError(error: unknown): boolean {
  return (error as { code?: string }).code === "ENOENT"
}

// Recursive copy merges directories, which leaves files that a newer version deleted. Staging a
// complete copy and swapping it keeps the previous contents recoverable if the swap fails.
async function replaceManagedDestination(source: string, destination: string): Promise<void> {
  const parent = dirname(destination)
  await mkdir(parent, { recursive: true })
  const transaction = await mkdtemp(join(parent, `.${basename(destination)}-install-`))
  const staged = join(transaction, "staged")
  const backup = join(transaction, "backup")
  try {
    await cp(source, staged, { recursive: true })
    const existing = await stat(destination).catch(() => undefined)
    if (existing) await rename(destination, backup)
    try {
      await rename(staged, destination)
    } catch (error) {
      if (existing) await rename(backup, destination)
      throw new Error(
        `Could not replace managed OpenCode destination ${destination}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } finally {
    await rm(transaction, { force: true, recursive: true })
  }
}

if (!force) {
  const conflicts: string[] = []
  for (const [, destination] of MANAGED_COPIES) {
    if (await stat(destination).catch(() => undefined)) conflicts.push(destination)
  }
  if (conflicts.length) {
    throw new Error(`Ace installation would overwrite:\n${conflicts.join("\n")}\nRe-run with --force after reviewing them.`)
  }
}

const configPackage = JSON.parse(await readFile(CONFIG_PACKAGE_PATH, "utf8").catch((error: unknown) => {
  if (isMissingFileError(error)) return "{}"
  throw error
})) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const installedPluginVersion = configPackage.dependencies?.[PLUGIN_PACKAGE]
  ?? configPackage.devDependencies?.[PLUGIN_PACKAGE]

if (installedPluginVersion && installedPluginVersion !== requiredPluginVersion) {
  throw new Error(
    `${CONFIG_ROOT} uses ${PLUGIN_PACKAGE}@${installedPluginVersion}; Ace requires ${requiredPluginVersion}. ` +
    "Review the OpenCode package compatibility before changing it.",
  )
}

if (!installedPluginVersion) {
  await mkdir(CONFIG_ROOT, { recursive: true })
  const install = Bun.spawn(["bun", "add", "--exact", `${PLUGIN_PACKAGE}@${requiredPluginVersion}`], {
    cwd: CONFIG_ROOT,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  if (await install.exited !== 0) throw new Error(`Could not install ${PLUGIN_PACKAGE}@${requiredPluginVersion}`)
}

for (const [source, destination] of MANAGED_COPIES) {
  if (force) {
    await replaceManagedDestination(source, destination)
  } else {
    await mkdir(dirname(destination), { recursive: true })
    await cp(source, destination, { recursive: true })
  }
}

console.log(`Installed Ace in ${CONFIG_ROOT}`)
console.log(`Verified ${PLUGIN_PACKAGE}@${requiredPluginVersion}`)
console.log("Restart OpenCode to load the adapter, then run /ace status to verify discovery.")
