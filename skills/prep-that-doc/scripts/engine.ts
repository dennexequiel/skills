import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { PROFILE_SECTIONS, isRiskBearing } from "./policy.ts"
import { RULES, RULE_BY_ID } from "./registry.ts"
import { inlineLinks, locationReader, parseMarkdownRegions, protectedSectionLines } from "./regions.ts"
import { type DocumentResult, type Finding, type PrepdocConfig, type ResolvedProfile, type Rule, type ScanResult, SCHEMA_VERSION, RULESET_VERSION } from "./types.ts"

const EXCERPT_LENGTH = 96
const EXTERNAL_TARGET = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i
const REFERENCE = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm
const REFERENCE_LINK = /!?\[([^\]]+)\]\[([^\]]*)\]/g

export type ScanDocumentOptions = {
  file: string
  absoluteFile?: string
  source: string
  profile: ResolvedProfile
  config: PrepdocConfig
}

function clip(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ")
  return trimmed.length <= EXCERPT_LENGTH ? trimmed : `${trimmed.slice(0, EXCERPT_LENGTH - 3)}...`
}

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase()
}

function fingerprint(file: string, rule: string, evidence: string, occurrence: number): string {
  return createHash("sha256").update(`${file}\u0000${rule}\u0000${normalized(evidence)}\u0000${occurrence}`).digest("hex").slice(0, 16)
}

function applies(rule: Rule, profile: ResolvedProfile): boolean {
  return rule.profiles === "all" || rule.profiles.includes(profile)
}

function maskTerminology(text: string, accepted: readonly string[]): string {
  const chars = text.split("")
  for (const term of ["WCAG Essential", ...accepted]) {
    if (!term) continue
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu")
    for (const match of text.matchAll(pattern)) {
      const start = match.index
      if (start === undefined) continue
      const end = start + match[0].length
      if (/[\p{L}\p{N}_]/u.test(text[start - 1] ?? "") || /[\p{L}\p{N}_]/u.test(text[end] ?? "")) continue
      for (let index = start; index < end; index += 1) if (chars[index] !== "\n") chars[index] = " "
    }
  }
  return chars.join("")
}

