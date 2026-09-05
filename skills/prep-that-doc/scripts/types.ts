export const SCHEMA_VERSION = "1" as const
export const RULESET_VERSION = "1" as const

export const SEVERITIES = ["HIGH", "MED", "LOW"] as const
export type Severity = (typeof SEVERITIES)[number]
export const CONFIDENCES = ["certain", "likely", "contextual"] as const
export type Confidence = (typeof CONFIDENCES)[number]
export const CATEGORIES = ["structural", "factualGap", "stylistic"] as const
export type Category = (typeof CATEGORIES)[number]
export const AUTOFIXES = ["safe", "review", "never"] as const
export type Autofix = (typeof AUTOFIXES)[number]

export const PROFILES = ["auto", "generic", "pr", "readme", "adr", "runbook", "cutover", "spec", "design", "changelog", "incident", "api-reference", "migration", "security", "risk-assessment"] as const
export type Profile = (typeof PROFILES)[number]
export type ResolvedProfile = Exclude<Profile, "auto">

export type Location = { line: number; column: number }

export type Finding = {
  fingerprint: string
  rule: string
  category: Category
  severity: Severity
  confidence: Confidence
  file: string
  location: Location
  evidence: string
  action: string
  autofix: Autofix
  profile: ResolvedProfile
  section: { line: number; heading: string }
}

export type Summary = Record<Category, number>

export type DocumentResult = {
  file: string
  profile: ResolvedProfile
  skipped?: { reason: string }
  findings: Finding[]
}

export type ScanResult = {
  schemaVersion: typeof SCHEMA_VERSION
  rulesetVersion: typeof RULESET_VERSION
  profile: ResolvedProfile | "mixed"
  documents: DocumentResult[]
  findings: Finding[]
  summary: Summary
}

export type HouseStyle = {
  allowCurlyQuotes: boolean
  emDashWordsPerOccurrence: number
}

export type PrepdocConfig = {
  version: 1
  defaultProfile: Profile
  acceptedTerminology: string[]
  protectedSections: string[]
  disabledRules: string[]
  severityOverrides: Partial<Record<string, Severity>>
  houseStyle: HouseStyle
}

export type RuleMatch = { index: number; text: string }

export type Rule = {
  id: string
  category: Category
  description: string
  detection: string
  severity: Severity
  confidence: Confidence
  profiles: readonly ResolvedProfile[] | "all"
  action: string
  autofix: Autofix
  detect?: ((text: string) => Iterable<RuleMatch>) & { expression: string }
}
