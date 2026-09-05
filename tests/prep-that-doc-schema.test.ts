import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { buildResult, scanDocument } from "../skills/prep-that-doc/scripts/engine.ts"
import { DEFAULT_CONFIG, parseConfig } from "../skills/prep-that-doc/scripts/policy.ts"
import { jsonResult, renderJsonError } from "../skills/prep-that-doc/scripts/render.ts"
import { PROFILES, SEVERITIES } from "../skills/prep-that-doc/scripts/types.ts"
import { RULES } from "../skills/prep-that-doc/scripts/registry.ts"

type Schema = {
  $ref?: string
  $defs?: Record<string, Schema>
  oneOf?: Schema[]
  type?: string
  const?: unknown
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, Schema>
  additionalProperties?: boolean
  items?: Schema
  minimum?: number
  maximum?: number
  minLength?: number
  pattern?: string
}
const root = resolve(import.meta.dir, "..")
const schemaDirectory = resolve(root, "skills/prep-that-doc/references")
const outputSchema: Schema = JSON.parse(await readFile(resolve(schemaDirectory, "output.schema.json"), "utf8"))
const configSchema: Schema = JSON.parse(await readFile(resolve(schemaDirectory, "config.schema.json"), "utf8"))

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

// This checks the keyword subset used by these checked-in wire schemas, not arbitrary JSON Schema.
function conforms(value: unknown, schema: Schema, document: Schema = schema): boolean {
  if (schema.$ref) {
    const reference = schema.$ref.replace(/^#\/\$defs\//, "")
    const target = document.$defs?.[reference]
    if (!target) throw new Error(`Unresolved test schema reference ${schema.$ref}`)
    return conforms(value, target, document)
  }
  if (schema.oneOf && schema.oneOf.filter((alternative) => conforms(value, alternative, document)).length !== 1) return false
  if ("const" in schema && value !== schema.const) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === "object" && !isObject(value)) return false
  if (schema.type === "array" && !Array.isArray(value)) return false
  if (schema.type === "string" && typeof value !== "string") return false
  if (schema.type === "boolean" && typeof value !== "boolean") return false
  if (schema.type === "integer" && !Number.isInteger(value)) return false
  if (isObject(value)) {
    if (schema.required?.some((key) => !(key in value))) return false
    for (const [key, item] of Object.entries(value)) {
      const property = schema.properties?.[key]
      if (property && !conforms(item, property, document)) return false
      if (!property && schema.additionalProperties === false) return false
    }
  }
  if (Array.isArray(value) && schema.items && !value.every((item) => conforms(item, schema.items ?? {}, document))) return false
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return false
    if (schema.maximum !== undefined && value > schema.maximum) return false
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) return false
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false
  }
  return true
}

describe("Prep That Doc published schemas", () => {
  test("accepts actual scanner success, candidate, skipped, empty and error output", () => {
    const documents = [
      scanDocument({ file: "guide.md", source: "# Guide\n\n### Usage\n", profile: "generic", config: DEFAULT_CONFIG }),
      scanDocument({ file: "pr.md", source: "## Summary\n\n## Testing\n", profile: "pr", config: DEFAULT_CONFIG }),
      scanDocument({ file: "generated.md", source: "<!-- @generated -->\n", profile: "generic", config: DEFAULT_CONFIG }),
    ]
    for (const selected of [documents, [documents[0]!], [], [documents[1]!], [documents[2]!]]) {
      expect(conforms(jsonResult(buildResult(selected), false), outputSchema)).toBe(true)
    }
    expect(conforms(JSON.parse(renderJsonError("Cannot read input.md")), outputSchema)).toBe(true)
  })

  test("rejects malformed findings and incompatible versions", () => {
    const result = jsonResult(buildResult([scanDocument({ file: "guide.md", source: "# Guide\n\n### Usage\n", profile: "generic", config: DEFAULT_CONFIG })]), false)
    const finding = result.findings[0]
    if (!finding) throw new Error("Schema fixture must produce a finding")
    expect(conforms({ ...result, schemaVersion: 2 }, outputSchema)).toBe(false)
    expect(conforms({ ...result, findings: [{ ...finding, confidence: "guessed" }] }, outputSchema)).toBe(false)
    expect(conforms({ ...result, findings: [{ ...finding, location: { line: 0, column: 1 } }] }, outputSchema)).toBe(false)
    expect(conforms({ ...result, findings: [{ ...finding, autofix: "automatic" }] }, outputSchema)).toBe(false)
  })

  test("configuration schema and parser agree on supported options", () => {
    for (const profile of PROFILES) {
      const config = { version: 1, defaultProfile: profile, houseStyle: { allowCurlyQuotes: true } }
      expect(conforms(config, configSchema)).toBe(true)
      expect(parseConfig(JSON.stringify(config)).defaultProfile).toBe(profile)
    }
    for (const rule of RULES) for (const severity of SEVERITIES) {
      const config = { version: 1, disabledRules: [rule.id], severityOverrides: { [rule.id]: severity } }
      expect(conforms(config, configSchema)).toBe(true)
      expect(() => parseConfig(JSON.stringify(config))).not.toThrow()
    }
    const invalid = [{}, { version: 2 }, { version: 1, unknown: true }, { version: 1, disabledRules: ["unknown-rule"] },
      { version: 1, defaultProfile: "unknown" }, { version: 1, houseStyle: { emDashWordsPerOccurrence: 0 } },
      { version: 1, protectedSections: [" "] }, { version: 1, severityOverrides: { "heading-skip": "urgent" } }]
    for (const config of invalid) {
      expect(conforms(config, configSchema)).toBe(false)
      expect(() => parseConfig(JSON.stringify(config))).toThrow()
    }
  })
})
