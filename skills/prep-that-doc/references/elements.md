# Elements

Use this reference to judge which Markdown element serves the reader. Mechanical rule metadata and profile policies come from the [generated rule reference](rules.md).

## Destination And Links

Choose syntax supported by the destination's Markdown dialect, renderer, and publishing path. Repository previews, PR bodies, documentation sites, and exported files can handle tables, definition lists, footnotes, HTML, and relative links differently. Use known project configuration or an available preview; when compatibility cannot be checked, state the assumption or mark rendering `not verified`.

Prefer link labels that describe the destination or action. Inline links and full, collapsed, or shortcut reference-style links are valid when supported. Check that reference definitions resolve and that labels remain meaningful; do not convert them solely to satisfy a preference for inline syntax. Inspect anchors, relative destinations, and image paths in the intended context. A local target's existence does not prove that an exported or uploaded link works.

## Choose The Container

| Information | Useful form | Context to preserve |
| --- | --- | --- |
| Several options compared on the same axes | A table, one row per option | Each option's conditions, caveats, and distinct values |
| Actions with an execution order | An ordered list | Existing order, identifiers, prerequisites, and branching |
| Independent items | An unordered list | Any priority or grouping the author intends |
| Terms and short definitions | A table or supported definition list | Exact terms and qualifications |
| Terms requiring paragraphs | A heading and prose for each term | Context needed to interpret each definition |
| Conditional paths | Explicit conditions beside the relevant steps | Which branch applies and where branches rejoin |
| One developed idea | A paragraph | Connections between claims |
| Commands or output | Fenced code with an appropriate label | Exact characters, sequence, and distinction between input and output |
| A warning affecting action | A visible warning beside that action | Its scope, trigger, consequence, and exception |

`element-table` names the manual observation that a comparison would benefit from a table. The scanner's `table-underfit` candidate concerns an existing table's dimensions; these are different questions.

## Tables And Lists

A comparison table needs at least two columns carrying distinct information. A one-column table may be a layout convention; do not convert it automatically. One data row can still be useful in a stable schema or reference format. GitHub Flavored Markdown (GFM) permits body rows with different cell counts, so an uneven row is not automatically a syntax defect. See the [GFM table specification](https://github.github.com/gfm/#tables-extension-).

A table is the wrong shape if its cells cannot faithfully hold the source. Preserve conditions in dedicated cells, notes tied to the correct option, or nearby prose. Reject the conversion when a caveat loses its scope.

Lists do not need conversion because they look informal. Use ordered steps only when the order matters. Preserve existing operational order and identifiers; a form edit does not grant permission to redesign a procedure.

## Headings And Code

Headings should expose the information hierarchy. PR bodies and templates often begin at H2 because the host supplies a title. A parent heading may introduce several child sections without intervening prose. Questions can be useful headings when they match the reader's task.

Code-fence labels help a reader distinguish runnable commands from output. The scanner can inspect fence boundaries and labels, but prose rules do not inspect the protected body. A structural fix may adjust a block's container indentation to attach it to the correct list item while preserving code content and step order. If the user requires the fenced body byte-identical, preserve those bytes too. Flag an apparent command problem without silently changing it or claiming execution.

## Spacing

Inspect source spacing as well as any available rendered view. The bundled scanner does not check block spacing or excess trailing blank lines; review them manually.

- Separate headings from surrounding blocks so hierarchy and block boundaries are clear. Follow destination conventions without inserting filler paragraphs between a parent and child heading.
- Keep distinct paragraphs separated. Preserve intentional hard line breaks; a source line wrap alone does not create a rendered paragraph.
- Check spacing around lists and between their items. Preserve meaningful indentation and intentional tight or loose list layouts; a blank line can change how a list renders.
- Separate tables from adjacent prose or lists as the renderer requires. Keep header and delimiter rows together.
- Check separation around code blocks and preserve intended list nesting. Adjust only container indentation when a justified structural repair requires it; preserve protected contents.
- Remove excess blank lines between blocks or at the end only when they have no intended role. A normal final newline is not an excess blank line.

Do not apply a fixed blank-line count blindly across Markdown dialects or inside protected content.

## Optional Document Profiles

Start with purpose, audience, and destination. Use a profile below only when its reader questions help; an engineering note need not fit any profile. These are optional review lenses, not mandatory templates or headings. Read alternate headings, prose, and linked material before reporting a gap. Honor repository templates when applicable, without adding sections solely to clear a scanner candidate.

For mixed audiences, recommend a short plain-language summary when it helps readers understand a decision, consequence, or next action. Keep necessary technical detail available. A short PR description, specialist API reference, or focused edit may need no summary at all.

| Document | Reader's question |
| --- | --- |
| Spec or design | What problem, scope, constraints, proposal, and tradeoffs does this establish? |
| Architecture decision record (ADR) | What decision applies, in which context, with what consequences? |
| Runbook | Can the operator identify prerequisites, execute the sequence, verify the result, and recover or escalate? |
| Cutover or migration | Who proceeds at each gate, under which conditions, and what happens when a gate fails? |
| README | Can the intended reader understand the purpose and find a working starting point? |
| Incident report | What happened, what is known or uncertain, what was affected, and who owns follow-up? |
| PR description | Can the reviewer understand the change, reason, and validation? |
| CHANGELOG | Can a reader find relevant changes and their versions? |
| API reference | Can a caller find the contract, inputs, outputs, errors, and applicable examples? |

Do not invent a rollback procedure or infer that rollback is always possible. A documented irreversible operation may need escalation, a recovery plan, or an explicit accepted limitation. Report the specific missing decision as an author question.
