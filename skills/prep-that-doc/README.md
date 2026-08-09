# Prep That Doc

Prep That Doc reads engineering markdown and catches content that names its own structure wrong. A comparison written as three paragraphs is a table. A sequence where order matters is not a bullet list. An h4 under an h2 is a broken hierarchy claiming to be a heading.

It fixes the AI writing tells too, the em dash pileups and the sentences that survive deletion. That part is table stakes and other skills do it. The structural half is the reason this one exists.

## Install

Choose the package runner already available on your machine:

```sh
# Node.js
npx skills add dennexequiel/skills --skill prep-that-doc

# Bun
bunx skills add dennexequiel/skills --skill prep-that-doc
```

Run one command, not both.

To install Prep That Doc globally for Claude Code without interactive prompts:

```sh
npx skills add dennexequiel/skills --skill prep-that-doc --agent claude-code --global --yes
```

## Use

Point it at documents. Ask to review or to fix, and it does exactly that one.

```text
review docs/cutover.md with prep-that-doc
prep this spec, fix what you find
roast my README, I can take it
```

The three verbs behave differently on purpose, and each heads its report with its own name so you can tell them apart at a glance:

- **review** reports HIGH and MED findings with proposed fixes, and changes nothing.
- **fix** edits the file, reports what changed and what it deliberately left, and gives the score before and after.
- **roast** reports every severity, worst first, unsoftened, and still changes nothing.

### Score

`review` and `roast` both end with a number, and it is computed rather than felt:

```text
points  = 5 x HIGH + 2 x MED + 1 x LOW   (confirmed findings only)
density = points x 1000 / words          -> clean, light, rough, heavy, severe
```

Only confirmed findings count, so a document is never punished for quoting a banned phrase as an example. Below 300 words the density is withheld and raw points are reported, because a handful of findings distorts a short file. The score is a severity ranking, not a target: a document can score clean and still be bad, and deleting a real caveat to shed two points makes the document worse.

`roast` is the same analysis with the softening removed. It drops the noise filter and the diplomatic framing, not the standards. It will not invent findings to pad the list, a short roast on a good document is the honest answer, and it targets the document rather than the author.

Documents it covers: specs, design docs, architecture decision records (ADRs), runbooks, cutover and migration plans, READMEs, CHANGELOGs, PR descriptions, incident writeups, and infrastructure or DevOps docs.

### Detector

The bundled detector finds the mechanical rules so findings are evidence rather than impressions. It ships at `scripts/scan.ts` inside the skill directory, so the command depends on where your client installed the skill:

```sh
# installed globally for Claude Code
bun ~/.claude/skills/prep-that-doc/scripts/scan.ts docs/cutover.md

# installed into a project
bun .claude/skills/prep-that-doc/scripts/scan.ts docs/cutover.md
```

It prints file, line, severity, and rule id. It never edits. Every rule it implements is also written out in [references/elements.md](references/elements.md) and [references/tells.md](references/tells.md) so the skill still works when no runtime is available.

## Compatibility

The core skill works in Agent Skills-compatible clients with no adapter.

The detector needs Bun, or a Node that runs TypeScript without a build step (22.18 and newer on the 22 line, 23.6 and newer otherwise), and only when the client can run commands. Older Node exits with a syntax error on the type annotations. Without either runtime, every rule applies by hand from the reference files, and the workflow is unchanged.

## Limitations

- Form only. It never changes facts, numbers, commands, paths, or citations, and never invents a missing one. Gaps come back as `[ADD: ...]` placeholders for the author.
- Restructuring accounts for every claim before it happens. If a caveat has nowhere to live in the new shape, the restructure is rejected rather than the caveat dropped.
- Cutover plans, runbooks, incident writeups, and risk assessments get stricter defaults. Qualified language is treated as calibrated uncertainty rather than hedging, steps are never reordered, and structural changes are proposed rather than applied.
- Document type drives which rules apply. Given a file whose type it cannot determine, it asks rather than guessing, because a CHANGELOG and a runbook fail in opposite directions.
- Not for marketing copy, fiction, or source code refactoring.
- The detector over-matches by design. Findings are candidates, and every one is classified before an edit.

## Reference

- [SKILL.md](SKILL.md) defines the operative contract.
- [references/elements.md](references/elements.md) decides which markdown element the content actually is.
- [references/tells.md](references/tells.md) catalogs the style rules and their detection patterns.
