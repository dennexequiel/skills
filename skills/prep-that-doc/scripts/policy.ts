import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseMarkdownRegions } from "./regions.ts"
import { RULE_BY_ID } from "./registry.ts"
import { PROFILES, SEVERITIES, type PrepdocConfig, type Profile, type ResolvedProfile, type Severity } from "./types.ts"

export const DEFAULT_CONFIG: PrepdocConfig = {
  version: 1,
  defaultProfile: "auto",
  acceptedTerminology: [],
  protectedSections: [],
  disabledRules: [],
  severityOverrides: {},
  houseStyle: { allowCurlyQuotes: false, emDashWordsPerOccurrence: 150 },
}

export const PROFILE_SECTIONS: Readonly<Record<ResolvedProfile, readonly (readonly string[])[]>> = {
  generic: [],
  pr: [["Summary", "Overview", "Changes", "Purpose"], ["Testing", "Tests", "Validation", "Verification"]],
  readme: [["Install", "Installation", "Quickstart", "Getting started"], ["Use", "Usage", "Quickstart", "Examples"]],
  adr: [["Context", "Status"], ["Decision", "Consequences"]],
  runbook: [["Procedure", "Steps", "Runbook"], ["Rollback", "Recovery"]],
  cutover: [["Rollback", "Backout"], ["Validation", "Verify"]],
  spec: [["Requirements", "Scope"]],
  design: [["Overview", "Context"]],
  changelog: [],
  incident: [["Impact"], ["Timeline"]],
  "api-reference": [["API", "Reference", "Endpoints", "Methods", "Parameters", "Usage"]],
  migration: [["Migration", "Plan", "Approach"], ["Rollback", "Recovery", "Backout"]],
  security: [["Risk", "Threat", "Security"], ["Mitigation", "Controls", "Recovery"]],
  "risk-assessment": [["Risk", "Assessment", "Threats"], ["Mitigation", "Controls", "Recovery"]],
}

const PROFILE_MARKERS: ReadonlyArray<readonly [ResolvedProfile, RegExp]> = [
  ["changelog", /(?:^|\/|\\)changelog\.md$/i],
  ["readme", /(?:^|\/|\\)readme\.(?:md|markdown|mdx)$/i],
  ["adr", /(?:^|\/|\\)(?:adr-\d+|adr[\/_\\])/i],
  ["pr", /(?:^|\/|\\)(?:pr|pull[_ -]?request)(?:[_ -].*)?\.(?:md|markdown|mdx)$/i],
  ["migration", /migration/i],
  ["security", /security|threat[_ -]?model/i],
  ["risk-assessment", /risk[_ -]?assessment/i],
  ["api-reference", /api[-_ ]?(?:reference|docs?)/i],
  ["runbook", /runbook|operations?[_ -]?manual/i],
  ["cutover", /cutover|go[-_ ]?live/i],
  ["incident", /incident|postmortem|post-mortem/i],
  ["spec", /specification|(?:^|[-_\/\\ ])spec(?:[-_.\/\\ ]|$)/i],
  ["design", /design(?:[_ -]?(?:doc|proposal))?/i],
]
const RISK_MARKER = /migration|migrat(?:e|ion)|security|risk assessment|threat model|cutover|runbook|incident/i

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasUnsafeKey(value: unknown): boolean {
  if (!isRecord(value)) return Array.isArray(value) && value.some(hasUnsafeKey)
  return Object.entries(value).some(([key, item]) => key === "__proto__" || key === "prototype" || key === "constructor" || hasUnsafeKey(item))
}

function stringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new ConfigError(`.prepdocrc ${key} must be an array of non-empty strings.`)
  return [...value]
}

function profile(value: unknown, key: string): Profile {
  if (typeof value !== "string" || !PROFILES.includes(value as Profile)) throw new ConfigError(`.prepdocrc ${key} must be one of: ${PROFILES.join(", ")}.`)
  return value as Profile
}

function severity(value: unknown, key: string): Severity {
  if (typeof value !== "string" || !SEVERITIES.includes(value as Severity)) throw new ConfigError(`.prepdocrc ${key} must be one of: ${SEVERITIES.join(", ")}.`)
  return value as Severity
}

type PartialHouseStyle = Partial<PrepdocConfig["houseStyle"]>
type ParsedConfig = Omit<Partial<PrepdocConfig>, "houseStyle"> & { houseStyle?: PartialHouseStyle }

