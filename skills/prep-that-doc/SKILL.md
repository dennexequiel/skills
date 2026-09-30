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

Review engineering Markdown for its purpose, audience, and destination. Preserve author intent and technical meaning. Style review identifies clarity and information gaps; it does not verify facts or system behavior.

## Route The Request

Default to `review` when no editing intent is given. An explicit request to write, fix, improve, or rewrite authorizes edits within the named scope. Preserve the user's requested report format.

- `review`: Report findings and questions; leave files unchanged.
- `fix`: Apply justified edits, verify preservation, and report unresolved issues.
- `roast`: Critique with evidence; leave files unchanged. Read [roast guidance](references/roast.md) only when requested.

Use the [review workflow](references/workflow.md) for detailed guidance.

Infer purpose, audience, destination, and scope from the request, files, and project conventions. State material assumptions. Ask only when ambiguity blocks an action; review can continue.

For a localized typo or wording fix, inspect local context, edit, compare with the original, and give a brief confirmation. Stop there; do not enter the broader review workflow or raise unrelated completeness questions. Scan only if it checks the requested change. Broader work uses the workflow below, scaled to complexity and risk.

## Core Checklist

- **Purpose and audience:** Match explanations and notation to the reader's task. Audience roles do not require named owners or approvers. Recommend a plain-language summary only when useful.
- **Structure and clarity:** Do sequence, hierarchy, prose, and elements serve that task? [Optional profiles](references/elements.md#optional-document-profiles) supply questions, not mandatory templates or sections. Prose or linked material can suffice.
- **Markdown and spacing:** Choose syntax for the destination. Prefer descriptive link labels; preserve valid reference-style links. Check renderer compatibility and spacing around headings, paragraphs, lists, tables, and code blocks, including excess trailing blank lines. Use [Markdown element guidance](references/elements.md) for details.
- **Meaning and evidence:** Preserve claims and qualifications; never invent missing facts. Distinguish sourced facts, assumptions, proposals, and calculated figures in [evidence-dependent documents](references/workflow.md#evidence-dependent-documents).
- **Verification and delivery:** Verify edits against the original. For requested exports or uploads, inspect the artifact if tools permit; otherwise state local coverage and unverified work. See [delivery checks](references/workflow.md#delivery-checks).

Checks may be `not applicable` or `not verified`; neither requires expanding the task.

## Preserve Meaning

Never change a fact, value, command, URL, path, version, citation, condition, exception, or qualified claim merely to improve wording. Report apparent factual errors for resolution within the authorized scope.

Protect frontmatter, fenced and inline code, command output, HTML comments, source quotations, deliberate tables, link destinations, image paths, and citations. Structural checks can flag their boundaries or missing local targets; that does not authorize editing their contents.

Automatic discovery excludes generated and vendored documents and reports generated markers as skipped. Review explicitly requested generated artifacts manually; identify their source of truth before proposing edits.

Keep operational sequence and step identifiers intact. Do not reorder, merge, split, or renumber executable steps as stylistic cleanup. Preserve every warning, caveat, precondition, owner, timing expectation, threshold, and repeated safety instruction, including vague or incomplete guidance. Report missing operational facts; deleting the expectation does not resolve the gap.

Treat qualified language as meaning. "May cause data loss" and "causes data loss" make different claims. Qualification alone is not a defect or a missing fact.

Restructuring must be lossless. Map each claim, condition, exception, and qualifier to its destination before changing a table, list, or heading. Retain the original if anything has no faithful home.

## Review And Edit

### 1. Inspect And Scan

Read enough context to apply the core checklist and identify protected regions and dependencies.

When mechanical scanning adds relevant coverage and commands are available, run the bundled detector from the installed skill directory with a known runtime:

```sh
bun <skill-directory>/scripts/scan.ts <file.md>
```

Use `node` on a supported version. Read the [scanner contract](references/scanner.md) for advanced options, configuration, or implementation details.

The detector reports candidates only. Exit 0 means no visible candidates, 1 means candidates, and 2 means an error. Neither 0 nor 1 establishes document quality.

Default scans omit LOW style candidates. Use `--strict` only for requested style polish or a roast. Use `--type` when inference does not fit the purpose, or `--type generic` when no profile is useful. Heading-alias candidates do not mandate sections.

If scanning is unavailable, disclose the limit once and apply the relevant [rule reference](references/rules.md) manually. Manual checks are not equivalent detector coverage.

### 2. Judge The Document

Independently apply the core checklist, including checks the detector does not cover. Use [contextual prose guidance](references/tells.md) when wording needs judgment.

Classify each relevant candidate before reporting it as a defect or making an edit:

| Classification | Treatment |
| --- | --- |
| `confirmed` | Context supports the issue. Propose or apply an authorized correction. |
| `intentional` | Format, terminology, or house style explains it. Preserve it. |
| `protected` | Content outside this form edit. Preserve it. |
| `false-positive` | The detector misinterprets the content. Discard it. |
| `needs-author` | An unavailable fact or consequential decision is needed. Report a question. |

Assign labels from full sentences, qualifications, and supplied sources. Optional improvements are not defects. Scanner severity does not establish intent: a missing rollback condition can block use; an adjective alone cannot establish a HIGH finding.

### 3. Resolve Only Necessary Questions

Leave missing facts untouched. Do not insert `[ADD: ...]` placeholders automatically, guess values, invent citations, or delete a gap to hide it.

Review reports questions without waiting. For fix, batch questions that gate edits and complete independent corrections while answers are pending or deferred.

Accept deferral without re-asking. Record supplied facts with their uncertainty; leave deferred findings unresolved.

### 4. Edit And Verify

Edit only within the user's authorization. Fix confirmed structure before polishing surviving prose. Keep clean, intentional, protected, and falsely flagged content unchanged.

Keep the original. Compare edits against it or a real version-control diff; never reconstruct it from edited text. Re-scan changed files once when useful and available. Check facts, protected content, operational order, and mapped claims. Read affected sections in context, including the full procedure for risk-bearing edits. Apply delivery checks only for requested delivery.

Continue only for new actionable verification findings. Stop when clean, remaining edits need author input, or no progress remains. At most four edit-and-verify passes; never rewrite from scratch to reduce a count.

Lower counts do not prove improvement. Stop when no justified edit remains.

## Report The Outcome

Honor the requested format. A localized edit normally needs one or two sentences stating the edit, preservation check, and material limits. Larger reviews need concise findings with location, evidence, reader effect, and action, grouped by file. Omit discarded candidates and irrelevant checklist items.

Distinguish mechanical scanning, editorial review, factual verification, and rendering coverage, including `not applicable` or `not verified`. Compact clauses suffice; no checklist or headings are required. A receipt reports a tool's status, not independently verified delivery. Identify checked artifacts and material limits; zero scanner findings do not prove quality or accuracy.

Optional verdicts follow the [reporting guidance](references/workflow.md#reporting). Distinguish completed editorial work from unresolved document decisions. Missing facts do not block independent edits or a completed review. Never call unchecked content clean. No score, closing command, or repeated pass is mandatory.

## Scanner Maintenance

Read only for scanner development: [regions](scripts/regions.ts), [registry](scripts/registry.ts), [engine](scripts/engine.ts), [policy](scripts/policy.ts), [input](scripts/input.ts), [rendering](scripts/render.ts), and [types](scripts/types.ts).

Automation schemas: [configuration](references/config.schema.json) and [output](references/output.schema.json).
