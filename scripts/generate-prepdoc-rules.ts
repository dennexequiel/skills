import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { PROFILE_SECTIONS } from "../skills/prep-that-doc/scripts/policy.ts"
import { RULES } from "../skills/prep-that-doc/scripts/registry.ts"
import { AUTOFIXES, CATEGORIES, CONFIDENCES, PROFILES, RULESET_VERSION, SCHEMA_VERSION, SEVERITIES } from "../skills/prep-that-doc/scripts/types.ts"

const target = resolve(import.meta.dir, "../skills/prep-that-doc/references/rules.md")

function render(): string {
  const lines = [
    "# Scanner rules",
    "",
    "Generated from the bundled registry and profile policy. Regenerate it with the repository rule-generation command; do not edit it by hand.",
    "",
    "The scanner masks fenced and indented code, frontmatter, inline code, HTML comments, blockquotes, tables, link destinations, citations, commands, paths, and versions before prose checks. Structural checks inspect only Markdown delimiters, local link targets, headings, and table dimensions. Unclosed fences and frontmatter are ambiguous structural candidates, not parsing failures. A generated-document marker skips the document.",
    "",
    "| Rule | Category | Default severity | Confidence | Profiles | Autofix | Action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...RULES.map((rule) => `| \`${rule.id}\` | ${rule.category} | ${rule.severity} | ${rule.confidence} | ${rule.profiles === "all" ? "all" : rule.profiles.join(", ")} | ${rule.autofix} | ${rule.action} |`),
    "",
    ...RULES.flatMap((rule) => [
      `## ${rule.id}`, "", rule.description, "", `Detection: ${rule.detection}`, "",
      ...(rule.detect ? ["```text", rule.detect.expression, "```", ""] : []),
    ]),
    "## Profile section candidates",
    "",
    "These are MED contextual factual-gap candidates. They are never automatic edits. Generic documents have no template demand.",
    "",
    "| Profile | Heading aliases |",
    "| --- | --- |",
    ...Object.entries(PROFILE_SECTIONS).map(([profile, groups]) => `| ${profile} | ${groups.length ? groups.map((aliases) => aliases.join(" / ")).join("; ") : "None"} |`),
    "",
    "## Limits",
    "",
    "The scanner does not parse every Markdown extension, fetch network links, validate anchors, infer missing facts, or determine whether a prose-to-table rewrite is appropriate. Protected sections match exact heading titles case-insensitively and include their subtree through the next peer or ancestor heading.",
    "",
  ]
  return lines.join("\n")
}

const scalar = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra })
const array = (items: unknown) => ({ type: "array", items })
const enumeration = (values: readonly string[]) => ({ enum: values })
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties })
const resolvedProfiles = PROFILES.filter((profile) => profile !== "auto")
const text = scalar("string")
const count = scalar("integer", { minimum: 0 })
const ruleIDs = RULES.map((rule) => rule.id)
const configuration = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Prep That Doc configuration",
  ...object({
    version: { const: 1 }, defaultProfile: enumeration(PROFILES),
    acceptedTerminology: array(scalar("string", { minLength: 1, pattern: "\\S" })),
    protectedSections: array(scalar("string", { minLength: 1, pattern: "\\S" })),
    disabledRules: array(enumeration(ruleIDs)),
    severityOverrides: object(Object.fromEntries(ruleIDs.map((id) => [id, enumeration(SEVERITIES)])), []),
    houseStyle: object({ allowCurlyQuotes: scalar("boolean"), emDashWordsPerOccurrence: scalar("integer", { minimum: 1, maximum: 10_000 }) }, []),
  }, ["version"]),
}
const finding = object({
  fingerprint: scalar("string", { pattern: "^[a-f0-9]{16}$" }),
  rule: enumeration(ruleIDs), category: enumeration(CATEGORIES), severity: enumeration(SEVERITIES), confidence: enumeration(CONFIDENCES),
  file: text, location: object({ line: scalar("integer", { minimum: 1 }), column: scalar("integer", { minimum: 1 }) }),
  evidence: text, action: text, autofix: enumeration(AUTOFIXES), profile: enumeration(resolvedProfiles),
  section: object({ line: count, heading: text }),
})
const findings = array({ $ref: "#/$defs/finding" })
const versions = { schemaVersion: { const: SCHEMA_VERSION }, rulesetVersion: { const: RULESET_VERSION } }
const document = object({ file: text, profile: enumeration(resolvedProfiles), findings, skipped: object({ reason: text }) }, ["file", "profile", "findings"])
const output = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Prep That Doc scanner output",
  $defs: { finding },
  oneOf: [
    object({ ...versions, profile: enumeration([...resolvedProfiles, "mixed"]), documents: array(document), findings,
      summary: object(Object.fromEntries(CATEGORIES.map((category) => [category, count]))) }),
    object({ ...versions, error: object({ message: text }) }),
  ],
}
const artifacts = new Map([
  [target, render()],
  [resolve(dirname(target), "config.schema.json"), `${JSON.stringify(configuration, null, 2)}\n`],
  [resolve(dirname(target), "output.schema.json"), `${JSON.stringify(output, null, 2)}\n`],
])
for (const [path, expected] of artifacts) {
  if (process.argv.includes("--write")) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, expected, "utf8")
  } else {
    const actual = await readFile(path, "utf8").catch(() => undefined)
    if (actual !== expected) {
      process.stderr.write(`${path} is missing or stale. Run bun run generate:prepdoc-rules.\n`)
      process.exitCode = 1
    }
  }
}
