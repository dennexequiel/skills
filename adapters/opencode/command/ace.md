---
description: Own a bounded mission until verified completion or a defined stop condition
agent: build
---

Load and obey the `ace` skill.

Interpret this Ace request according to that skill:

$ARGUMENTS

For a new mission, apply the skill's workflow suitability check before creating state. A user's `/ace <objective>` or `/ace <mode> <objective>` invocation is an explicit Ace request in every mode. Honor the requested mode or infer it from intent without reconfirmation. Mention likely overhead once for an ordinary edit; a short mission in `learn`, `explore`, or `decide` does not need a warning just for being short. When considering Ace implicitly, keep ordinary work in the normal workflow without calling `ace_start`. Existing mission controls preserve the contract and limits.

When starting a mission, inspect context, resolve only consequential ambiguity, define independently verifiable criteria and their evidence, and plan criterion-linked milestones when work spans independent review units. Call `ace_start` and begin execution in this turn.

Use `ace_status`, `ace_progress`, `ace_pause`, `ace_resume`, `ace_cancel`, and `ace_clear` for their matching controls. Status defaults to a summary. Use `detail=current` for checked source identity and recovery with the complete current contract and constraints. Request detailed criteria or historical `full` and `audit` views when needed. Do not reload audit history on each continuation.

Read the current source identity before verification and provide the checked identity with structured evidence. Source changes in unfinished missions require fresh checks. Completed and cancelled status describes the recorded terminal snapshot; later work starts a new mission when needed. Record evidence during execution, not only when completing the mission.

Use `ace_revise` and `ace_accept_exception` only to record actual user decisions. Include the decision reference and approver. A user-authorized resume opens a finite execution window and preserves prior windows. A request to complete triggers a fresh audit and `ace_complete`; it never bypasses evidence requirements. Use `ace_close_with_qualifications` only when each unmet criterion has a current user-accepted qualification. A paused or limited mission can close directly without resuming implementation.
