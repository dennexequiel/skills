# Prep That Slide Evaluations

`evals.json` contains portable agent scenarios with expected behavior and anti-patterns. `triggers.json` covers presentation requests, unrelated PDF operations and ambiguous document-polish requests. Repository checks validate their structure and prompt uniqueness; they do not run the scenarios or establish model success.

Judge the produced files and observable actions: preserved facts and notes, requested formats, user preferences, readable layouts, editing permissions and accurate delivery claims. The cases include existing PowerPoint decks, connected Google Slides, unavailable tools, dense-page repair, charts and progress indicators.

## Run The Checks

Run commands from the repository root. `bun run check` runs the repository checks, including evaluation schemas. The browser checks below also require existing Node.js, Playwright and a Chromium-compatible browser. The preset check needs Poppler's `pdfinfo` on PATH. These commands do not install dependencies.

```sh
bun run check
node evals/prep-that-slide/verify-layout.cjs "$PLAYWRIGHT_PATH" "$BROWSER_PATH"
node evals/prep-that-slide/verify-presets.cjs "$PLAYWRIGHT_PATH" "$BROWSER_PATH"
```

Set `PLAYWRIGHT_PATH` to the installed Playwright package directory and `BROWSER_PATH` to the browser executable.

| Check | What it verifies |
| --- | --- |
| [Layout fixtures](layout-cases.html) and [runner](verify-layout.cjs) | Intentional image cropping passes. Clipped text, out-of-page labels, hidden pages, broken images and missing page markers are detected. A healthy document passes. |
| [Preset runner](verify-presets.cjs) | The bundled samples render offline with their declared fonts and Phosphor icons. Declared text color pairs meet 4.5:1 contrast, pages fit the checked print layout, PDF page counts match, Clay step markers align, and invalid preset selections fail. |

The preset runner generates HTML and PDF files in a temporary directory and prints its location. Readers can reproduce the samples from the shipped generator, preset definitions and assets; no private artifacts are needed. The [automated check report](results/automated-checks.md) links the recorded measurements and identifies their source snapshot.

## Evidence Boundaries

The browser checks cover the supplied HTML and PDF samples. They do not run a model, establish design quality or factual accuracy, or certify accessibility. Native PowerPoint and Google Slides workflows have no reproducible end-to-end fixture in this repository. Check their required authoring tools, editing capabilities and actual output separately.

For a behavioral evaluation, record the prompt, skill snapshot, resulting files, observed actions and grading criteria. Include reproducible source or reviewable artifacts with the result. Retain failures and unavailable checks. A successful export or an agent's promise to inspect does not establish a completed review.
