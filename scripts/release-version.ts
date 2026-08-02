import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { repositoryRoot } from "./skill-data"

const PRERELEASE_IDENTIFIER = "(?:0|[1-9]\\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)"
const SEMVER_PATTERN = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
)

export function requireReleaseVersion(value: unknown): string {
  if (typeof value !== "string" || !SEMVER_PATTERN.test(value)) {
    throw new Error(`package.json version must be valid SemVer, received ${JSON.stringify(value)}`)
  }
  return value
}

if (import.meta.main) {
  const packagePath = resolve(repositoryRoot, "package.json")
  const packageData = JSON.parse(await readFile(packagePath, "utf8")) as { version?: unknown }
  console.log(requireReleaseVersion(packageData.version))
}
