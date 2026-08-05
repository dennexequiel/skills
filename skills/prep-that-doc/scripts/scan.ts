import { readFile } from "node:fs/promises"

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
  { id: "tell-significance", severity: "HIGH", pattern: /\b(?:crucial|vital|essential|pivotal|robust|seamless|powerful|comprehensive|cutting-edge|revolutioniz\w*|game-chang\w*|landscape|testament|delve)\b/i },
  { id: "tell-vague-number", severity: "HIGH", pattern: /\b(?:quickly|slowly|significantly|substantially|dramatically)\b/i },
  { id: "tell-weasel", severity: "MED", pattern: /\b(?:studies show|research suggests|experts (?:say|agree)|it is (?:widely )?(?:known|believed)|generally considered)\b/i },
  { id: "tell-history", severity: "MED", pattern: /\b(?:previously|used to|no longer|now (?:does|uses|reads|returns)|we (?:removed|changed|renamed)|has been (?:updated|changed|moved))\b/i },
  { id: "tell-hedge", severity: "MED", pattern: /\b(?:it's worth noting|it should be noted|arguably|somewhat|relatively|might potentially|could possibly|in general|typically)\b/i },
  { id: "tell-filler", severity: "MED", pattern: /\b(?:in order to|due to the fact that|at this point in time|it is important to|when it comes to|in today's|in the world of)\b/i },
  { id: "tell-emdash", severity: "MED", pattern: /[—–]/ },
  { id: "tell-conclusion", severity: "LOW", pattern: /\b(?:in conclusion|to sum up|at the end of the day)\b|^overall,/i },
  { id: "tell-signpost", severity: "LOW", pattern: /\b(?:in this section|as mentioned above|let's dive in|we will cover)\b/i },
  { id: "tell-curly", severity: "LOW", pattern: /[‘’“”]/ },
  { id: "link-here", severity: "LOW", pattern: /\[(?:here|this|this doc|link|read more|click here)\]\(/i },
]

const HEADING = /^(#{1,6})\s+\S/
const FENCE = /^\s*(?:```|~~~)(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER = /^\s*\|[\s:|-]*\|\s*$/

type ScanResult = {
  findings: Finding[]
  words: number
}

function scan(file: string, source: string): ScanResult {
  const findings: Finding[] = []
  let words = 0
  const lines = source.split(/\r?\n/)
  const add = (line: number, id: string, severity: Severity, text: string) => {
    findings.push({ file, line, id, severity, text: text.trim().slice(0, 100) })
  }

  let inFence = false
  let inFrontmatter = lines[0] === "---"
  let previousDepth = 0

  for (const [index, line] of lines.entries()) {
    const number = index + 1
    if (inFrontmatter) {
      if (number > 1 && line === "---") inFrontmatter = false
      continue
    }

    const fence = line.match(FENCE)
    if (fence) {
      if (!inFence && !fence[1]?.trim()) add(number, "fence-nolang", "MED", line)
      inFence = !inFence
      continue
    }
    if (inFence) continue
    words += line.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)?.length ?? 0

    const heading = line.match(HEADING)
    if (heading?.[1]) {
      const depth = heading[1].length
      if (previousDepth && depth > previousDepth + 1) add(number, "heading-skip", "MED", line)
      previousDepth = depth
    }

    if (TABLE_ROW.test(line) && !TABLE_DIVIDER.test(line) && line.split("|").slice(1, -1).length < 2) {
      add(number, "element-table", "MED", line)
    }

    for (const rule of LINE_RULES) {
      if (rule.pattern.test(line)) add(number, rule.id, rule.severity, line)
    }
  }

  return { findings, words }
}

const paths = Bun.argv.slice(2)
if (!paths.length) {
  console.error("Usage: bun skills/prep-that-doc/scripts/scan.ts <file.md> [more.md ...]")
  process.exit(2)
}

const findings: Finding[] = []
let words = 0
for (const path of paths) {
  const result = scan(path, await readFile(path, "utf8"))
  findings.push(...result.findings)
  words += result.words
}

const ORDER: Record<Severity, number> = { HIGH: 0, MED: 1, LOW: 2 }
findings.sort((left, right) => ORDER[left.severity] - ORDER[right.severity] || left.line - right.line)

for (const finding of findings) {
  console.log(`${finding.file}:${finding.line} [${finding.severity}] ${finding.id}  ${finding.text}`)
}

const counts = findings.reduce<Record<string, number>>((totals, finding) => {
  totals[finding.severity] = (totals[finding.severity] ?? 0) + 1
  return totals
}, {})
const WEIGHTS: Record<Severity, number> = { HIGH: 5, MED: 2, LOW: 1 }
const BANDS: Array<{ limit: number; label: string }> = [
  { limit: 0, label: "clean" },
  { limit: 10, label: "light" },
  { limit: 25, label: "rough" },
  { limit: 50, label: "heavy" },
  { limit: Infinity, label: "severe" },
]
const DENSITY_FLOOR_WORDS = 300

const points = findings.reduce((total, finding) => total + WEIGHTS[finding.severity], 0)

console.log(`\nScanned ${paths.length} file${paths.length === 1 ? "" : "s"}, ${words} words. ${findings.length} candidate${findings.length === 1 ? "" : "s"}: ${(["HIGH", "MED", "LOW"] as const).map((severity) => `${counts[severity] ?? 0} ${severity}`).join(", ")}.`)

if (words < DENSITY_FLOOR_WORDS) {
  console.log(`Provisional score: ${points} points (5/2/1 per HIGH/MED/LOW). Density withheld below ${DENSITY_FLOOR_WORDS} words, where a few findings distort it.`)
} else {
  const density = (points * 1000) / words
  const band = BANDS.find(({ limit }) => density <= limit)?.label ?? "severe"
  console.log(`Provisional score: ${density.toFixed(1)} points per 1000 words, band ${band} (${points} points, 5/2/1 per HIGH/MED/LOW).`)
}

console.log("Provisional because it counts unclassified candidates. Score after classification, not from this number.")
