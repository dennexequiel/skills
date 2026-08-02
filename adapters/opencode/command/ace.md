---
description: Own a bounded mission until verified completion or a defined stop condition
agent: build
---

Load and obey the `ace` skill.

Interpret this Ace request according to that skill:

$ARGUMENTS

For a new mission, inspect context, resolve only consequential ambiguity, define measurable acceptance criteria and verification evidence, call `ace_start`, and begin execution in this turn. Use `ace_status`, `ace_progress`, `ace_pause`, `ace_resume`, `ace_cancel`, and `ace_clear` for their matching controls. A request to complete triggers a fresh audit and `ace_complete`; it never bypasses evidence requirements.
