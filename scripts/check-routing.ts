import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { loadSkills, repositoryRoot } from "./skill-data"

type TriggerCases = {
  skill: string
  version: number
  positive: string[]
  negative: string[]
  ambiguous: Array<{ prompt: string; expected: string }>
}

const TRIGGER_SCHEMA_VERSION = 1
const MINIMUM_POSITIVE_PROMPTS = 5
const MINIMUM_NEGATIVE_PROMPTS = 5
const MINIMUM_AMBIGUOUS_PROMPTS = 2
const MINIMUM_TOKEN_LENGTH = 3
const MAXIMUM_DESCRIPTION_SIMILARITY = 0.65
const STOP_WORDS = new Set(["a", "an", "and", "asks", "for", "from", "in", "is", "it", "of", "or", "the", "to", "use", "user", "when", "with"])

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length >= MINIMUM_TOKEN_LENGTH && !STOP_WORDS.has(token)) ?? [])
}

function similarity(left: string, right: string): number {
  const leftTokens = tokens(left)
  const rightTokens = tokens(right)
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union ? intersection / union : 0
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

const skills = await loadSkills()
const seenPrompts = new Map<string, { skills: Set<string>; kind: string }>()

for (const skill of skills) {
  const path = resolve(repositoryRoot, "evals", skill.name, "triggers.json")
  const cases = JSON.parse(await readFile(path, "utf8")) as TriggerCases
  if (cases.skill !== skill.name || cases.version !== TRIGGER_SCHEMA_VERSION) throw new Error(`${skill.name} has invalid trigger metadata`)
  if (cases.positive.length < MINIMUM_POSITIVE_PROMPTS) throw new Error(`${skill.name} needs at least ${MINIMUM_POSITIVE_PROMPTS} positive trigger prompts`)
  if (cases.negative.length < MINIMUM_NEGATIVE_PROMPTS) throw new Error(`${skill.name} needs at least ${MINIMUM_NEGATIVE_PROMPTS} negative trigger prompts`)
  if (cases.ambiguous.length < MINIMUM_AMBIGUOUS_PROMPTS) throw new Error(`${skill.name} needs at least ${MINIMUM_AMBIGUOUS_PROMPTS} ambiguous trigger prompts`)

  const prompts = [
    ...cases.positive.map((prompt) => [prompt, "positive"] as const),
    ...cases.negative.map((prompt) => [prompt, "negative"] as const),
    ...cases.ambiguous.map(({ prompt }) => [prompt, "ambiguous"] as const),
  ]
  for (const [prompt, kind] of prompts) {
    if (!prompt.trim()) throw new Error(`${skill.name} has an empty ${kind} trigger prompt`)
    const key = normalized(prompt)
    const previous = seenPrompts.get(key)
    if (previous) {
      const sharedNegative = previous.kind === "negative" && kind === "negative" && !previous.skills.has(skill.name)
      if (!sharedNegative) {
        const owners = [...previous.skills].map((owner) => `${owner}:${previous.kind}`).join(", ")
        throw new Error(`Trigger prompt collision between ${owners} and ${skill.name}:${kind}: ${prompt}`)
      }
      previous.skills.add(skill.name)
    } else {
      seenPrompts.set(key, { skills: new Set([skill.name]), kind })
    }
  }
  for (const entry of cases.ambiguous) {
    if (!entry.expected.trim()) throw new Error(`${skill.name} has an ambiguous prompt without expected routing`)
  }
}

for (let left = 0; left < skills.length; left += 1) {
  for (let right = left + 1; right < skills.length; right += 1) {
    const leftSkill = skills[left]
    const rightSkill = skills[right]
    if (!leftSkill || !rightSkill) throw new Error("Skill catalog changed during routing validation")
    const overlap = similarity(leftSkill.description, rightSkill.description)
    if (overlap >= MAXIMUM_DESCRIPTION_SIMILARITY) {
      throw new Error(`Description collision risk: ${leftSkill.name} and ${rightSkill.name} overlap by ${Math.round(overlap * 100)}%`)
    }
  }
}

console.log(`Validated routing coverage for ${skills.length} skill${skills.length === 1 ? "" : "s"} across ${seenPrompts.size} prompts`)
