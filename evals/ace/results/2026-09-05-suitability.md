# Ace Workflow Suitability Review

The [recorded exercise](2026-09-05-suitability.json) supplies the portable skill and 14 independent scenarios to GPT-5.6 Sol with medium reasoning through herdr. The agent receives no expected answers or earlier results. The record preserves the request, response, skill hash, and native usage.

## Observed Routing

| Scenarios | Observed workflow |
| --- | --- |
| Known bug with tests, vague settings improvement, long build, documentation about Ace | Normal workflow |
| Explicit Ace typo fix and an acknowledged small-task override | Ace, without reconfirmation or a repeated overhead notice |
| Dependent migration stages and verification waiting on vendor data | Ace, with the existing scope and evidence preserved |
| Final assertion in an active mission | Continue the existing mission within its remaining limit |
| Focused OAuth learning mission | Ace `learn`, preserving the user's architecture choice |
| Twenty-minute benchmark investigation | Ace `explore`, preserving the time limit and no-edit constraint |
| Bounded comparison against agreed criteria | Ace `decide`, preserving the user's final call |
| Casual brainstorming and a quick readability comparison | Normal workflow |

All 14 workflow choices match the intended routing. No response asks the user to select or reconfirm a mode. The learning response asks for an architecture decision that the user explicitly reserves. The external-wait response identifies the host's lack of automatic resumption.

## Evidence Limits

This exercise tests proposed routing and first responses with the skill already supplied. It does not execute the hypothetical tasks, test automatic host discovery, or establish token savings. The decision scenario includes a future session, so it does not independently isolate the single-session decision boundary. Execution windows, evidence collection, and actual learning outcomes still need mission-level evaluation.

The repository check passes 65 tests and validates the skill, evaluation fixtures, routing coverage, and generated catalog. Those checks establish contract and packaging consistency; they do not guarantee model behavior.
