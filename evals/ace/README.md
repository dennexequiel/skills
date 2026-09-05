# Ace Evaluations

`evals.json` contains portable behavior scenarios. Evaluate both expected behaviors and anti-patterns; keyword matching alone is insufficient.

`triggers.json` separates positive, negative, and ambiguous routing prompts. Repository checks enforce coverage and exact prompt uniqueness. Live host/model selection evals remain a separate, optional layer because deterministic fixture validation cannot prove model routing behavior.

The cases emphasize the boundaries most likely to regress:

- choosing the normal workflow for ordinary work without creating mission state,
- honoring explicit Ace requests and preserving existing missions through small final steps,
- preserving bounded learning, exploration, and decision missions without mode-selection friction,
- adopting Ace when recovery, external waits, or substantial dependent milestones require it,
- turning vague aspirations into finishable missions,
- avoiding needless questions when context is sufficient,
- preserving user reasoning in learning mode,
- respecting authorization boundaries,
- stopping stalled work without claiming success,
- enforcing the time allowance during user-driven work and preserving execution history,
- invalidating proof after tracked or untracked source changes,
- distinguishing fresh proof, accepted baselines, and external follow-ups,
- preserving existing authorization while planning independent delivery units.

The adapter regression suite exercises state transitions and structured evidence in temporary workspaces. It cannot establish that an agent ran a claimed check or accurately captured user intent. Behavioral evaluation must inspect actual actions and artifacts, including the source state a check covered.

For promotion, exercise a representative mission with pause/resume, a source change after verification, a user-accepted qualification, and a final criterion matrix. Record the model, skill source revision, artifacts, and result. Compare the same request without the skill when running model evaluations. Host packaging checks and schema-valid eval fixtures provide different evidence from an executed mission.

The [stabilization evaluation](results/2026-09-05.md) records a paired portable run, independent test results, and the limits of that evidence.

The [efficiency protocol](efficiency/README.md) measures current-context growth separately from model behavior. It provides matched portable fixtures, a command-based runner, and host-specific usage normalization without imposing a particular harness or model on the skill.

The [workflow suitability review](results/2026-09-05-suitability.md) records routing for ordinary work, explicit requests, existing missions, and bounded learning, exploration, and decision modes. It evaluates proposed first responses rather than executed missions or token savings.
