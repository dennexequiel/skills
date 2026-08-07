import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

type Severity = "HIGH" | "MED" | "LOW"

type LineRule = {
  id: string
  severity: Severity
  pattern: RegExp
}

type Finding = {
  file: string
  line: number
  id: string
  severity: Severity
  text: string
}

const LINE_RULES: LineRule[] = [
  { id: "tell-notxbuty", severity: "HIGH", pattern: /\b(?:is not|isn't|are not|aren't|not just|not only|it's not)\b[^.!?]{2,60}?\b(?:but|rather|it's|it is)\b/i },
  { id: "tell-significance", severity: "HIGH", pattern: /\b(?:crucial|vital|essential|pivotal|key|critical|robust|seamless|powerful|comprehensive|cutting-edge|revolutioniz\w*|game.?chang\w*|landscape|testament|delve)\b/i },
  { id: "tell-vague-number", severity: "HIGH", pattern: /\b(?:quickly|slowly|significantly|substantially|dramatically)\b/i },
  { id: "tell-weasel", severity: "MED", pattern: /\b(?:studies show|research suggests|experts (?:say|agree)|it is (?:widely )?(?:known|believed|understood)|generally considered|some argue)\b/i },
  { id: "tell-history", severity: "MED", pattern: /\b(?:previously|used to|no longer|now (?:does|uses|reads|returns)|we (?:removed|changed|renamed)|has been (?:updated|changed|moved))\b/i },
  { id: "tell-hedge", severity: "MED", pattern: /\b(?:it's worth noting|it should be noted|arguably|somewhat|fairly|relatively|might potentially|could possibly|in general|typically)\b/i },
  { id: "tell-filler", severity: "MED", pattern: /\b(?:in order to|due to the fact that|at this point in time|it is important to|when it comes to|in today's|in the world of)\b/i },
  { id: "tell-emdash", severity: "MED", pattern: /[—–]/ },
  { id: "tell-conclusion", severity: "LOW", pattern: /\b(?:in conclusion|to sum up|ultimately|at the end of the day|overall,)/i },
  { id: "tell-signpost", severity: "LOW", pattern: /\b(?:in this section|as mentioned above|let's dive in|we will cover)\b/i },
  { id: "tell-curly", severity: "LOW", pattern: /[‘’“”]/ },
  { id: "link-here", severity: "LOW", pattern: /\[(?:here|this|this doc|link|read more|click here)\]\(/i },
]

const FRONTMATTER_DELIMITER = "---"
const HEADING = /^(#{1,6})\s+\S/
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER = /^\s*\|[\s:|-]*\|\s*$/
const SHELL_PROMPT = /^\s*\$\s+\S/
const WORD = /[A-Za-z0-9][A-Za-z0-9'-]*/g
const MARKDOWN_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g
const ABSOLUTE_TARGET = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i
const PASTEABLE_FENCE = /^(?:console|text|output)\b/i

const ROOT_HEADING_DEPTH = 1
const MINIMUM_TABLE_COLUMNS = 2
const MINIMUM_TABLE_ROWS = 2
const EXCERPT_LENGTH = 100
const EXCERPT_CONTEXT = 20

const ORDER: Record<Severity, number> = { HIGH: 0, MED: 1, LOW: 2 }
const WEIGHTS: Record<Severity, number> = { HIGH: 5, MED: 2, LOW: 1 }
const BANDS: Array<{ limit: number; label: string }> = [
  { limit: 0, label: "clean" },
  { limit: 10, label: "light" },
  { limit: 25, label: "rough" },
  { limit: 50, label: "heavy" },
  { limit: Infinity, label: "severe" },
]

// Below this, one finding swings density far enough to read as a verdict it cannot support.
const DENSITY_FLOOR_WORDS = 300

// Local targets only. Resolving a URL would mean network access the skill never promises.
function unresolvedTarget(rawTarget: string, directory: string): string | undefined {
  if (!rawTarget || ABSOLUTE_TARGET.test(rawTarget)) return undefined
  const [path] = rawTarget.replace(/^<|>$/g, "").split("#")
  if (!path) return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return path
  }
  return existsSync(resolve(directory, decoded)) ? undefined : decoded
}

type OpenTable = {
  line: number
  text: string
  columns: number
  rows: number
}

type OpenFence = {
  line: number
  marker: string
  length: number
  pasteable: boolean
}

type ScanResult = {
  findings: Finding[]
  words: number
}

// Windows a long line around the match so the excerpt carries the evidence, not just the first
// hundred characters of an unrelated sentence.
function excerpt(text: string, matchIndex: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed
  const lead = text.length - text.trimStart().length
  const start = Math.min(Math.max(matchIndex - lead - EXCERPT_CONTEXT, 0), trimmed.length - EXCERPT_LENGTH)
  const windowed = trimmed.slice(start, start + EXCERPT_LENGTH)
  return start ? `...${windowed}` : windowed
}

function scan(file: string, source: string): ScanResult {
  const directory = dirname(file)
  const lines = source.split(/\r?\n/)
  const findings: Finding[] = []
  let words = 0

  const add = (line: number, id: string, severity: Severity, text: string, matchIndex = 0) => {
    findings.push({ file, line, id, severity, text: excerpt(text, matchIndex) })
  }
  const flushTable = (table: OpenTable) => {
    if (table.columns < MINIMUM_TABLE_COLUMNS || table.rows < MINIMUM_TABLE_ROWS) {
      add(table.line, "element-table", "MED", table.text)
    }
  }

  let inFrontmatter = lines[0] === FRONTMATTER_DELIMITER
  let frontmatterClosed = !inFrontmatter
  let openFence: OpenFence | undefined
  let openTable: OpenTable | undefined
  let previousDepth = 0
  let rootHeadings = 0

  for (const [index, line] of lines.entries()) {
    const number = index + 1
    if (inFrontmatter) {
      if (number > 1 && line === FRONTMATTER_DELIMITER) {
        inFrontmatter = false
        frontmatterClosed = true
      }
      continue
    }

    const fence = line.match(FENCE)
    const marker = fence?.[1]
    const info = (fence?.[2] ?? "").trim()
    if (marker) {
      // A fence closes only on its own marker, at least as long as the one that opened it, so a
      // nested block of the other kind stays content instead of ending the outer one.
      if (openFence) {
        if (marker.charAt(0) === openFence.marker && marker.length >= openFence.length && !info) {
          openFence = undefined
          continue
        }
      } else {
        if (!info) add(number, "fence-nolang", "MED", line)
        openFence = {
          line: number,
          marker: marker.charAt(0),
          length: marker.length,
          pasteable: !PASTEABLE_FENCE.test(info),
        }
        continue
      }
    }
    if (openFence) {
      if (openFence.pasteable && SHELL_PROMPT.test(line)) add(number, "fence-prompt", "MED", line)
      continue
    }
    words += line.match(WORD)?.length ?? 0

    const heading = line.match(HEADING)
    if (heading?.[1]) {
      const depth = heading[1].length
      if (previousDepth && depth > previousDepth + 1) add(number, "heading-skip", "MED", line)
      if (!previousDepth && depth > ROOT_HEADING_DEPTH) add(number, "heading-skip", "MED", line)
      if (depth === ROOT_HEADING_DEPTH) {
        rootHeadings += 1
        if (rootHeadings > 1) add(number, "heading-one", "MED", line)
      }
      previousDepth = depth
    }

    if (TABLE_ROW.test(line)) {
      const isDivider = TABLE_DIVIDER.test(line)
      const columns = isDivider ? 0 : line.split("|").slice(1, -1).length
      const contentRows = isDivider ? 0 : 1
      openTable = openTable
        ? { ...openTable, columns: Math.max(openTable.columns, columns), rows: openTable.rows + contentRows }
        : { line: number, text: line, columns, rows: contentRows }
    } else if (openTable) {
      flushTable(openTable)
      openTable = undefined
    }

    for (const rule of LINE_RULES) {
      const match = rule.pattern.exec(line)
      if (match) add(number, rule.id, rule.severity, line, match.index)
    }

    for (const link of line.matchAll(MARKDOWN_LINK)) {
      const target = unresolvedTarget(link[1] ?? "", directory)
      if (target) add(number, "link-dead", "HIGH", `${target} (from ${link[0]})`)
    }
  }

  // An unterminated region hides every line after it, so a silent scan would read as a clean one.
  if (openTable) flushTable(openTable)
  if (openFence) add(openFence.line, "fence-unclosed", "HIGH", lines[openFence.line - 1] ?? "")
  if (!frontmatterClosed) add(1, "frontmatter-unclosed", "HIGH", lines[0] ?? "")

  return { findings, words }
}

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error("Usage: bun scan.ts <file.md> [more.md ...]   (node scan.ts also works)")
  process.exit(2)
}

const SEVERITIES = ["HIGH", "MED", "LOW"] as const
const WEIGHTING = "5/2/1 per HIGH/MED/LOW"

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function tally(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { HIGH: 0, MED: 0, LOW: 0 }
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

function scoreLine(findings: Finding[], words: number): string {
  const points = findings.reduce((total, finding) => total + WEIGHTS[finding.severity], 0)
  if (words < DENSITY_FLOOR_WORDS) {
    return `Provisional score: ${points} points (${WEIGHTING}). `
      + `Density withheld below ${DENSITY_FLOOR_WORDS} words, where a few findings distort it.`
  }
  const density = (points * 1000) / words
  const band = BANDS.find(({ limit }) => density <= limit)
  if (!band) throw new Error(`No band covers a density of ${density} in ${plural(words, "word")}`)
  return `Provisional score: ${density.toFixed(1)} points per 1000 words, `
    + `band ${band.label} (${points} points, ${WEIGHTING}).`
}

const findings: Finding[] = []
let words = 0
for (const path of paths) {
  let source: string
  try {
    source = await readFile(path, "utf8")
  } catch (error) {
    console.error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
  const result = scan(path, source)
  // Sort per file so a multi-file scan never interleaves lines from different files.
  result.findings.sort((left, right) => ORDER[left.severity] - ORDER[right.severity] || left.line - right.line)
  findings.push(...result.findings)
  words += result.words
}

for (const finding of findings) {
  console.log(`${finding.file}:${finding.line} [${finding.severity}] ${finding.id}  ${finding.text}`)
}

const counts = tally(findings)
const breakdown = SEVERITIES.map((severity) => `${counts[severity]} ${severity}`).join(", ")

console.log(`\nScanned ${plural(paths.length, "file")}, ${words} words. ${plural(findings.length, "candidate")}: ${breakdown}.`)
console.log(scoreLine(findings, words))
console.log("Provisional because it counts unclassified candidates. Score after classification, not from this number.")
