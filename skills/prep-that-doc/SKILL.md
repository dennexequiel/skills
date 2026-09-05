---
name: prep-that-doc
description: Write, review, or fix engineering Markdown for useful structure, clear prose, and missing operational facts. Use for specs, READMEs, PR descriptions, architecture decisions, runbooks, cutovers, migrations, incident reports, security documents, and risk assessments. Preserve meaning and author authority. Do not use for marketing copy, fiction, or source code refactoring.
argument-hint: "[review|fix|roast] <path>"
license: MIT
compatibility: Works in Agent Skills-compatible coding agents. The optional detector needs Bun or Node with direct TypeScript support. Without a runtime, apply the linked rules manually and disclose that limit.
metadata:
  display-name: Prep That Doc
  summary: Review engineering Markdown with document-aware rules, protected content, and evidence before edits.
  status: stable
  areas: documentation, writing
---

# Prep That Doc

Give engineering information the structure its reader needs. A comparison may need a table; an executable sequence needs its order preserved. Clear prose serves that structure.

This skill reviews form and identifies gaps. It does not choose the document's argument, invent missing facts, or verify the system it describes.

## Route The Request

Default to `review` when no editing intent is given. An explicit request to write, fix, improve, or rewrite authorizes edits within the named scope. Preserve the user's requested report format.

| Request | Action | Additional reference |
| --- | --- | --- |
| `review` | Report confirmed findings and questions. Leave files unchanged. | [workflow.md](references/workflow.md) for classification and reporting detail |
| `fix` | Apply justified edits, verify preservation, and report unresolved issues. | [workflow.md](references/workflow.md) for gaps and validation |
| `roast` | Give an evidence-based critique of the document. Leave files unchanged. | Read [roast.md](references/roast.md) only when requested |

Infer the document type, intended reader, and scope from the request and files. Use the existing project conventions. Ask only when an ambiguity blocks a specific action; read-only review can continue.

A short, low-risk document gets a focused pass: inspect its context, scan the named files if available, classify relevant candidates, and verify any edits. Do not load every reference or scan the repository for a local edit.

Use the complete workflow below for runbooks, cutovers, migrations, incident reports, security documents, risk assessments, or changes spanning dependent sections. When risk is unclear, preserve content conservatively while reviewing.

## Preserve Meaning

Never change a fact, value, command, URL, path, version, citation, condition, exception, or qualified claim merely to improve wording. Report apparent factual errors for the author to resolve.

Protect frontmatter, fenced and inline code, command output, HTML comments, source quotations, deliberate tables, link destinations, image paths, and citations. Structural checks can flag their boundaries or missing local targets; that does not authorize editing their contents.

Generated and vendored documents are excluded from automatic discovery. A generated marker is reported as skipped. Review an explicitly requested generated artifact manually and identify its source of truth before proposing edits.

For risk-bearing documents:

- Keep operational sequence and step identifiers intact. Do not reorder, merge, split, or renumber executable steps as stylistic cleanup.
- Preserve every warning, caveat, precondition, owner, timing, threshold, and repeated safety instruction.
- Treat qualified language as meaning. "May cause data loss" and "causes data loss" make different claims. Qualification alone is not a defect or a missing fact.
- Propose structural changes unless editing this document is authorized. A requested form edit does not authorize redesigning its procedure.

Restructuring must be lossless. Map every original claim, condition, exception, and qualifier to its destination before applying a table, list, or heading change. If anything has no faithful home, retain the original and explain the limitation.

## Complete Workflow

### 1. Inspect And Scan

Read enough context to understand the document's purpose, protected regions, and operational dependencies. Use [elements.md](references/elements.md) when deciding which Markdown element fits the information.

Resolve the installed skill directory, then run its bundled detector when commands are available:

```sh
bun <skill-directory>/scripts/scan.ts <file.md>
```

Use `node` instead of `bun` on a supported Node version. The [scanner contract](references/scanner.md) covers profiles, changed files, stdin, configuration, JSON, and exit codes. Read it when those options are needed.

