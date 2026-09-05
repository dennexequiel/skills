# CSV Export Mission

State: paused.
Objective: Preserve field contents when exporting one CSV row.
C1: Commas, quotes, CR, LF, empty strings, and Unicode round-trip as field contents.
C2: An external vendor accepts the export.
Verification: Local tests for C1. Vendor ingestion for C2.
Constraints: No network, dependencies, commits, other agents, or changes outside this workspace. Preserve existing tests. The vendor check is unavailable locally.
Prior usage: One closed window, 60 seconds, one iteration, zero automatic continuations. Historical start and end timestamps are unavailable.
Next action: Correct and verify the local formatter.
