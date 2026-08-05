# Prep That Doc Evaluations

`evals.json` contains portable behavior scenarios. Evaluate both expected behaviors and anti-patterns; keyword matching alone is insufficient.

`triggers.json` separates positive, negative, and ambiguous routing prompts. Repository checks enforce coverage and exact prompt uniqueness. Live host/model selection evals remain a separate, optional layer because deterministic fixture validation cannot prove model routing behavior.

The cases emphasize the boundaries most likely to regress:

- naming the element the content actually is, rather than fixing prose inside the wrong container,
- honoring the difference between a review request and a fix request,
- leaving gaps as author placeholders instead of inventing facts,
- gating rules on document type so intentional shapes are not reported as defects,
- stopping before overcorrection, since a zero finding count is not the goal,
- verifying a rewrite with a second detection pass on the edited file.
