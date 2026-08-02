const process = Bun.spawn(["opencode", "run", "--command", "ace", "status"], {
  stdin: "ignore",
  stdout: "pipe",
  stderr: "pipe",
})
const [exitCode, stdout, stderr] = await Promise.all([
  process.exited,
  new Response(process.stdout).text(),
  new Response(process.stderr).text(),
])
const output = `${stdout}\n${stderr}`

if (exitCode !== 0) {
  throw new Error(`OpenCode Ace smoke test exited with ${exitCode}:\n${output}`)
}
if (!output.includes("ace_status") || !output.includes("No Ace mission exists for this session.")) {
  throw new Error(`OpenCode did not invoke ace_status as expected:\n${output}`)
}

console.log("OpenCode loaded Ace and invoked ace_status")
