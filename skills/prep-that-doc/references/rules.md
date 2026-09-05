# Scanner rules

Generated from the bundled registry and profile policy. Regenerate it with the repository rule-generation command; do not edit it by hand.

The scanner masks fenced and indented code, frontmatter, inline code, HTML comments, blockquotes, tables, link destinations, citations, commands, paths, and versions before prose checks. Structural checks inspect only Markdown delimiters, local link targets, headings, and table dimensions. Unclosed fences and frontmatter are ambiguous structural candidates, not parsing failures. A generated-document marker skips the document.

| Rule | Category | Default severity | Confidence | Profiles | Autofix | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `fence-nolang` | structural | MED | certain | all | review | Choose a language label that matches the protected content without changing its bytes. |
| `frontmatter-unclosed` | structural | MED | likely | all | never | Close the frontmatter block or replace its opening delimiter. |
| `fence-unclosed` | structural | MED | likely | all | never | Close the fence with its opening marker, or make the content ordinary Markdown. |
| `heading-skip` | structural | MED | likely | all | review | Use a heading level that follows the surrounding hierarchy. |
| `heading-one` | structural | MED | likely | generic, readme, adr, runbook, cutover, spec, design, changelog, incident, api-reference, migration, security, risk-assessment | review | Keep one document title, unless this file intentionally combines documents. |
| `table-underfit` | structural | LOW | contextual | all | review | Use a list for one-dimensional content or add the missing table dimension. |
| `link-dead` | structural | HIGH | certain | all | never | Correct the local path or add the target file. Network URLs and anchors are not fetched. |
| `section-missing` | factualGap | MED | contextual | pr, readme, adr, runbook, cutover, spec, design, incident, api-reference, migration, security, risk-assessment | never | Confirm whether this document needs the named section, then add it only when the facts are available. |
| `tell-notxbuty` | stylistic | LOW | contextual | all | review | State the concrete distinction and its consequence. |
| `tell-significance` | stylistic | LOW | contextual | all | review | Name the affected behavior, decision, or measurable consequence. |
| `tell-vague-number` | factualGap | MED | contextual | all | never | Check whether a value is needed; ask the author for any missing quantity or condition and leave the source untouched. |
| `tell-weasel` | factualGap | MED | contextual | all | never | Check surrounding citations; ask for a missing source without inventing one or changing the claim. |
| `tell-history` | stylistic | LOW | contextual | generic, readme, runbook, cutover, spec, design, api-reference, migration, security, risk-assessment | review | Describe the current behavior, unless the history explains an active decision. |
| `tell-hedge` | stylistic | LOW | contextual | generic, pr, readme, adr, spec, design, api-reference | review | Keep uncertainty when it is material; otherwise state the condition precisely. |
| `tell-filler` | stylistic | LOW | contextual | all | review | Remove the phrase if the sentence means the same thing without it. |
| `tell-emdash` | stylistic | LOW | contextual | all | review | Use sentence structure or punctuation that makes the relationship explicit. |
| `tell-conclusion` | stylistic | LOW | contextual | all | review | Keep the conclusion only if it adds a decision or next action. |
| `tell-signpost` | stylistic | LOW | contextual | all | review | Use a descriptive heading or state the content directly. |
| `tell-curly` | stylistic | LOW | contextual | all | safe | Use straight quotes if the repository house style requires them. |
| `link-here` | stylistic | LOW | contextual | all | review | Use link text that names the linked document or action. |

## fence-nolang

A code fence has no language label.

Detection: An opening code fence has an empty language/info label.

## frontmatter-unclosed

Opening YAML frontmatter has no closing delimiter.

Detection: An initial frontmatter delimiter has no matching closing delimiter.

## fence-unclosed

Opening code fence has no matching closing marker.

Detection: A code fence has no later empty matching marker of at least its opening length.

## heading-skip

A heading skips a hierarchy level.

Detection: Compare heading depths in document order; PR profiles permit an initial H2.

## heading-one

A document has more than one level-one heading.

