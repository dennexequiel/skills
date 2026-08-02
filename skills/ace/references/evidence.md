# Completion Evidence

Completion evidence must be fresh, relevant, and authoritative enough for the claim.

## Evidence Ladder

Prefer the highest practical level:

1. Direct observation of the required behavior in its real execution path.
2. An automated integration or end-to-end check that exercises that path.
3. A focused automated test for the changed behavior.
4. Static validation such as type checking, schema validation, or linting.
5. Manual inspection of the final artifact or diff.
6. Reasoning, a summary, or another agent's claim.

Lower levels can support higher levels but should not replace them when the criterion requires runtime behavior.

## Criterion Mapping

Write criteria so one evidence statement can prove each one:

```text
Criterion: Existing saved documents open without data loss.
Evidence: Migration fixture suite passes for versions 1-4, including the retained-data assertions.
```

Weak evidence describes activity: "updated migration code" or "tests look good."

## Freshness

Evidence is stale after a relevant code, configuration, fixture, environment, or dependency change. Re-run affected checks after the final relevant change.

## Broad Claims

Match proof breadth to claim breadth:

- "This function works" may need a focused unit test.
- "The login flow works" needs the complete login path.
- "The project is ready" needs the repository's prescribed full checks plus artifact inspection.
- "This is secure" is not a finishable absolute; define a threat model, scope, controls, and residual risks.

If an authoritative check cannot run, record the criterion as unmet or explicitly renegotiate it with the user. Do not silently lower the bar.
