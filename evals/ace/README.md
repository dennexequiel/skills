# Ace Evaluations

`evals.json` contains portable behavior scenarios. Evaluate both expected behaviors and anti-patterns; keyword matching alone is insufficient.

`triggers.json` separates positive, negative, and ambiguous routing prompts. Repository checks enforce coverage and exact prompt uniqueness. Live host/model selection evals remain a separate, optional layer because deterministic fixture validation cannot prove model routing behavior.

The cases emphasize the boundaries most likely to regress:

- turning vague aspirations into finishable missions,
- avoiding needless questions when context is sufficient,
- preserving user reasoning in learning mode,
- respecting authorization boundaries,
- stopping stalled work without claiming success.
