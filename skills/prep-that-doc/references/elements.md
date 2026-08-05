# Elements

Which markdown element the content actually is. This is the judgment the detector cannot make for you.

## The Test

Ask what shape the content has, not what shape it currently wears.

| The content is | Wrong element it usually wears | Right element | Rule id |
| --- | --- | --- | --- |
| Several things compared on the same axes | Paragraphs, or one bullet per thing | Table, one row per thing, one column per axis | `element-table` |
| Steps performed in order, where order matters | Unordered bullets | Ordered list | `element-ordered` |
| Items with no inherent order | Ordered list | Unordered bullets | `element-unordered` |
| Terms with definitions | Bullets shaped `**Term:** meaning` | Two-column table, or a heading per term when each needs paragraphs | `element-definition` |
| A branch the reader takes one path through | Prose describing both paths | Ordered list with an explicit condition per branch | `element-branch` |
| Something to run or paste verbatim | Inline code, or indented prose | Fenced block with a language tag | `element-fence` |
| A warning that changes what the reader does | A sentence starting "Note that" | Its own line, leading with the consequence | `element-warning` |
| One idea developed across several sentences | Fragmented bullets | A paragraph | `element-paragraph` |
| A reference the reader looks up, not reads | Prose narrative | Table or definition list | `element-lookup` |

## Tables

A table earns its markup when it has at least two columns carrying distinct information and at least two rows. Below that it is a list wearing a costume.

Convert prose to a table when the same nouns repeat across sentences with different values attached. Three sentences that each say "Option X takes N minutes and risks Y" are three rows.

Do not table things that need a paragraph each to explain. A cell that wraps to five lines wanted a heading.

## Ordered Versus Unordered

Numbers promise sequence. If a reader can do item three before item one with the same result, the numbers lie. Use bullets.

If the reader must not reorder them, numbers are mandatory. A runbook with unordered bullets is a defect, not a style preference.

## Headings

- `heading-skip` No level may be skipped. An h4 requires an h3 above it.
- `heading-one` One h1 per document, matching what the document is.
- `heading-empty` A heading followed immediately by another heading has no content of its own. Either write the content or drop the level.
- `heading-case` Match the document's existing convention. Do not mix sentence case and title case in one file.
- `heading-question` Headings name a topic. A heading phrased as a question belongs in an FAQ and nowhere else.
- `heading-orphan` A lone subheading with no sibling means the level is unnecessary. Fold it into the parent.

## Code Fences

- `fence-nolang` Every fence declares a language. Use `text` for output, `sh` for shell, `console` when the prompt is included and the block must not be pasted whole.
- `fence-prompt` Do not prefix runnable commands with `$`. It survives copy-paste and breaks.
- `fence-mixed` Never mix a command and its output in one fence unless the language is `console`. The reader cannot tell what to paste.
- `fence-untested` A block presented as runnable must be runnable. Placeholders are marked, such as `<region>` or `YOUR_TOKEN`, never left as plausible-looking fake values.

## Links

- `link-here` Link text names the destination. "See [the rollback plan]", never "see [here]" or "[this doc]".
- `link-bare` A bare URL in prose gets link text unless the URL itself is the point.
- `link-dead` Every relative link resolves. Check, do not assume.

## Document Shapes

Each type has an expected skeleton. Missing sections are findings. Extra sections are usually not.

| Type | Expected skeleton |
| --- | --- |
| Spec | Problem, goals, non-goals, proposed design, alternatives, open questions |
| ADR | Context, decision, status, consequences |
| Runbook | Preconditions, numbered steps, verification per step, rollback, escalation |
| Cutover plan | Scope, sequence with owners and times, verification gates, rollback trigger, comms |
| README | What it is, install, minimal working example, where to go next |
| Incident writeup | Impact, timeline, root cause, what fixed it, follow-up actions with owners |
| PR description | What changed, why, how the reviewer should verify |

A runbook without a rollback section is the highest-severity structural finding in this file. Report it first.
