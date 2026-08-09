---
name: prep-that-doc
description: Use when writing, reviewing, or fixing engineering markdown so it uses the correct element and says something. Covers specs, design docs, ADRs, runbooks, cutover and migration plans, READMEs, CHANGELOGs, PR descriptions, incident writeups, and infrastructure or DevOps documentation. Catches structure that names itself wrong, such as prose that should be a table, bullets that should be ordered steps, skipped heading levels, and unlabeled code fences. Also catches AI writing tells, including em dash pileups, bold scattered through prose, empty significance claims, and sentences that add no information. Do not use for marketing copy, fiction, or source code refactoring.
argument-hint: "[review|fix|roast] <path>"
license: MIT
compatibility: Works in Agent Skills-compatible coding agents. The bundled detector needs Bun, or a Node new enough to run TypeScript directly, and only when the agent can run commands; every rule also applies by hand.
metadata:
  display-name: Prep That Doc
  summary: Catch engineering markdown that names its own structure wrong, then fix it with evidence instead of vibes.
  status: experimental
  areas: documentation, writing
---

# Prep That Doc

Documents name their own structure wrong constantly. A comparison names itself a paragraph. A sequence of steps names itself a bullet list. A heading claims to be level four with no level three above it. Naming the thing correctly is most of the work, and it is the part generated prose gets wrong first.

- **IS:** structural and stylistic correctness of engineering markdown. Which element the content actually is, whether the hierarchy holds, whether each sentence carries information.
- **IS NOT:** deciding what the document should argue, inventing facts it lacks, marketing and landing-page copy, fiction, or refactoring the code the document describes.

## The Workflow

Run six phases in order. Skip none.

1. **Scope.** Establish the document type and the reader.
2. **Scan.** Detect mechanically, never by impression.
3. **Classify.** Judge every finding before touching it.
4. **Ask.** Put the blocking gaps to the author, with deferral always available.
5. **Fix.** Rewrite by meaning, not by pattern.
6. **Re-scan.** Prove the fix with a second detection pass.

### 1. Scope

Record three things before reading for problems:

- **Document type.** Spec, design doc, architecture decision record (ADR), runbook, cutover plan, README, CHANGELOG, PR description, incident writeup, API reference. Type decides which rules apply. A runbook wants numbered steps and a rollback section. An ADR wants context, decision, and consequences. Flagging a README for missing rollback steps is noise.
- **Reader and what they do next.** Someone paging through a cutover plan at 3am reads differently from someone evaluating a library. The reader decides how much can be assumed.
- **Protected regions.** Record these before editing and do not touch them: YAML frontmatter, fenced code blocks, tables whose structure is deliberate, link destinations, image paths, HTML comments, quoted source material, citations, version numbers, and command output.

Never change a fact, number, URL, command, path, or citation target to make prose read better. If something looks factually wrong, flag it. Do not silently correct it.

### Risk-Bearing Documents

Cutover plans, migration plans, runbooks, incident writeups, risk assessments, and security notes carry operational consequence. Someone follows them under pressure. Four rules replace the defaults:

- **Qualified language is data, not hedging.** "May cause data loss" and "causes data loss" are different claims. Only the author knows which is true. Never sharpen a hedge into a certainty or soften a certainty into a hedge. Treat these as `needs-author`.
- **Never reorder steps.** Sequence is the document. Renumbering, merging, or splitting steps changes what someone executes.
- **Never drop a caveat, precondition, warning, owner, timing, or threshold**, however redundant it reads. Repetition in an operational document is usually deliberate.
- **Structural change is proposed, never applied**, unless the author asks for `fix` on that specific document. Report the improvement and let them decide.

When a document's type is unclear and it might be one of these, ask before scanning. Guessing wrong here is the one mistake with real cost.

### Restructuring Is Lossless

Converting prose to a table, or bullets to ordered steps, moves content between containers. Content is lost when it does not fit the new shape.

Before proposing any restructure, account for every claim in the original. Every fact, condition, exception, and qualifier lands somewhere in the replacement, or the restructure is rejected.

A caveat with no column to live in is not a caveat to delete. It means the table is the wrong element, or it needs another column, or the caveat belongs in a line beneath the table. When a restructure cannot carry everything, say so and leave the original.

### 2. Scan

Run the bundled detector when the agent can execute commands. It sits at `scripts/scan.ts` beside this file, wherever the skill was installed, so resolve that directory first rather than assuming a path:

```sh
bun <this-skill-directory>/scripts/scan.ts <path-to-markdown>
```

Use `node` in place of `bun` when only Node is available. If neither runs the script, say so once and apply every rule by hand from the reference files. Do not silently skip the scan.

