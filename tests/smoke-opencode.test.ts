import { expect, test } from "bun:test"
import { hasCompletedAceStatusInvocation } from "../scripts/smoke-opencode"

test("requires the current adapter's native status result for smoke provenance", () => {
  const status = "No Ace mission exists for this session."
  const expected = `${status}\nAce adapter source: current`
  const completed = (output: string) => JSON.stringify({
    type: "tool_use",
    part: { type: "tool", tool: "ace_status", state: { status: "completed", output } },
  })

  expect(hasCompletedAceStatusInvocation(completed(expected), expected)).toBe(true)
  expect(hasCompletedAceStatusInvocation(completed(status), expected)).toBe(false)
  expect(hasCompletedAceStatusInvocation(completed(`${status}\nAce adapter source: older`), expected)).toBe(false)
  expect(hasCompletedAceStatusInvocation(JSON.stringify({ type: "text", part: { text: expected } }), expected)).toBe(false)
  expect(hasCompletedAceStatusInvocation(JSON.stringify({
    type: "tool_use",
    part: { type: "tool", tool: "ace_status", state: { status: "error", output: expected } },
  }), expected)).toBe(false)
})
