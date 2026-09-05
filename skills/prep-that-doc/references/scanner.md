# Scanner Contract

The scanner reads Markdown and emits candidates. It does not edit, execute commands from documents, contact external URLs, assign `needs-author`, or produce an agent verdict.

## Invocation

Resolve `scripts/scan.ts` inside the installed skill directory. Examples here use the repository path:

```sh
bun skills/prep-that-doc/scripts/scan.ts README.md docs/design.md
bun skills/prep-that-doc/scripts/scan.ts --stdin --type pr
bun skills/prep-that-doc/scripts/scan.ts --changed
bun skills/prep-that-doc/scripts/scan.ts --changed --base origin/main
bun skills/prep-that-doc/scripts/scan.ts --type runbook docs/operations.md
bun skills/prep-that-doc/scripts/scan.ts --format json --strict README.md
bun skills/prep-that-doc/scripts/scan.ts --config .prepdocrc README.md
```

Use `node` instead of `bun` on Node 22.18 or later on the 22 line, or Node 23.6 and later. Runtime code uses only Node built-ins and needs no package installation.

| Option | Behavior |
| --- | --- |
| Files | Scan named files; relative paths start at the working directory. |
| `--stdin` | Read one document from standard input, named `<stdin>` in output. |
| `--changed` | Discover current Markdown files changed in Git. |
| `--base REF` | With changed discovery, include branch changes since the merge base with `REF`. |
| `--type PROFILE` | Select the document profile for this invocation. |
| `--format text` | Human-readable candidates and counts, the default. |
| `--format json` | Emit one versioned JSON result for the complete invocation. |
| `--strict` | Include candidates whose effective severity is LOW. |
| `--config PATH` | Use this JSON configuration instead of discovery. |
| `--` | End option parsing so filenames beginning with a dash are accepted. |
| `--help` | Show usage. |

Choose one input mode: named files, stdin, or changed discovery. `--base` requires `--changed`. Invalid combinations, missing option values, unknown options, and an invocation without inputs are errors.

Changed discovery combines staged changes, unstaged changes, and untracked files. With a base, it also includes committed branch changes. Renames use the destination path, duplicate paths are scanned once, and deleted files are excluded. Supported extensions are `.md`, `.markdown`, and `.mdx`. Git-ignored untracked files and generated or vendored paths are excluded. It scans the working tree's current contents, including unstaged edits, rather than reconstructing the index or historical versions.

Local link targets resolve relative to their containing document. For stdin they resolve from the working directory. External URLs and anchors are not checked for reachability. An invalid local target is a candidate, not permission to replace the URL.

## Profiles

Supported profiles are `auto`, `generic`, `pr`, `readme`, `adr`, `runbook`, `cutover`, `spec`, `design`, `changelog`, `incident`, `api-reference`, `migration`, `security`, and `risk-assessment`.

An explicit `--type` overrides configuration. Otherwise `defaultProfile` applies. Auto detection uses file identity and document cues, falling back to `generic`. `--type auto` explicitly requests inference even when the configuration supplies a fixed profile.

Profiles control heading conventions, applicability, and expected-section candidates. See the generated [rule and profile reference](rules.md) for exact policies. A missing heading is contextual evidence; alternate titles, inline information, or a linked procedure may satisfy the reader's need.

Operational profiles and risk-bearing document cues preserve qualified claims. A security note or migration plan can be risk-bearing even when its structural profile is generic. Neither profile inference nor a candidate authorizes changing execution order.

## Protected Content

Prose detection masks fenced code, frontmatter, inline code, HTML comments, source quotations, command output, deliberate tables, link destinations, image paths, citations, commands, paths, and version numbers. Masking preserves locations in the original input.

Structural rules may inspect fence boundaries and labels, table dimensions, headings outside protected regions, and local link destinations. They do not interpret protected commands as prose. Generated document markers produce a visible skipped reason.

This is a protected-region parser for the documented Markdown forms, not a complete CommonMark or MDX renderer. Ambiguous embedded formats need manual review. An initial `---` followed by YAML mapping syntax is recognized as frontmatter; a standalone thematic break remains Markdown. An unclosed fence or recognized frontmatter block produces a structural candidate and protects the remaining body; it is not treated as a fatal parse exception.

## Configuration

The nearest `.prepdocrc` is discovered from the working directory upward to the Git repository root, or the filesystem root outside Git. An explicit `--config` path selects one file instead. Configuration is data, never executable code.

```json
{
  "version": 1,
  "defaultProfile": "auto",
  "acceptedTerminology": [],
  "protectedSections": [],
  "disabledRules": [],
  "severityOverrides": {},
  "houseStyle": {
    "allowCurlyQuotes": false,
    "emDashWordsPerOccurrence": 150
  }
}
```

Repository values override defaults; CLI options override repository values. Omitted settings keep their defaults. Nested house-style settings merge individually.

| Setting | Meaning |
| --- | --- |
| `version` | Configuration schema version, 1. |
| `defaultProfile` | A supported profile. |
| `acceptedTerminology` | Case-insensitive literal phrases protected from prose detectors. |
| `protectedSections` | Case-insensitive heading titles whose heading and subtree are excluded. Protection ends at the next peer or ancestor heading. |
| `disabledRules` | Registry IDs to exclude. |
| `severityOverrides` | Registry IDs mapped to HIGH, MED, or LOW. |
| `houseStyle.allowCurlyQuotes` | Allow typographic quotes in ordinary prose. Protected code is unchanged either way. |
| `houseStyle.emDashWordsPerOccurrence` | Positive integer controlling prose dash-density candidates. |

The version field is required. Unknown settings, rule IDs, profiles, invalid types, unsupported versions, and invalid numeric bounds are errors. The dash-density setting accepts integers from 1 through 10000. Final effective LOW severity is filtered unless strict mode is enabled. Severity overrides do not increase confidence or change the rule's edit boundary.

## Results And Exit Codes

| Exit | Meaning |
| --- | --- |
| 0 | No visible candidates, including an empty changed-file selection. |
| 1 | One or more visible candidates. |
| 2 | Invalid arguments/configuration, failed Git discovery, or an input/execution error. |

Skipped documents remain visible in output. No visible candidates does not mean skipped content was checked. A fatal error prevents a partial-success report.

JSON identifies `schemaVersion` and `rulesetVersion` as string `"1"`. The root `findings` list matches the combined per-document findings. Each finding has a stable fingerprint, rule ID, category, severity, confidence, file, one-based line and column, evidence, suggested action, and autofix boundary. Locations refer to the original source, not masked text. Columns count UTF-16 code units. The JSON Schema files for [output](output.schema.json) and [configuration](config.schema.json) define the complete wire contract, including error envelopes.

The root `profile` is the resolved profile for a homogeneous batch or `mixed` when files differ. Per-document profiles preserve that distinction. Category totals count visible candidates under `structural`, `factualGap`, and `stylistic`. Confidence is `certain`, `likely`, or `contextual`, independently of severity.

A fingerprint identifies a rule occurrence in a named document. Unrelated blank-line insertion does not change it. Editing the matched content or renaming the file can change it; it is not a permanent issue number or a hash of the whole document.

| Autofix boundary | Meaning |
| --- | --- |
| `safe` | A deterministic mechanical edit is possible within an authorized editing workflow. |
| `review` | Context is needed before changing text. |
| `never` | The issue depends on meaning, an author fact, or a consequential decision. |

These boundaries describe potential edits. The scanner has no automatic editing option. Its suggested action is advice for review, not an applied change.
