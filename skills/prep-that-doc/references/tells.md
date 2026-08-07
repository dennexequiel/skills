# Tells

Style rules and how to detect them. Each rule has an id, a detection pattern, and what to do. Patterns are `grep -nE` ready and are meant to over-match. Classify every hit before editing.

Severity: HIGH changes what the reader understands. MED slows them down. LOW is polish.

## Content

### `tell-empty` HIGH

A sentence that can be deleted with no loss of information. The most common defect in generated docs and the hardest to regex.

Test each sentence: delete it, reread the paragraph. If nothing is missing, it was decoration.

Common shapes: restating the heading, announcing what the next section will say, summarizing what the previous section just said, asserting that something is important without saying why.

### `tell-significance` HIGH

Claims of importance with no evidence attached.

```sh
grep -nE '\b(crucial|vital|essential|pivotal|key|critical|robust|seamless|powerful|comprehensive|cutting-edge|game.?chang|revolutioniz|landscape|testament|delve)\b' FILE
```

Replace with the fact the word was standing in for. "Plays a vital role in routing" becomes "routes every request". If no fact exists, delete the sentence.

### `tell-vague-number` HIGH

Quantities the reader needs, stated as adjectives.

```sh
grep -nE '\b(quickly|slowly|significantly|substantially|dramatically)\b' FILE
```

In engineering docs these are usually `needs-author`. "Should finish quickly" in a cutover plan is a defect. Mark `[ADD: expected duration?]`.

Bare count words such as "several", "many", and "a few" are deliberately excluded. They are legitimate far more often than not, and including them buries the adverbs above in noise. Judge counts by reading, not by pattern.

### `tell-history` MED

Documenting the change instead of the present state. Docs outlive the change, and a reader who never saw the old version cannot use a changelog entry as reference.

```sh
grep -nE '\b(previously|used to|no longer|now (does|uses|reads|returns)|we (removed|changed|renamed)|has been (updated|changed|moved))\b' FILE
```

Rewrite as present tense description. "Changed the middleware to read tokens from headers" becomes "The middleware reads tokens from headers." CHANGELOGs are exempt, they exist to record history.

### `tell-weasel` MED

Attribution with nobody behind it.

```sh
grep -nE '\b(studies show|research suggests|it is (widely )?(known|believed|understood)|experts (say|agree)|generally considered|some argue)\b' FILE
```

Name the source or drop the claim. Never invent a citation.

## Sentences

### `tell-notxbuty` HIGH

Negative parallelism. The strongest single marker of generated prose.

```sh
grep -nE "(isn't|is not|aren't|are not|not just|not only|it's not) [^.]{2,60}(but|it's|it is|rather)" FILE
```

Three-way triage:

1. Nobody actually believes X. Delete the negation, assert Y with evidence.
2. The contrast is real. Name who holds X and why Y beats it concretely.
3. The sentence asserts nothing. Delete it. This is most cases.

These count as the same rule, not as fixes: "less about X than Y", "the real X is Y", "the question isn't X, it's Y", and the em dash variant.

### `tell-triple` MED

Three-item lists where the third item carries no information, present because the rhythm wanted a third.

Keep the items that differ. If all three are real, break the rhythm so they read as content rather than cadence.

### `tell-range` MED

"From X to Y" where no meaningful midpoint exists. If you cannot name what sits between them, it is not a range. Name the two things or cut one.

### `tell-hedge` MED

```sh
grep -nE "\b(it's worth noting|it should be noted|arguably|somewhat|fairly|relatively|might potentially|could possibly|in general|typically)\b" FILE
```

Commit or cut. A genuine caveat states its condition: "above 10k rows" beats "in some cases".

**Exempt in risk-bearing documents.** In a cutover plan, runbook, incident writeup, risk assessment, or security note, qualified language is usually calibrated uncertainty, and that calibration is data. "May cause data loss" and "causes data loss" are different claims, and only the author knows which is true. Treat these as `needs-author` and ask. Never sharpen a hedge into a certainty, and never soften a certainty into a hedge.

### `tell-filler` MED

```sh
grep -nE "\b(in order to|due to the fact that|at this point in time|it is important to|when it comes to|in today's|in the world of)\b" FILE
```

"In order to" becomes "to". Opening throat-clearing gets deleted outright.

### `tell-signpost` LOW

Announcing structure the headings already provide. "In this section we will cover", "As mentioned above", "Let's dive in". Delete. The heading did the job.

### `tell-conclusion` LOW

```sh
grep -nE "\b(in conclusion|to sum up|ultimately|at the end of the day|overall,)" FILE
```

Stop when the point is made. Engineering docs end at the last useful sentence.

## Formatting

### `tell-emdash` MED

```sh
grep -nE '—|–' FILE
```

Not banned. The tell is density and the parenthetical-pair habit. Budget roughly one per 150 words, never two in a sentence. Most convert to a period, a comma, or a colon. A pair fencing an aside usually wanted parentheses or its own sentence.

### `tell-bold` MED

```sh
grep -nE '\*\*[^*]+\*\*' FILE
```

Bold marks a term the reader scans for, such as a label starting a list item. Bold scattered mid-paragraph for emphasis is noise, and a paragraph with three bolded phrases has none.

### `tell-curly` LOW

```sh
grep -nP '[\x{2018}\x{2019}\x{201C}\x{201D}]' FILE
```

Use straight ASCII quotes and apostrophes in engineering docs. Curly quotes break copy-paste into terminals and code.

### `tell-cadence` MED

Runs of three or more consecutive sentences within a few words of the same length, or a paragraph where every sentence has the same subject-verb-elaboration shape. Read it aloud. Metronomic rhythm is the tell.

Vary deliberately. Do not alternate long and short on a schedule, which is its own pattern.

### `tell-acronym` LOW

An ambiguous or project-specific acronym used before it is introduced. Expand on first use per file, then use the short form. Widely known ones such as API, HTTP, URL, CLI, and IDE need no introduction.