It groups findings under the heading that holds them, in document order, and prints line, severity, rule id, and the phrase that matched. Document order is deliberate. The detector lays out evidence where the author will go looking for it, and the report is where triage by severity happens. It also prints a provisional verdict, which is provisional because nothing in it is classified yet: false positives are still counted, and the findings only a reader can see are still missing. Its rules live in [references/elements.md](references/elements.md) and [references/tells.md](references/tells.md), written so every one can also be applied by hand when no runtime is available.

The detector owns the rules it implements. Do not substitute improvised greps for those, and do not treat its silence as a pass. The reference files carry the rest, including these three, which no regex settles and which are yours:

- **Element mismatch.** Content whose shape contradicts its markup. This is the highest-value check and the one no regex settles. See [references/elements.md](references/elements.md).
- **Empty sentences.** Sentences that survive deletion with no loss. Cut them.
- **Type mismatch.** A document doing a job its type does not do, such as a reference page walking through a tutorial.

### 3. Classify

Every finding gets exactly one label before any edit:

| Label | Meaning |
| --- | --- |
| `confirmed` | Real. Fix it. |
| `intentional` | The type or house style requires it. Leave it. |
| `protected` | Inside a protected region. Leave it. |
| `false-positive` | The rule misfired. Leave it and say why. |
| `needs-author` | Real, but fixing it requires a fact only the author has. |

A `needs-author` finding never gets an invented fix. Leave a marked placeholder such as `[ADD: which timeout?]` and report it.

Sort the `needs-author` findings into two piles, because they are not equally urgent:

- **Blocking.** The answer changes what a reader does. A rollback threshold, a timeout, a precondition, the owner to page, what a verification step actually checks.
- **Deferrable.** Everything else. A missing citation, an unnamed duration in background prose, a number nobody acts on.

### 4. Ask

`fix` asks about blocking findings before it edits. `review` and `roast` never ask, because they change nothing and an answer would have nowhere to land. They report the same questions and leave them with the author.

Ask in one round, worst first, each question naming its line and why the gap blocks a reader. Never drip questions across turns, and never ask about a deferrable finding. If more than five findings block, ask about the five that gate execution and leave the rest as placeholders.

**Answering later is a real answer.** Every question carries that option standing, and taking it costs nothing: write the `[ADD: ...]` placeholder, keep the label `needs-author`, move to the next question. Do not re-ask inside a run, do not press for a number twice, and do not stop editing the rest of the document because one answer is outstanding.

Record answers as given. Write the author's number without rounding it, do not derive a second fact from it, and do not harden a hedged answer into a certainty.

When the runtime cannot put a question to a human, or the author defers every one, `fix` completes the confirmed findings, leaves the placeholders standing, and reports `blocked`. That is a finished run, not a failed one.

### 5. Fix

Work finding by finding. The rule that governs every rewrite: **decide what the content actually is, then give it that form.** Do not paraphrase around a pattern.

Structure first, because structure changes delete style problems for free. Three paragraphs comparing options become a table, and the em dashes inside them stop existing. Style passes over prose that survives.

Rewriting reintroduces the exact patterns being removed, because the same habits produce the fix. Expect it. This is why phase 6 is not optional.

**Overcorrection is its own failure.** Em dashes are not banned. Tables are not always right. Bullets are not slop. A document stripped to bare declaratives is worse than the one you started with. The target is a document that says what it means in the form that means it, not a document with an empty findings list.

**A document that is already good gets left alone.** When classification leaves nothing confirmed, `fix` edits nothing, reports `clean`, and says so in one line. Detector output is not a work order. Editing a finding labelled `false-positive`, `intentional`, or `protected` is the failure the classify step exists to prevent, and it is the likelier failure on a good document, because the raw count still looks like something to answer for.

### 6. Re-scan

Re-run the detector on the rewritten file. Re-check the three reader-judgment items on your own output. Repeat until a pass produces no confirmed findings, capped at four passes. If a finding survives four passes, rewrite that section from scratch starting from one question: what is this section for?

Expect the rewrite to introduce the patterns it removed. A lower count does not prove the document got better. Read the whole thing once more for continuity before reporting.

## Verbs

Three requests, three different jobs. Detection and classification are identical in all three. What changes is what gets reported, who edits, and whether the author gets asked.

| Verb | Heading | Reports | Edits |
| --- | --- | --- | --- |
| `review` | `## Prep That Doc review` | HIGH and MED, scoped to the files named, prioritized so structure stays visible | Nothing |
| `fix` | `## Prep That Doc fix` | What changed, then what was left and why, with the verdict before and after | The file |
| `roast` | `## Prep That Doc roast` | Every severity including LOW, every file in scope, worst finding first, nothing softened | Nothing |

`roast` is the same analysis with the softening removed. It drops the LOW filter and the diplomatic framing, not the standards. Ask for it when you already know the document has problems and want them named flatly instead of proposed gently. Everything else holds:

