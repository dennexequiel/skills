const TITLE_LIMIT = 72
const TITLE_PATTERN = /^(feat|fix|docs|chore|refactor|test|perf)(?:\([a-z0-9]+(?:-[a-z0-9]+)*\))?: [a-z0-9][^\r\n]*$/
const TRAILING_PUNCTUATION = /[.!?,;:]$/

export function pullRequestTitleIssues(title: string): string[] {
  const issues: string[] = []
  if (title.length > TITLE_LIMIT)
    issues.push(`must be at most ${TITLE_LIMIT} characters`)
  if (title.includes("  ")) issues.push("must not contain consecutive spaces")
  if (!TITLE_PATTERN.test(title))
    issues.push(
      "must match <type>(<optional-kebab-scope>): <lower-case subject>",
    )
  if (TRAILING_PUNCTUATION.test(title))
    issues.push("must not end with punctuation")
  return issues
}

if (import.meta.main) {
  const title = process.argv[2]
  if (title === undefined) {
    console.error("Usage: bun scripts/check-pr-title.ts \"<pull request title>\"")
    process.exit(2)
  }
  const issues = pullRequestTitleIssues(title)
  if (issues.length) {
    console.error(`Invalid pull request title ${JSON.stringify(title)}:`)
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }
  console.log(`Valid pull request title: ${title}`)
}
