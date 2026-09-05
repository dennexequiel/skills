# Cache Expiration Mission

State: active.
Objective: Correct expiration without changing the public cache interface.
C1: Values expire exactly at their deadline; a zero-duration entry expires immediately.
C2: Overwriting a key renews its deadline and preserves false, zero, and empty-string values before expiry.
Verification: Tests using the injected clock, without sleeping.
Constraints: No network, dependencies, commits, other agents, or changes outside this workspace. Preserve existing tests and the injected clock API.
Limits: Three minutes of local execution.
Next action: Reproduce the reported boundary failure and verify the smallest correction.