- It never invents a finding to have more to say. A short roast on a good document is the correct output, and saying so is the honest result.
- It roasts the document, never the person who wrote it. No commentary on the author's skill, effort, or intelligence. The target is always the text.
- It never edits, exactly like `review`.
- `needs-author` findings stay `needs-author`. Being blunt is not license to guess at a missing number.

## Verdict

Every verb ends with one word telling the author what to do next. It follows from the findings, never from impression.

| Verdict | When | Means |
| --- | --- | --- |
| `clean` | Nothing confirmed, nothing `needs-author` | Ship it |
| `minor` | Confirmed findings, none HIGH | Cleanup is optional |
| `blocked` | `needs-author` findings, none HIGH | The form is right, the facts are missing |
| `rework` | Any HIGH confirmed finding | Fix it before anyone relies on it |

Take the last verdict that applies: `rework` outranks `blocked`, which outranks `minor`. Report the counts beside it so the word is auditable:

```text
Verdict: rework. 10 confirmed (4 HIGH, 5 MED, 1 LOW), 5 needs-author, 12 false-positive.
```

Four rules keep it honest:

- **Classify before deciding the verdict.** Raw detector output includes false positives. A style guide that quotes a banned phrase as its own example reads `rework` on raw hits while being entirely correct.
- **`needs-author` is never `clean`.** A runbook whose rollback trigger has no threshold has nothing confirmed and is not a shippable document. That gap is the verdict, which is why `blocked` exists.
- **Say what the detector cannot see.** It implements the mechanical rules only. Element mismatch, empty sentences, and a runbook missing its rollback are reader judgment, and all three are HIGH. Leave them out and the worst problems never reach the verdict.
- **Never optimize the verdict.** `minor` is a fine resting state. Deleting a real caveat to move from `minor` to `clean` makes the document worse and the word better.

`fix` reports the verdict before and after, which is the evidence that the edit worked.

## Preserve Author Authority

- Asked to **review**, report findings and propose fixes. Do not rewrite the file.
- Asked to **fix** or **improve**, edit the file and report what changed.
- Asked to **roast**, report everything and still change nothing.
- Only **fix** questions the author. Deferring an answer is always available and never costs the rest of the run.
- Never change meaning, claims, or facts. This is a form pass.
- Never delete a section because it seems redundant. Redundancy in a runbook is often deliberate.
- Scope to the files named or changed. Unscoped findings bury the real ones.

## Report

Head the report with the verb that produced it. Group by file, order by severity, and name the rule so the author can find it:

```markdown
## Prep That Doc review

### docs/cutover.md
- [HIGH] `element-table`: Lines 34-49 compare three rollback options in prose.
  - Fix: One table, columns Option / Blast radius / Time to revert.
- [MED] `heading-skip`: Line 61 is h4 under an h2.
  - Fix: Promote to h3, or add the missing h3 above it.
- [NEEDS-AUTHOR] `tell-vague-number`: Line 72 says "should finish quickly".
  - Fix: `[ADD: expected duration?]`

### README.md
- pass

Verdict: rework. 3 confirmed (1 HIGH, 2 MED), 1 needs-author, 2 false-positive (see notes).
Scanned 2 files, 2 verify passes.
Not seen by the detector: 1 element mismatch, 1 missing rollback section. Both confirmed above.
```

List clean files explicitly so the author knows they were checked. Every finding names a rule, states the problem, and proposes a fix. A finding without a fix is not reportable.

`fix` reports a record of edits rather than a list of findings. Under its own heading it names what changed, grouped the same way, then every finding it deliberately left standing with the reason each one survived. A `needs-author` placeholder and a protected region are both results, so neither is silent.

## Gotchas

- Document-type misclassification is the top source of false positives. A CHANGELOG is supposed to be a flat list. An ADR is supposed to read as prose. Classify before you scan.
- Do not convert every list to a table. Tables need at least two real columns of distinct information. A one-column table is a list wearing a costume.
- Do not flag heading depth in files whose type has a fixed shape, such as a PR template or an issue template.
- Do not rewrite content the author asked you only to review. Report and propose.
- Do not report style nits above structural problems. Authors fix what they see first, and a serial comma note can bury a broken hierarchy.
- Generated files, vendored docs, and lockfile-adjacent markdown are out of scope unless named explicitly.
- A document that quotes writing rules will match those rules. Style guides, rule catalogs, and this skill's own reference files are the standard `false-positive` case, because the banned phrase appears as the example. Check whether a hit is used or merely named.

## Reference

- [references/elements.md](references/elements.md) decides which markdown element the content actually is.
- [references/tells.md](references/tells.md) catalogs style rules and their detection patterns.
