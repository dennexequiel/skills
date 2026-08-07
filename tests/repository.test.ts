import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const VERSION_MANIFESTS = ["package.json", ".claude-plugin/plugin.json"]
const PLUGIN_MANIFEST = ".claude-plugin/plugin.json"
const MARKETPLACE_MANIFEST = ".claude-plugin/marketplace.json"

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
  })
})
