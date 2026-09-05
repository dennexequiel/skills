# Elements

Use this reference to judge which Markdown element serves the reader. Mechanical rule metadata and profile policies come from the [generated rule reference](rules.md).

## Choose The Container

| Information | Useful form | Context to preserve |
| --- | --- | --- |
| Several options compared on the same axes | A table, one row per option | Each option's conditions, caveats, and distinct values |
| Actions with an execution order | An ordered list | Existing order, identifiers, prerequisites, and branching |
| Independent items | An unordered list | Any priority or grouping the author intends |
| Terms and short definitions | A table or definition list | Exact terms and qualifications |
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

Code-fence labels help a reader distinguish runnable commands from output. The scanner can inspect fence boundaries and labels, but prose rules do not inspect the protected body. Flag an apparent command problem for review without silently changing its bytes or claiming that it was executed.

## Document Purpose

A profile supplies useful expectations, not proof that a section is missing. Read alternate headings, prose, and linked procedures before classifying a candidate. Repository templates and explicit author choices take precedence over a generic skeleton.

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
