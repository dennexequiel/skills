import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"

type Severity = "HIGH" | "MED" | "LOW"

type LineRule = {
  id: string
  severity: Severity
  pattern: RegExp
}

type Section = {
  index: number
  heading: string
}

type Finding = {
  file: string
  line: number
  id: string
  severity: Severity
  text: string
  section: Section
}

const LINE_RULES: LineRule[] = [
  { id: "tell-notxbuty", severity: "HIGH", pattern: /\b(?:is not|isn't|are not|aren't|not just|not only|it's not)\b[^.!?]{2,60}?\b(?:but|rather|it's|it is)\b/i },
  // "key" only in its importance sense. Bare `key` matches SSH keys, API keys, primary keys, and
  // keyboard keys, which are the common nouns of the documents this skill is pointed at.
  { id: "tell-significance", severity: "HIGH", pattern: /\b(?:crucial|vital|essential|pivotal|critical|robust|seamless|powerful|comprehensive|cutting-edge|revolutioniz\w*|game.?chang\w*|landscape|testament|delve|key (?:insight|benefit|takeaway|point|factor|advantage|difference|challenge|step))\b/i },
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
const MARKDOWN_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g
const ABSOLUTE_TARGET = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i
const PASTEABLE_FENCE = /^(?:console|text|output)\b/i

const ROOT_HEADING_DEPTH = 1
const MINIMUM_TABLE_COLUMNS = 2
const MINIMUM_TABLE_ROWS = 2
const EXCERPT_LENGTH = 56
const PREAMBLE = { index: 0, heading: "(before the first heading)" } as const

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
  section: Section
}

type OpenFence = {
  line: number
  marker: string
  length: number
  pasteable: boolean
  section: Section
}

function clip(text: string): string {
  const trimmed = text.trim()
  return trimmed.length <= EXCERPT_LENGTH ? trimmed : `${trimmed.slice(0, EXCERPT_LENGTH)}...`
}

function scan(file: string, source: string): Finding[] {
  const directory = dirname(file)
  const lines = source.split(/\r?\n/)
  const findings: Finding[] = []
  let section: Section = PREAMBLE

  const add = (line: number, id: string, severity: Severity, text: string, at = section) => {
    findings.push({ file, line, id, severity, text: clip(text), section: at })
  }
  const flushTable = (table: OpenTable) => {
    if (table.columns < MINIMUM_TABLE_COLUMNS || table.rows < MINIMUM_TABLE_ROWS) {
      add(table.line, "element-table", "MED", table.text, table.section)
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
          section,
        }
        continue
      }
    }
    if (openFence) {
      if (openFence.pasteable && SHELL_PROMPT.test(line)) add(number, "fence-prompt", "MED", line)
      continue
    }

    const heading = line.match(HEADING)
    if (heading?.[1]) {
      const depth = heading[1].length
      // Open the section before the heading's own checks run, so a flagged heading is reported
      // under itself rather than under the section it ends.
      section = { index: section.index + 1, heading: clip(line) }
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
        : { line: number, text: line, columns, rows: contentRows, section }
    } else if (openTable) {
      flushTable(openTable)
      openTable = undefined
    }

    for (const rule of LINE_RULES) {
      const match = rule.pattern.exec(line)
      if (match?.[0]) add(number, rule.id, rule.severity, match[0])
    }

    for (const link of line.matchAll(MARKDOWN_LINK)) {
      const target = unresolvedTarget(link[1] ?? "", directory)
      if (target) add(number, "link-dead", "HIGH", target)
    }
  }

  // An unterminated region hides every line after it, so a silent scan would read as a clean one.
  if (openTable) flushTable(openTable)
  if (openFence) add(openFence.line, "fence-unclosed", "HIGH", lines[openFence.line - 1] ?? "", openFence.section)
  if (!frontmatterClosed) add(1, "frontmatter-unclosed", "HIGH", lines[0] ?? "", PREAMBLE)

  return findings
}

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error("Usage: bun scan.ts <file.md> [more.md ...]   (node scan.ts also works)")
  process.exit(2)
}

const SEVERITIES = ["HIGH", "MED", "LOW"] as const

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function tally(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { HIGH: 0, MED: 0, LOW: 0 }
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

// `blocked` is missing on purpose. It depends on which findings need a fact only the author holds,
// and nothing here can tell that apart from a finding that is simply wrong.
function verdict(findings: Finding[]): string {
  if (findings.some(({ severity }) => severity === "HIGH")) return "rework"
  return findings.length ? "minor" : "clean"
}

// Relative when the file sits under the working directory, so a repository path prints as the
// author types it rather than as a home-directory prefix repeated on every row.
function label(path: string): string {
  const short = relative(process.cwd(), path)
  return short && !short.startsWith("..") ? short : path
}

// Document order, not severity order. The author navigates by section, and the report the agent
// writes from this output is where triage happens.
function report(file: string, found: Finding[]): void {
  console.log(`\n${label(file)}`)
  if (!found.length) {
    console.log("  no candidates")
    return
  }
  const width = Math.max(...found.map(({ id }) => id.length))
  const sections = [...new Map(found.map((finding) => [finding.section.index, finding.section])).values()]
    .sort((left, right) => left.index - right.index)
  for (const { index, heading } of sections) {
    console.log(`  ${heading}`)
    for (const finding of found.filter(({ section }) => section.index === index).sort((left, right) => left.line - right.line)) {
      console.log(`    ${String(finding.line).padStart(4)}  ${finding.severity.padEnd(4)}  ${finding.id.padEnd(width)}  ${finding.text}`)
    }
  }
}

const findings: Finding[] = []
for (const path of paths) {
  let source: string
  try {
    source = await readFile(path, "utf8")
  } catch (error) {
    console.error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
  const found = scan(path, source)
  report(path, found)
  findings.push(...found)
}

const counts = tally(findings)
const breakdown = SEVERITIES.filter((severity) => counts[severity]).map((severity) => `${counts[severity]} ${severity}`)

console.log(`\n${plural(paths.length, "file")}, ${plural(findings.length, "candidate")}${breakdown.length ? `: ${breakdown.join(", ")}` : ""}.`)
console.log(`Provisional verdict: ${verdict(findings)}. Classify first: false positives count here, and the findings only a reader can see do not.`)