The detector reports mechanical candidates only. Exit 0 means no visible candidates, 1 means candidates, and 2 means an input or execution error. Do not mistake exit 1 for tool failure, or exit 0 for proof of document quality.

Default scans omit LOW style candidates. Use `--strict` only for requested style polish or a roast. Use `--type` when the inferred profile does not match the document's purpose.

If neither runtime is available, disclose the limit once and apply the relevant [rule reference](references/rules.md) manually. Do not replace the detector with improvised searches and call that equivalent coverage.

### 2. Judge The Document

Independently inspect what mechanics cannot establish: element choice, information-free sentences, usable operational checks, missing facts, and whether the document fulfills its stated purpose. Use [tells.md](references/tells.md) for contextual prose judgment.

Classify each relevant candidate before reporting it as a defect or making an edit:

| Classification | Treatment |
| --- | --- |
| `confirmed` | The issue is supported by context. Propose or apply an authorized correction. |
| `intentional` | The format, terminology, or house style explains it. Preserve it. |
| `protected` | It concerns content outside this form edit. Preserve it. |
| `false-positive` | The detector's interpretation is wrong. Discard it. |
| `needs-author` | Resolving the issue requires an unavailable fact or consequential decision. Report a question. |

Only the agent workflow assigns these labels. Scanner severity and confidence are separate evidence, not author decisions. A certain text match can still be a contextual false positive.

Prioritize execution and meaning over style. A missing rollback condition can block use; an adjective alone cannot establish a HIGH finding.

### 3. Resolve Only Necessary Questions

Leave missing facts untouched. Do not insert `[ADD: ...]` placeholders automatically, guess values, invent citations, or delete a gap to hide it.

For review, report questions without pausing for answers. For fix, batch questions only when their answers gate a proposed edit. Continue independent confirmed edits while answers are pending or deferred.

Accept deferral and do not re-ask within the run. Record supplied facts exactly, including uncertainty. A deferred answer leaves an unresolved finding, not an empty field in the document.

### 4. Edit And Verify

Edit only within the user's authorization. Fix confirmed structure before polishing surviving prose. Keep clean, intentional, protected, and falsely flagged content unchanged.

Keep the original text for verification. Re-scan changed files once and compare with that original or a real version-control diff; do not reconstruct the original from edited text. Verify that facts, protected content, operational order, and every mapped claim survive. Read affected sections with their surrounding context; for risk-bearing documents, check the complete procedure.

Continue only if that verification exposes a new, actionable issue. Stop when clean, all remaining edits depend on author input, or no meaningful progress remains. At most four edit-and-verify passes; never rewrite from scratch merely to reduce a count.

A lower candidate count is not proof of improvement. When no justified edit remains, leave the document alone and report what limits further work.

## Report The Outcome

Use the user's requested format, or a short report grouped by file with structural issues first. Name the location, evidence, effect on the reader, and proposed action for each reported finding.

When using a verdict, derive it from classified findings: `rework` for HIGH confirmed issues, otherwise `blocked` for unresolved author facts, otherwise `minor` for confirmed issues, otherwise `clean`. A skipped or failed scan is a coverage limitation, never evidence for `clean`.

For fix, report the edits and verification, then what remains and why. For review, report findings and questions. State which files were checked; mention ignored candidates only when their explanation helps the reader.

A clean, low-risk document needs a short result. Offer a next action only when useful. No closing command, score, exhaustive checklist, or repeated pass is mandatory.

## Scanner Maintenance

Read implementation files only when developing the scanner: [regions](scripts/regions.ts), [registry](scripts/registry.ts), [engine](scripts/engine.ts), [policy](scripts/policy.ts), [input](scripts/input.ts), [rendering](scripts/render.ts), and [types](scripts/types.ts).

Automation schemas: [configuration](references/config.schema.json) and [output](references/output.schema.json). Ordinary document work uses the scanner and relevant guidance above.
