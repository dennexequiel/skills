import type { Finding, ScanResult } from "./types.ts"

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function renderFinding(finding: Finding): string {
  return `    ${finding.location.line}:${finding.location.column} ${finding.severity} ${finding.rule}\n      evidence: ${finding.evidence}\n      action: ${finding.action}`
}

export function renderText(result: ScanResult, strict: boolean): string {
  const output: string[] = []
  let visible = 0
  for (const document of result.documents) {
    output.push(document.file)
    if (document.skipped) {
      output.push(`  skipped: ${document.skipped.reason}`)
      continue
    }
    const findings = document.findings.filter((finding) => strict || finding.severity !== "LOW")
    visible += findings.length
    if (!findings.length) output.push("  no candidates")
    else {
      let section = ""
      for (const finding of findings) {
        const next = `${finding.section.line}:${finding.section.heading}`
        if (next !== section) {
          output.push(`  ${finding.section.heading || "Preamble"} (line ${finding.section.line})`)
          section = next
        }
        output.push(renderFinding(finding))
      }
    }
  }
  output.push(`${plural(result.documents.length, "file")}, ${plural(visible, "visible candidate")}.`)
  return `${output.join("\n")}\n`
}

export function jsonResult(result: ScanResult, strict: boolean): ScanResult {
  const findings = result.findings.filter((finding) => strict || finding.severity !== "LOW")
  return {
    ...result,
    findings,
    documents: result.documents.map((document) => ({ ...document, findings: document.findings.filter((finding) => strict || finding.severity !== "LOW") })),
    summary: summary(findings),
  }
}

function summary(findings: Finding[]): ScanResult["summary"] {
  const totals = { structural: 0, factualGap: 0, stylistic: 0 }
  for (const finding of findings) totals[finding.category] += 1
  return totals
}

export function renderJsonError(message: string): string {
  return `${JSON.stringify({ schemaVersion: "1", rulesetVersion: "1", error: { message } })}\n`
}