export function parseConfig(source: string, file = ".prepdocrc"): ParsedConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new ConfigError(`Cannot parse ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(parsed) || hasUnsafeKey(parsed)) throw new ConfigError(`${file} must be a JSON object without prototype keys.`)
  const allowed = new Set(["version", "defaultProfile", "acceptedTerminology", "protectedSections", "disabledRules", "severityOverrides", "houseStyle"])
  for (const key of Object.keys(parsed)) if (!allowed.has(key)) throw new ConfigError(`${file} has unknown key ${key}.`)
  if (parsed.version !== 1) throw new ConfigError(`${file} version must be 1.`)
  const result: ParsedConfig = { version: 1 }
  if ("defaultProfile" in parsed) result.defaultProfile = profile(parsed.defaultProfile, "defaultProfile")
  if ("acceptedTerminology" in parsed) result.acceptedTerminology = stringArray(parsed.acceptedTerminology, "acceptedTerminology")
  if ("protectedSections" in parsed) result.protectedSections = stringArray(parsed.protectedSections, "protectedSections")
  if ("disabledRules" in parsed) {
    result.disabledRules = stringArray(parsed.disabledRules, "disabledRules")
    for (const id of result.disabledRules) if (!RULE_BY_ID.has(id)) throw new ConfigError(`${file} disabledRules contains unknown rule ${id}.`)
  }
  if ("severityOverrides" in parsed) {
    if (!isRecord(parsed.severityOverrides)) throw new ConfigError(`${file} severityOverrides must be an object.`)
    result.severityOverrides = {}
    for (const [id, value] of Object.entries(parsed.severityOverrides)) {
      if (!RULE_BY_ID.has(id)) throw new ConfigError(`${file} severityOverrides contains unknown rule ${id}.`)
      result.severityOverrides[id] = severity(value, `severityOverrides.${id}`)
    }
  }
  if ("houseStyle" in parsed) {
    if (!isRecord(parsed.houseStyle) || hasUnsafeKey(parsed.houseStyle)) throw new ConfigError(`${file} houseStyle must be an object.`)
    const houseAllowed = new Set(["allowCurlyQuotes", "emDashWordsPerOccurrence"])
    for (const key of Object.keys(parsed.houseStyle)) if (!houseAllowed.has(key)) throw new ConfigError(`${file} houseStyle has unknown key ${key}.`)
    const house: PartialHouseStyle = {}
    if ("allowCurlyQuotes" in parsed.houseStyle) {
      if (typeof parsed.houseStyle.allowCurlyQuotes !== "boolean") throw new ConfigError(`${file} houseStyle.allowCurlyQuotes must be boolean.`)
      house.allowCurlyQuotes = parsed.houseStyle.allowCurlyQuotes
    }
    if ("emDashWordsPerOccurrence" in parsed.houseStyle) {
      const value = parsed.houseStyle.emDashWordsPerOccurrence
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10_000) throw new ConfigError(`${file} houseStyle.emDashWordsPerOccurrence must be an integer from 1 to 10000.`)
      house.emDashWordsPerOccurrence = value
    }
    result.houseStyle = house
  }
  return result
}

export function mergeConfig(base: PrepdocConfig, override: ParsedConfig): PrepdocConfig {
  return {
    ...base,
    ...override,
    acceptedTerminology: [...(override.acceptedTerminology ?? base.acceptedTerminology)],
    protectedSections: [...(override.protectedSections ?? base.protectedSections)],
    disabledRules: [...(override.disabledRules ?? base.disabledRules)],
    severityOverrides: { ...base.severityOverrides, ...override.severityOverrides },
    houseStyle: { ...base.houseStyle, ...override.houseStyle },
  }
}

export function findConfig(cwd: string, repositoryRoot?: string, explicit?: string): PrepdocConfig {
  const target = explicit ? resolve(cwd, explicit) : findNearestConfig(cwd, repositoryRoot)
  if (!target) return mergeConfig(DEFAULT_CONFIG, {})
  if (!existsSync(target)) throw new ConfigError(`Cannot read configuration ${target}.`)
  let source: string
  try {
    source = readFileSync(target, "utf8")
  } catch (error) {
    throw new ConfigError(`Cannot read configuration ${target}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return mergeConfig(DEFAULT_CONFIG, parseConfig(source, target))
}

function findNearestConfig(cwd: string, repositoryRoot?: string): string | undefined {
  let directory = resolve(cwd)
  const boundary = repositoryRoot ? resolve(repositoryRoot) : undefined
  for (;;) {
    const candidate = join(directory, ".prepdocrc")
    if (existsSync(candidate)) return candidate
    if (boundary && directory === boundary) return undefined
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

export function inferProfile(file: string, source: string, requested: Profile, configured: Profile): ResolvedProfile {
  const selected = requested !== "auto" ? requested : configured
  if (selected !== "auto") return selected
  for (const [candidate, marker] of PROFILE_MARKERS) if (marker.test(file)) return candidate
  const heading = parseMarkdownRegions(source).headings[0]?.title ?? ""
  const headingMarkers: ReadonlyArray<readonly [ResolvedProfile, RegExp]> = [
    ["pr", /^(?:pull request|pr)\b/i], ["migration", /^migration\b/i], ["security", /^(?:security|threat model)\b/i],
    ["risk-assessment", /^risk assessment\b/i], ["api-reference", /^api (?:reference|docs?)\b/i], ["runbook", /^runbook\b/i],
    ["cutover", /^(?:cutover|go-live)\b/i], ["incident", /^(?:incident|postmortem)\b/i], ["adr", /^adr\b|^architecture decision\b/i],
    ["spec", /^(?:specification|spec)\b/i], ["design", /^design\b/i],
  ]
  for (const [candidate, marker] of headingMarkers) if (marker.test(heading)) return candidate
  return "generic"
}

export function isRiskBearing(file: string, source: string, profileName: ResolvedProfile): boolean {
  return profileName === "runbook" || profileName === "cutover" || profileName === "incident" || RISK_MARKER.test(`${file}\n${source.slice(0, 4_000)}`)
}