function localTarget(raw: string, directory: string): string | undefined {
  const target = raw.replace(/^<|>$/g, "").replace(/\\([\\()[\]<> ])/g, "$1")
  if (!target || EXTERNAL_TARGET.test(target)) return undefined
  const pathname = target.split(/[?#]/, 1)[0] ?? ""
  if (!pathname) return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    decoded = pathname
  }
  return existsSync(resolve(directory, decoded)) ? undefined : decoded
}

function linkTargets(source: string): Array<{ index: number; target: string }> {
  const references = new Map<string, string>()
  for (const match of source.matchAll(REFERENCE)) {
    const label = match[1]?.trim().toLowerCase()
    const target = match[2] ?? match[3]
    if (label && target && !/^[\^@]/.test(label)) references.set(label, target)
  }
  const targets: Array<{ index: number; target: string }> = []
  for (const link of inlineLinks(source)) targets.push({ index: link.start, target: link.target })
  for (const match of source.matchAll(REFERENCE_LINK)) {
    const target = references.get((match[2] || match[1] || "").trim().toLowerCase())
    if (target && match.index !== undefined) targets.push({ index: match.index, target })
  }
  for (const match of source.matchAll(/!?\[([^\]]+)\](?![\[(]|:)/g)) {
    const target = references.get((match[1] ?? "").trim().toLowerCase())
    if (target && match.index !== undefined && source[match.index - 1] !== "]") targets.push({ index: match.index, target })
  }
  return targets
}

function sourceOffsetForLine(source: string, line: number): number {
  let offset = 0
  for (let current = 1; current < line; current += 1) {
    const next = source.indexOf("\n", offset)
    if (next === -1) return source.length
    offset = next + 1
  }
  return offset
}

function findRule(id: string): Rule {
  const rule = RULE_BY_ID.get(id)
  if (!rule) throw new Error(`Unknown registered rule ${id}.`)
  return rule
}

export function scanDocument(options: ScanDocumentOptions): DocumentResult {
  const { source, file, profile, config } = options
  const regions = parseMarkdownRegions(source)
  if (regions.generatedReason) return { file, profile, skipped: { reason: regions.generatedReason }, findings: [] }
  const protectedLines = protectedSectionLines(regions.headings, source.split(/\n/).length, config.protectedSections)
  const locate = locationReader(source)
  const results: Finding[] = []
  const occurrences = new Map<string, number>()
  const add = (rule: Rule, offset: number, evidence: string): void => {
    if (!applies(rule, profile) || config.disabledRules.includes(rule.id)) return
    const location = locate(offset)
    if (protectedLines.has(location.line)) return
    const countKey = `${rule.id}\u0000${normalized(evidence)}`
    const occurrence = occurrences.get(countKey) ?? 0
    occurrences.set(countKey, occurrence + 1)
    const heading = regions.headings.findLast((item) => item.start <= offset)
    results.push({
      fingerprint: fingerprint(file, rule.id, evidence, occurrence),
      rule: rule.id,
      category: rule.category,
      severity: config.severityOverrides[rule.id] ?? rule.severity,
      confidence: rule.confidence,
      file,
      location,
      evidence: clip(evidence),
      action: rule.action,
      autofix: rule.autofix,
      profile,
      section: { line: heading?.line ?? 0, heading: heading?.title ?? "(before the first heading)" },
    })
  }

  if (regions.unclosedFrontmatter) add(findRule("frontmatter-unclosed"), 0, regions.unclosedFrontmatter.text)
  if (regions.unclosedFence) add(findRule("fence-unclosed"), sourceOffsetForLine(source, regions.unclosedFence.line), regions.unclosedFence.text)

  for (const fence of regions.fences) {
    if (!fence.info) add(findRule("fence-nolang"), sourceOffsetForLine(source, fence.line), fence.text)
  }

  let previousDepth = 0
  let roots = 0
  for (const heading of regions.headings) {
    if (protectedLines.has(heading.line)) continue
    if ((previousDepth && heading.depth > previousDepth + 1) || (!previousDepth && heading.depth > (profile === "pr" ? 2 : 1))) {
      add(findRule("heading-skip"), heading.start, source.slice(heading.start, heading.end))
    }
    if (heading.depth === 1) {
      roots += 1
      if (roots > 1) add(findRule("heading-one"), heading.start, source.slice(heading.start, heading.end))
    }
    previousDepth = heading.depth
  }
  for (const table of regions.tables) {
    if (table.columns < 2 || table.rows < 1) add(findRule("table-underfit"), sourceOffsetForLine(source, table.line), table.text)
  }
  const directory = dirname(options.absoluteFile ?? file)
  for (const link of linkTargets(regions.linkSource)) {
    const target = localTarget(link.target, directory)
    if (target) add(findRule("link-dead"), link.index, target)
  }

  const present = new Set(regions.headings.map((heading) => heading.title.trim().toLowerCase()))
  for (const aliases of PROFILE_SECTIONS[profile]) {
    if (!aliases.some((alias) => present.has(alias.toLowerCase()))) add(findRule("section-missing"), 0, aliases.join(" / "))
  }

  const riskBearing = isRiskBearing(file, source, profile)
  const prose = regions.prose.split("\n").map((line, index) => protectedLines.has(index + 1) ? " ".repeat(line.length) : line).join("\n")
  const terminologyMasked = maskTerminology(prose, config.acceptedTerminology)
  for (const rule of RULES) {
    if (!rule.detect || !applies(rule, profile)) continue
    if (rule.id === "tell-curly" && config.houseStyle.allowCurlyQuotes) continue
    if (riskBearing && rule.id === "tell-hedge") continue
    for (const match of rule.detect(terminologyMasked)) {
      add(rule, match.index, match.text)
    }
  }
  const dashes = [...prose.matchAll(/—/g)]
  const words = [...prose.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)].length
  if (dashes.length >= 2 && dashes.length * config.houseStyle.emDashWordsPerOccurrence > words) add(findRule("tell-emdash"), dashes[0]?.index ?? 0, `${dashes.length} em dashes in ${words} prose words`)

  results.sort((left, right) => left.location.line - right.location.line || left.location.column - right.location.column || left.rule.localeCompare(right.rule) || left.fingerprint.localeCompare(right.fingerprint))
  return { file, profile, findings: results }
}

export function buildResult(documents: DocumentResult[]): ScanResult {
  const profiles = new Set(documents.map((document) => document.profile))
  const summary = { structural: 0, factualGap: 0, stylistic: 0 }
  for (const document of documents) for (const finding of document.findings) summary[finding.category] += 1
  return { schemaVersion: SCHEMA_VERSION, rulesetVersion: RULESET_VERSION, profile: profiles.size <= 1 ? documents[0]?.profile ?? "generic" : "mixed", documents, findings: documents.flatMap((document) => document.findings), summary }
}

export function visibleFindings(result: ScanResult, strict: boolean): Finding[] {
  return result.documents.flatMap((document) => document.findings).filter((finding) => strict || finding.severity !== "LOW")
}
