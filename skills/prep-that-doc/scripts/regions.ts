type Range = { start: number; end: number }

export type Heading = { line: number; depth: number; title: string; start: number; end: number }
export type Table = { line: number; columns: number; rows: number; text: string }
export type MarkdownRegions = {
  prose: string
  linkSource: string
  fences: Array<{ line: number; info: string; text: string }>
  headings: Heading[]
  tables: Table[]
  unclosedFence?: { line: number; text: string }
  unclosedFrontmatter?: { line: number; text: string }
  generatedReason?: string
}

const FENCE = /^(?: {0,3})(`{3,}|~{3,})(.*)$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/
const FRONTMATTER = /^(---|\.\.\.)\s*$/
const QUOTE = /^ {0,3}>/
const INDENTED_CODE = /^(?: {4}|\t)/
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*\S/
const GENERATED = /@generated|(?:code |file |document )?generated (?:by|file|document)|do not edit/i
const TABLE_DIVIDER_CELL = /^\s*:?-{3,}:?\s*$/
const PATH_OR_COMMAND = /(?:\B(?:\.?\.?\/|\/)[A-Za-z0-9_.@%+~=:/\\-]+|\b(?:git|bun|node|npm|pnpm|yarn|curl|docker|kubectl)\s+[\w@./:=\-]+|\bv?\d+(?:\.\d+){1,3}\b)/g
const CITATION = /\[(?:@[^\]]+|\^[^\]]+)\]/g

function maskRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " "
  }
}

function lineOffsets(source: string): number[] {
  const offsets = [0]
  for (let index = 0; index < source.length; index += 1) if (source[index] === "\n") offsets.push(index + 1)
  return offsets
}

function lineEnd(source: string, start: number): number {
  const end = source.indexOf("\n", start)
  return end === -1 ? source.length : end
}

function tableCells(line: string): string[] | undefined {
  const trimmed = line.trim()
  if (!trimmed.includes("|")) return undefined
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "")
  const cells: string[] = []
  let current = ""
  let ticks = 0
  let escaped = false
  for (const character of body) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === "\\") {
      current += character
      escaped = true
    } else if (character === "`") {
      current += character
      ticks = ticks === 0 ? 1 : 0
    } else if (character === "|" && ticks === 0) {
      cells.push(current)
      current = ""
    } else current += character
  }
  cells.push(current)
  return cells
}

function isDivider(line: string): boolean {
  const cells = tableCells(line)
  return Boolean(cells?.length && cells.every((cell) => TABLE_DIVIDER_CELL.test(cell)))
}

function inlineRanges(source: string): Range[] {
  const ranges: Range[] = []
  const runs = [...source.matchAll(/`+/g)]
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index]
    if (!opening || opening.index === undefined) continue
    let slashes = 0
    for (let before = opening.index - 1; before >= 0 && source[before] === "\\"; before -= 1) slashes += 1
    if (slashes % 2) continue
    const end = runs.findIndex((run, position) => position > index && run[0].length === opening[0].length && !/\n[ \t]*\n/.test(source.slice(opening.index, run.index)))
    const closing = runs[end]
    if (closing?.index !== undefined) {
      ranges.push({ start: opening.index, end: closing.index + closing[0].length })
      index = end
    }
  }
  return ranges
}

export type InlineLink = Range & { targetStart: number; targetEnd: number; target: string; image: boolean }

export function inlineLinks(source: string): InlineLink[] {
  const links: InlineLink[] = []
  let previousEnd = 0
  for (const match of source.matchAll(/\[/g)) {
    const bracket = match.index
    if (bracket === undefined || bracket < previousEnd || source[bracket - 1] === "\\") continue
    const image = source[bracket - 1] === "!"
    const start = image ? bracket - 1 : bracket
    let labelEnd = bracket + 1
    let labelDepth = 1
    for (; labelEnd < source.length; labelEnd += 1) {
      if (source[labelEnd] === "\\") { labelEnd += 1; continue }
      if (source[labelEnd] === "[") labelDepth += 1
      if (source[labelEnd] === "]") labelDepth -= 1
      if (labelDepth === 0) break
    }
    if (source[labelEnd + 1] !== "(") continue
    let cursor = labelEnd + 2
    while (/[ \t]/.test(source[cursor] ?? "")) cursor += 1
    const angle = source[cursor] === "<"
    if (angle) cursor += 1
    const targetStart = cursor
    let depth = 0
    while (cursor < source.length) {
      const character = source[cursor]
      if (character === "\\" && cursor + 1 < source.length) { cursor += 2; continue }
      if (angle ? character === ">" : depth === 0 && /[\s)]/.test(character ?? "")) break
      if (!angle && character === "(") depth += 1
      if (!angle && character === ")") depth -= 1
      if (character === "\n") break
      cursor += 1
    }
    const targetEnd = cursor
    if (angle && source[cursor++] !== ">") continue
    while (/[ \t]/.test(source[cursor] ?? "")) cursor += 1
    if (source[cursor] === '"' || source[cursor] === "'" || source[cursor] === "(") {
      const openingTitle = source[cursor++]
      const quote = openingTitle === "(" ? ")" : openingTitle
      while (cursor < source.length && source[cursor] !== quote && source[cursor] !== "\n") cursor += source[cursor] === "\\" ? 2 : 1
      if (source[cursor++] !== quote) continue
      while (/[ \t]/.test(source[cursor] ?? "")) cursor += 1
    }
    if (source[cursor] !== ")") continue
    links.push({ start, end: cursor + 1, targetStart, targetEnd, target: source.slice(targetStart, targetEnd), image })
    previousEnd = cursor + 1
  }
  return links
}

export function normalizeHeadingTitle(title: string): string {
  return title.replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|\*|_|`+)(.*?)\1/g, "$2").trim()
}