Detection: Count H1 headings outside protected regions for applicable profiles.

## table-underfit

A GFM table has fewer than two columns or no data rows.

Detection: Inspect a recognized GFM table with fewer than two columns or no data rows.

## link-dead

A literal local Markdown link target does not exist.

Detection: Resolve literal local link destinations relative to the containing document and check existence.

## section-missing

A profile-relevant section is absent.

Detection: Compare parsed heading titles with the selected profile heading-alias groups.

## tell-notxbuty

A contrast construction may be rhetorical rather than specific.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:is not|isn't|are not|aren't|not just|not only|it's not)\b[^.!?]{2,60}?\b(?:but|rather|it's|it is)\b/i
```

## tell-significance

An importance word may need a supporting consequence or be valid terminology.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:crucial|vital|essential|pivotal|critical|robust|seamless|powerful|comprehensive|cutting-edge|revolutioniz\w*|game.?chang\w*|landscape|testament|delve|key (?:insight|benefit|takeaway|point|factor|advantage|difference|challenge|step))\b/i
```

## tell-vague-number

A quantity word may need an actionable value or bound.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:quickly|slowly|significantly|substantially|dramatically)\b/i
```

## tell-weasel

An attribution phrase may need a named source.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:studies show|research suggests|experts (?:say|agree)|it is (?:widely )?(?:known|believed|understood)|generally considered|some argue)\b/i
```

## tell-history

Historical phrasing can read as changelog material rather than current documentation.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:previously|used to|no longer|now (?:does|uses|reads|returns)|we (?:removed|changed|renamed)|has been (?:updated|changed|moved))\b/i
```

## tell-hedge

A hedge may obscure the intended claim.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:it's worth noting|it should be noted|arguably|somewhat|fairly|relatively|might potentially|could possibly|in general|typically)\b/i
```

## tell-filler

A phrase may add no meaning.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:in order to|due to the fact that|at this point in time|it is important to|when it comes to|in today's|in the world of)\b/i
```

## tell-emdash

Em dashes are dense relative to document prose.

Detection: At least two prose em dashes exceed the configured words-per-occurrence density.

## tell-conclusion

A conclusion signpost may repeat the surrounding content.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:in conclusion|to sum up|ultimately|at the end of the day)\b|\boverall,/i
```

## tell-signpost

A navigation phrase may be redundant.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\b(?:in this section|as mentioned above|let's dive in|we will cover)\b/i
```

## tell-curly

Curly quotation marks conflict with the configured house style.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/[\u2018\u2019\u201C\u201D]/
```

## link-here

Link text does not identify its destination.

Detection: Match the prose pattern outside protected content and accepted terminology; interpretation requires context.

```text
/\[(?:here|this|this doc|link|read more|click here)\]\(/i
```

## Profile section candidates

These are MED contextual factual-gap candidates. They are never automatic edits. Generic documents have no template demand.

| Profile | Heading aliases |
| --- | --- |
| generic | None |
| pr | Summary / Overview / Changes / Purpose; Testing / Tests / Validation / Verification |
| readme | Install / Installation / Quickstart / Getting started; Use / Usage / Quickstart / Examples |
| adr | Context / Status; Decision / Consequences |
| runbook | Procedure / Steps / Runbook; Rollback / Recovery |
| cutover | Rollback / Backout; Validation / Verify |
| spec | Requirements / Scope |
| design | Overview / Context |
| changelog | None |
| incident | Impact; Timeline |
| api-reference | API / Reference / Endpoints / Methods / Parameters / Usage |
| migration | Migration / Plan / Approach; Rollback / Recovery / Backout |
| security | Risk / Threat / Security; Mitigation / Controls / Recovery |
| risk-assessment | Risk / Assessment / Threats; Mitigation / Controls / Recovery |

## Limits

The scanner does not parse every Markdown extension, fetch network links, validate anchors, infer missing facts, or determine whether a prose-to-table rewrite is appropriate. Protected sections match exact heading titles case-insensitively and include their subtree through the next peer or ancestor heading.
