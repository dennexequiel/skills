# Prep That Doc

Prep That Doc reviews engineering Markdown for useful structure, clear prose, and missing operational facts. It combines a document-aware mechanical scanner with an agent's contextual judgment. It preserves exact facts, commands, citations, caveats, and operational order.

## Install

Run the interactive installer to choose skills, agents, and installation scope:

```sh
npx skills add dennexequiel/skills --skill prep-that-doc
```

Use `bunx` in place of `npx` if Bun is your package runner. To install globally for a specific agent:

```sh
npx skills add dennexequiel/skills --skill prep-that-doc --agent claude-code --global --yes
```

Use `--agent opencode` or `--agent codex` for those hosts. Prep That Doc requires no automation adapter. Re-run the install command to refresh an installation and start a fresh agent session.

## Use

These are requests to your agent, not standalone shell commands:

```text
Review docs/runbook.md with prep-that-doc.
Fix the structure in README.md with prep-that-doc.
Roast this design doc. Leave the file unchanged.
```

| Request | Result |
| --- | --- |
| Review, or no editing intent | Findings, proposed actions, and author questions. Files remain unchanged. |
| Fix or improve | Authorized corrections, preservation checks, and unresolved questions. |
| Roast | An optional blunt critique of the document, supported by evidence. Files remain unchanged. |

A short, low-risk document gets a focused pass. Operational and risk-bearing documents get a complete review of sequence, conditions, verification, and recovery. Missing facts remain untouched and come back as questions; the skill does not insert placeholders automatically.

The agent can summarize classified findings as `clean`, `minor`, `blocked`, or `rework`. The scanner itself reports candidates only. A clean scanner result does not prove that the document is complete, factual, or operationally safe.

## Scanner

From a repository checkout:

```sh
bun skills/prep-that-doc/scripts/scan.ts README.md
bun skills/prep-that-doc/scripts/scan.ts --changed --base origin/main
bun skills/prep-that-doc/scripts/scan.ts --stdin --type pr --format json
bun skills/prep-that-doc/scripts/scan.ts --type runbook --strict docs/runbook.md
```

For an installed skill, use `scripts/scan.ts` inside its installation directory. `node` can replace `bun` on a supported Node version. The stdin form reads Markdown from standard input.

The scanner never edits files. Default output omits LOW findings; `--strict` includes them. Text output groups candidates by file and section. Versioned JSON supports automation, stable finding fingerprints, and per-file profiles.

| Exit code | Meaning |
| --- | --- |
| 0 | No visible candidates |
| 1 | Candidates found |
| 2 | Invalid arguments, invalid configuration, or input/execution failure |

Automation must handle all three codes. Read the [CLI and configuration contract](references/scanner.md) for profile selection, changed-file semantics, protected regions, output, and `.prepdocrc` settings. The [generated rule reference](references/rules.md) documents the actual registry.

## Compatibility

The core skill works in Agent Skills-compatible clients, including OpenCode, Claude Code, and Codex, without a host adapter.

The scanner uses only Node built-ins. It runs with Bun, Node 22.18 or later on the 22 line, or Node 23.6 and later. Older Node versions require a runtime with direct TypeScript support. When neither runtime is available, apply the reference rules manually and disclose that limitation.

Repository checks verify scanner behavior and rule-reference consistency. Behavioral evaluations inspect agent decisions separately; passing mechanical tests does not prove every host or model follows the workflow.

## Limitations

- Candidate detection cannot establish factual truth, operational safety, or author intent. No command is executed and no external link is fetched.
- The protected-region parser handles documented Markdown conventions. It is not a complete CommonMark renderer; unusual embedded formats need manual review.
- Profiles infer document purpose and supply contextual expectations. Alternate headings or linked procedures can satisfy a requirement; the agent must judge them.
- `safe`, `review`, and `never` describe each rule's edit boundary. The scanner has no automatic edit mode.
- Form edits preserve every claim, condition, qualifier, command, URL, path, and operational step. A reshape that cannot do so is rejected.
- Marketing copy, fiction, translation, and source code refactoring are outside this skill's scope.

## Reference

- [SKILL.md](SKILL.md) contains routing, protections, and the execution contract.
- [Scanner contract](references/scanner.md) documents inputs, configuration, and output.
- [Rule reference](references/rules.md) is generated from the detector registry.
- [Elements](references/elements.md) explains contextual structure choices.
- [Prose review](references/tells.md) explains meaning-sensitive style judgment.
- [Workflow](references/workflow.md) covers author questions, validation, and reports.
- [Roast](references/roast.md) is loaded only for that requested mode.