export function parseMarkdownRegions(source: string): MarkdownRegions {
  const lines = source.split(/\n/)
  const offsets = lineOffsets(source)
  const chars = source.split("")
  const linkChars = source.split("")
  const blocked = new Array<boolean>(lines.length).fill(false)
  const headings: Heading[] = []
  const tables: Table[] = []
  const fences: MarkdownRegions["fences"] = []
  let unclosedFence: MarkdownRegions["unclosedFence"]
  let unclosedFrontmatter: MarkdownRegions["unclosedFrontmatter"]
  let generatedReason: string | undefined
  const protect = (start: number, end: number): void => {
    maskRange(chars, start, end)
    maskRange(linkChars, start, end)
  }
  const protectLine = (line: number): void => {
    blocked[line] = true
    const offset = offsets[line] ?? 0
    protect(offset, lineEnd(source, offset))
  }

  let index = 0
  const firstMetadata = lines.slice(1).find((line) => line.trim() && !/^\s*#/.test(line)) ?? ""
  const hasMetadata = /^(?:[\w.-]+|"[^"]+"|'[^']+'):(?:\s|$)/.test(firstMetadata) || FRONTMATTER.test(firstMetadata)
  if (lines[0]?.replace(/^\uFEFF/, "").replace(/\r$/, "") === "---" && hasMetadata) {
    let end = 1
    while (end < lines.length && !FRONTMATTER.test((lines[end] ?? "").replace(/\r$/, ""))) end += 1
    for (let line = 0; line <= Math.min(end, lines.length - 1); line += 1) protectLine(line)
    if (end === lines.length) unclosedFrontmatter = { line: 1, text: lines[0] ?? "" }
    if (lines.slice(1, end).some((line) => /^generated:\s*true\s*$/i.test(line))) generatedReason = "generated frontmatter flag"
    index = end + 1
  }

  const codeSpans = inlineRanges(source)
  let inComment = false
  let quoteContinuation = false
  for (; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").replace(/\r$/, "")
    const offset = offsets[index] ?? 0
    const opening = !inComment && line.match(FENCE)
    if (opening && !(opening[1]?.startsWith("`") && (opening[2] ?? "").includes("`"))) {
      quoteContinuation = false
      const marker = opening[1] ?? ""
      const info = (opening[2] ?? "").trim()
      fences.push({ line: index + 1, info, text: line })
      const openingLine = index
      protectLine(index)
      let closed = false
      for (let next = index + 1; next < lines.length; next += 1) {
        protectLine(next)
        const candidate = (lines[next] ?? "").replace(/\r$/, "").match(FENCE)
        const closingMarker = candidate?.[1]
        if (closingMarker && closingMarker[0] === marker[0] && closingMarker.length >= marker.length && !(candidate?.[2] ?? "").trim()) {
          index = next
          closed = true
          break
        }
      }
      if (!closed) { unclosedFence = { line: openingLine + 1, text: line }; break }
      continue
    }
    if (!inComment && (QUOTE.test(line) || quoteContinuation && line.trim() && !/^ {0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s)/.test(line))) {
      protectLine(index)
      quoteContinuation = true
      continue
    }
    quoteContinuation = false
    if (!inComment && (INDENTED_CODE.test(line) || /^\s*(?:\$|%)\s+\S/.test(line) || /^(?:git|bun|node|npm|pnpm|yarn|curl|docker|kubectl)\s+\S/.test(line))) {
      protectLine(index)
      continue
    }
    let cursor = 0
    while (cursor < line.length) {
      const start = inComment ? cursor : line.indexOf("<!--", cursor)
      if (start === -1) break
      if (!inComment && codeSpans.some((range) => range.start <= offset + start && range.end > offset + start)) { cursor = start + 4; continue }
      if (!inComment && index < 8 && GENERATED.test(line.slice(start))) generatedReason = "generated document comment"
      const end = line.indexOf("-->", start + (inComment ? 0 : 4))
      const last = end === -1 ? line.length : end + 3
      protect(offset + start, offset + last)
      inComment = end === -1
      cursor = last
    }
    if (REFERENCE_DEFINITION.test(line)) maskRange(chars, offset, offset + line.length)
  }

  const headingLines = linkChars.join("").split("\n")
  // Inline code can cross line breaks. Matching runs must have exactly the same length.
  for (const range of inlineRanges(linkChars.join(""))) protect(range.start, range.end)
  const structuralLines = linkChars.join("").split("\n")
  for (let line = 1; line < lines.length; line += 1) {
    if (blocked[line] || blocked[line - 1] || !isDivider(structuralLines[line] ?? "")) continue
    const header = tableCells(structuralLines[line - 1] ?? "")
    const divider = tableCells(structuralLines[line] ?? "")
    if (!header || header.length !== divider?.length) continue
    let end = line + 1
    while (end < lines.length && !blocked[end] && tableCells(structuralLines[end] ?? "")) end += 1
    for (let tableLine = line - 1; tableLine < end; tableLine += 1) {
      const offset = offsets[tableLine] ?? 0
      maskRange(chars, offset, lineEnd(source, offset))
      blocked[tableLine] = true
    }
    tables.push({ line, columns: header.length, rows: end - line - 1, text: lines[line - 1] ?? "" })
    line = end - 1
  }

  for (let line = 0; line < lines.length; line += 1) {
    if (blocked[line]) continue
    const text = (structuralLines[line] ?? "").replace(/\r$/, "")
    const match = text.match(HEADING)
    const start = offsets[line] ?? 0
    if (match?.[1] && match[2]) {
      headings.push({ line: line + 1, depth: match[1].length, title: normalizeHeadingTitle((headingLines[line] ?? "").match(HEADING)?.[2] ?? match[2]), start, end: start + text.length })
    } else if (line > 0 && !blocked[line - 1] && /^ {0,3}(?:=+|-+)\s*$/.test(text) && headingLines[line - 1]?.trim() && !/^\s*(?:[-+*]|\d+[.)])\s/.test(structuralLines[line - 1] ?? "")) {
      const title = headingLines[line - 1]?.trim() ?? ""
      if (!headings.some((heading) => heading.line === line)) headings.push({ line, depth: text.trim()[0] === "=" ? 1 : 2, title, start: offsets[line - 1] ?? 0, end: start + text.length })
    }
  }

  const linkSource = linkChars.join("")
  for (const link of inlineLinks(linkSource)) {
    maskRange(chars, link.image ? link.start : link.targetStart, link.image ? link.end : link.end - 1)
  }
  for (const match of linkSource.matchAll(CITATION)) if (match.index !== undefined) maskRange(chars, match.index, match.index + match[0].length)
  for (const pattern of [PATH_OR_COMMAND, /https?:\/\/[^\s<>]+/g, /\b[\w.-]+\.(?:md|markdown|json|ya?ml|[cm]?[jt]sx?|sh|txt|toml|png|svg)\b/g]) {
    for (const match of linkSource.matchAll(pattern)) if (match.index !== undefined) maskRange(chars, match.index, match.index + match[0].length)
  }
  for (const match of chars.join("").matchAll(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|“[^”\n]*”|‘[^’\n]*’/g)) {
    const start = match.index
    if (start === undefined) continue
    if (match[0][0] === "'" && /[\p{L}\p{N}]/u.test(source[start - 1] ?? "")) continue
    protect(start, start + match[0].length)
  }
  return { prose: chars.join(""), linkSource: linkChars.join(""), headings, tables, fences,
    ...(unclosedFence ? { unclosedFence } : {}),
    ...(unclosedFrontmatter ? { unclosedFrontmatter } : {}),
    ...(generatedReason ? { generatedReason } : {}),
  }
}

export function locationReader(source: string): (offset: number) => { line: number; column: number } {
  const offsets = lineOffsets(source)
  return (offset) => {
    let low = 0
    let high = offsets.length
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2)
      if ((offsets[middle] ?? 0) <= offset) low = middle
      else high = middle
    }
    return { line: low + 1, column: offset - (offsets[low] ?? 0) + 1 }
  }
}

export function protectedSectionLines(headings: readonly Heading[], lines: number, titles: readonly string[]): Set<number> {
  const wanted = new Set(titles.map((title) => title.trim().toLowerCase()))
  const excluded = new Set<number>()
  for (const [index, heading] of headings.entries()) {
    if (!wanted.has(heading.title.trim().toLowerCase())) continue
    let end = lines
    for (const later of headings.slice(index + 1)) {
      if (later.depth <= heading.depth) {
        end = later.line - 1
        break
      }
    }
    for (let line = heading.line; line <= end; line += 1) excluded.add(line)
  }
  return excluded
}
