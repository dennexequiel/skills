# Contextual Prose Review

Use this reference when the request includes prose cleanup or a detector candidate needs interpretation. The [generated rule reference](rules.md) is the authority for mechanical patterns, severity, confidence, profiles, actions, and autofix boundaries. Do not maintain a second list of regular expressions.

## Meaning Before Tokens

A word is evidence of its occurrence, not of bad writing. "Essential" can name an accessibility requirement. "Critical" can describe an incident severity. "Key" can name a credential. Preserve named terminology and classify the sentence in context.

An importance claim warrants a question when the reader needs the reason and the document supplies none. Replace it only with a fact already supported by the source. Do not invent evidence or delete an operational claim to make a token disappear.

A contrast is useful when it distinguishes two real alternatives. Keep the distinction when removing its wording would change the claim. Negative phrasing alone cannot establish a defect.

## Quantities, Sources, And Uncertainty

An adjective is a gap when a reader needs a measurable value to act. "Roll back if latency rises significantly" lacks a decision boundary unless another section supplies it. Report the missing metric, threshold, or observation window as a question; leave the source untouched.

Attribution needs enough information for the reader to locate the source. Check existing links, citations, and surrounding context before reporting a missing reference. Never invent a citation or treat a protected citation string as prose to polish.

Qualified language in risk-bearing documents carries meaning. Preserve likelihood, uncertainty, scope, and conditions exactly. "May cause stale reads" must not become "causes stale reads." Do not classify every qualification as `needs-author`; use that classification only when resolving a relevant issue requires an unavailable fact.

## Historical Language

CHANGELOGs, incident timelines, PR descriptions, and architecture decisions often need history. Present-state prose is useful for reference instructions, but it must not erase causal explanations, decisions, or recorded outcomes.

## Rhythm And Emphasis

Assess punctuation by how it affects reading. Sparse em dashes, deliberate definition separators, quoted material, and numeric ranges do not need cleanup. A scanner's density candidate still needs contextual judgment.

Bold can mark a term, warning, or value that readers need to find. Remove emphasis only when that purpose is absent. Do not treat all lists, three-part statements, or repeated sentence lengths as defects.

A sentence may be redundant in a narrative and necessary at a dangerous step. Test whether deleting it loses a condition, connection, navigation cue, warning, or audience-specific explanation. Preserve useful repetition.

## Style Settings

Use accepted terminology and house style from the repository configuration. Curly quotes in ordinary prose are a style choice; code and commands are protected regardless of quote settings. A style pass must never change their bytes to satisfy prose preferences.

Default scans omit LOW candidates. Use strict scanning when the user asks for detailed style polish, then discard intentional and protected matches before editing. The goal is useful writing, not an empty report.
