import { cp, mkdir, readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const configRoot = process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode")
const force = process.argv.includes("--force")
const packagePath = join(configRoot, "package.json")
const repositoryPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  devDependencies?: Record<string, string>
}
const pluginPackage = "@opencode-ai/plugin"
const requiredPluginVersion = repositoryPackage.devDependencies?.[pluginPackage]
if (!requiredPluginVersion) throw new Error(`${pluginPackage} must be pinned in the repository devDependencies`)
const copies = [
  [join(root, "skills", "ace"), join(configRoot, "skills", "ace")],
  [join(root, "adapters", "opencode", "command", "ace.md"), join(configRoot, "commands", "ace.md")],
  [join(root, "adapters", "opencode", "plugin", "ace.ts"), join(configRoot, "plugins", "ace.ts")],
] as const

if (!force) {
  const conflicts: string[] = []
  for (const [, destination] of copies) {
    if (await stat(destination).catch(() => undefined)) conflicts.push(destination)
  }
  if (conflicts.length) {
    throw new Error(`Ace installation would overwrite:\n${conflicts.join("\n")}\nRe-run with --force after reviewing them.`)
  }
}

const configPackage = JSON.parse(await readFile(packagePath, "utf8").catch((error: unknown) => {
  if ((error as { code?: string }).code === "ENOENT") return "{}"
  throw error
})) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const installedPluginVersion = configPackage.dependencies?.[pluginPackage]
  ?? configPackage.devDependencies?.[pluginPackage]

if (installedPluginVersion && installedPluginVersion !== requiredPluginVersion) {
  throw new Error(
    `${configRoot} uses ${pluginPackage}@${installedPluginVersion}; Ace requires ${requiredPluginVersion}. ` +
    "Review the OpenCode package compatibility before changing it.",
  )
}

if (!installedPluginVersion) {
  await mkdir(configRoot, { recursive: true })
  const install = Bun.spawn(["bun", "add", "--exact", `${pluginPackage}@${requiredPluginVersion}`], {
    cwd: configRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  if (await install.exited !== 0) throw new Error(`Could not install ${pluginPackage}@${requiredPluginVersion}`)
}

for (const [source, destination] of copies) {
  await mkdir(resolve(destination, ".."), { recursive: true })
  await cp(source, destination, { force, recursive: true })
}

console.log(`Installed Ace in ${configRoot}`)
console.log(`Verified ${pluginPackage}@${requiredPluginVersion}`)
console.log("Restart OpenCode to load the adapter, then run /ace status to verify discovery.")
