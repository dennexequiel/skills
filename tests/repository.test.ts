import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const VERSION_MANIFESTS = ["package.json", ".claude-plugin/plugin.json"]
const PLUGIN_MANIFEST = ".claude-plugin/plugin.json"
const MARKETPLACE_MANIFEST = ".claude-plugin/marketplace.json"
const COLLECTION_LEAD = "Agent skills that come with receipts."

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requireObject(value: unknown, source: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${source} must contain a JSON object`)
  }
  return value
}

function requireString(record: Record<string, unknown>, field: string, source: string): string {
  const value = record[field]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${source} must contain a non-empty ${field}`)
  }
  return value
}

async function readManifest(path: string): Promise<Record<string, unknown>> {
  const source = await readFile(resolve(ROOT, path), "utf8")
  const manifest: unknown = JSON.parse(source)
  return requireObject(manifest, path)
}

describe("Repository invariants", () => {
  test("keeps every version-bearing manifest on the single repository version", async () => {
    const versions = await Promise.all(VERSION_MANIFESTS.map(async (path) => {
      const manifest = await readManifest(path)
      return [path, requireString(manifest, "version", path)] as const
    }))
    const [reference] = versions
    if (!reference) throw new Error("No version-bearing manifests were configured")
    for (const [path, version] of versions) {
      expect(`${path}@${version}`).toBe(`${path}@${reference[1]}`)
    }
  })

  test("keeps the marketplace install name aligned with the plugin name", async () => {
    const plugin = await readManifest(PLUGIN_MANIFEST)
    const marketplace = await readManifest(MARKETPLACE_MANIFEST)
    const plugins = marketplace.plugins
    if (!Array.isArray(plugins) || !plugins.length) {
      throw new Error(`${MARKETPLACE_MANIFEST} must contain at least one plugin`)
    }
    const marketplacePlugin = requireObject(plugins[0], `${MARKETPLACE_MANIFEST} plugins[0]`)

    expect(requireString(marketplacePlugin, "name", `${MARKETPLACE_MANIFEST} plugins[0]`))
      .toBe(requireString(plugin, "name", PLUGIN_MANIFEST))
    expect(requireString(marketplacePlugin, "description", `${MARKETPLACE_MANIFEST} plugins[0]`))
      .toBe(requireString(plugin, "description", PLUGIN_MANIFEST))
  })

  test("keeps the collection description free of the skills it happens to contain", async () => {
    const manifests = await Promise.all(
      [PLUGIN_MANIFEST, MARKETPLACE_MANIFEST, "package.json"].map(async (path) =>
        [path, requireString(await readManifest(path), "description", path)] as const),
    )
    const skillNames = (await readdir(resolve(ROOT, "skills"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
    for (const [path, description] of manifests) {
      expect(description.startsWith(COLLECTION_LEAD)).toBe(true)
      for (const name of skillNames) {
        expect(`${path} names ${name}: ${description.toLowerCase().includes(name.replace(/-/g, " "))}`)
          .toBe(`${path} names ${name}: false`)
      }
    }
  })
})
