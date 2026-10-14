# Prep That Slide

Design PDF presentations, editable PowerPoint (PPTX), HTML talks and Google Slides through connected editing tools. Requested formats, brand assets and existing generators take precedence. The skill provides design and delivery guidance; the agent's environment supplies the authoring tools, renderer and any Google connection.

## Formats And Requirements

| Format | What the environment needs | Checks provided in this repository |
| --- | --- | --- |
| PDF presentations | A PDF renderer and a way to inspect the exported pages | The preset runner exports sample pages and checks layout, assets and PDF page count. Each delivered deck still needs visual inspection. |
| Editable PowerPoint (`.pptx`) | PPTX authoring tools and a compatible slide renderer | Workflow guidance covers native text, editable chart data, notes and rendering checks. No reproducible native PowerPoint fixture is included. |
| Google Slides | Tools that can read and edit slide content, plus permission to edit the target deck; preview/export tools for delivery checks | Workflow guidance is provided; no end-to-end editing fixture is included. A read-only or search-only connection is insufficient. |
| HTML presentations | A browser, plus an existing framework if interactive presentation controls are needed | Static preset HTML is checked offline. A full interactive talk workflow is not tested. |

The preview script generates HTML. PDF export needs a renderer. PPTX and Google Slides require separate authoring tools; changing the output filename does not convert the preview into an editable deck. Sample checks do not establish compatibility with every template, application or connector.

## Install

From a repository revision containing this skill:

```sh
npx skills add dennexequiel/skills --skill prep-that-slide
```

For a local checkout, use `npx skills add . --skill prep-that-slide` from the repository root. Installing and validating do not require a publishing account.

## Use

Ask the agent to use `prep-that-slide`, then supply the audience, source material and desired output. For example:

> Turn these research notes into a standalone PDF for a nonprofit board. Use our warm palette and serif headings, no icons, and keep the uncertain results explicit.

> Refine this existing presentation. Keep its generator and brand fonts. Fix the crowded comparison page, then export and inspect the PDF.

> Create an editable PPTX with speaker notes and a matching PDF. Choose the style, keep the chart editable, and verify both files.

The [skill](SKILL.md) includes adaptable design presets, a local visual comparison generator, narrative and evidence guidance, format-specific delivery checks, an optional CSS starter and a browser layout checker. Use a supplied brand, offer a few previews when the user is unsure, or choose a suitable preset when direction is delegated. Fonts, colors, icons, density and page size remain adjustable. The browser checker is evaluated inside an existing browser tool; it is not a Node CLI.

## Improve An Attached PowerPoint

With this skill available to the agent, attach a `.pptx` if the host supports attachments, or supply its readable local path. The host needs compatible PowerPoint authoring and rendering tools; the skill provides the workflow, not an import or export engine.

Example prompt:

> Use prep-that-slide to improve the attached PowerPoint for a client to read without a presenter. Create a new editable PPTX and a matching PDF using the Navy Orange preset (`navy-orange`): #15233B, #F05A27 and white. Keep the original file intact. Preserve the facts, chart data, important qualifications and speaker notes. Improve the wording, hierarchy, alignment and visual consistency. Reorganize or split crowded slides where useful. Use Phosphor icons, charts, timelines or progress bars only when they clarify the content; do not invent values or completion percentages. Keep text and charts editable and inspect every exported slide. Tell me about any content or features that could not be preserved.

Specify a live presentation instead if the slides need to support a speaker. Mention any slide-count limit, required sections or brand overrides in the prompt.

## Work With Connected Google Slides

Use a Google Slides integration that exposes the required slide-editing operations and has access to the target deck. Merely connecting Google Drive or attaching a presentation link does not establish write capability. The agent checks the available tools before promising an update.

Example prompt:

> Use prep-that-slide to improve this Google Slides deck through the connected slide-editing tools. Edit this deck in place, preserve the facts and notes, and use Signal. Inspect the current slides first, check the result in Google Slides, and give me a PDF if export is available. Tell me about any unsupported objects or unavailable checks.

Google's API supports creating and modifying presentations. Which operations an agent can perform depends on the integration it is given and the account's permissions. See the [connected workflow](references/slide-production.md#work-with-connected-google-slides) for the capability and delivery checks.

## Browse The Presets

Browse the [screenshot gallery](references/preset-gallery.md) to compare all 12 presets. The [preset catalogue](references/design-choices.md) describes the visual directions and when to use them. Generate all samples as one offline HTML file:

```sh
node skills/prep-that-slide/scripts/preview-presets.mjs --output /tmp/presentation-presets.html
```

Open the file in a browser to compare layouts, fonts and color systems. The samples embed their fonts and icons. Use a PDF renderer to export the pages; the generator itself outputs HTML.

## Ledger Preset

Use `data-room` (Ledger) for measured results and comparisons: Geist Mono headings and figures, Geist explanations, a white canvas and deep green emphasis. The three samples show a table with horizontal bars, a planning decision and a donut with a centered total and aligned category values. [Chart guidance](references/design-choices.md#ledger-direction) explains when each format fits the data.

```sh
node skills/prep-that-slide/scripts/preview-presets.mjs --output /tmp/ledger.html --presets data-room
```

## Navy Orange Preset

Use `navy-orange` for navy `#15233B`, orange `#F05A27` and white. It pairs Geist Mono headings with Geist body text, navy evidence panels and orange highlights. The default Phosphor icons, fonts and page size remain adjustable. [Color roles and readable combinations](references/design-choices.md#navy-orange-palette) guide both PDF and slide production.

```sh
node skills/prep-that-slide/scripts/preview-presets.mjs --output /tmp/navy-orange.html --presets navy-orange
```

Run this command from the repository root. The standalone HTML embeds its fonts and icons for offline viewing and PDF export.

## Signal Preset

Use `signal` for research explainers and recommendations: rounded evidence panels, a segmented sequence, neutral grays, Inter type and restrained terracotta accents. The [preset catalogue](references/design-choices.md) lists every style and its intended use.

```sh
node skills/prep-that-slide/scripts/preview-presets.mjs --output /tmp/signal.html --presets signal
```

The four fictional samples demonstrate evidence, a proposed sequence, a decision map and paired issues and actions. The visual direction applies to PDF, HTML and editable slides; the preview command produces HTML for browser viewing and PDF export.

## Hard Reset Preset

Use `brutalist-cyberpunk` (Hard Reset) for a print-poster look: near-black pages, heavy uppercase Inter titles, IBM Plex Mono text, acid-yellow blocks and cyan limit labels. The evidence sample draws its main comparison as a full-bleed bar on one scale.

```sh
node skills/prep-that-slide/scripts/preview-presets.mjs --output /tmp/hard-reset.html --presets brutalist-cyberpunk
```

## Compatibility

The instructions use the Agent Skills format and capability-based guidance. Native host discovery and model behavior require their own validation. No runtime adapter is included. PDF production needs a renderer; editable PPTX needs a compatible authoring tool and a slide renderer for visual checks; HTML layout checking needs a browser. The preview generator uses Node.js built-ins. The optional CSS and browser expression have no package dependencies.

## Limitations

The preview includes optional static fonts under their individual SIL Open Font Licenses, with source URLs and hashes in `assets/fonts/manifest.json`. The skill instructions and scripts use the repository MIT license. The bundle includes licensed Phosphor regular SVGs for previews. It does not include a browser, PDF renderer or PowerPoint generator. Native editability, notes and rendering depend on the chosen exporter and must be checked. Google Slides workflow guidance and Keynote interchange guidance do not establish a tested integration or native application compatibility. Reuse local tools or obtain approval for additions where required. Automatic layout checks do not establish design quality, verify factual accuracy or establish accessibility conformance. Review hierarchy, composition, typography, evidence and page rhythm in the actual rendered output. Preset previews cover evidence and planning, with extra layouts for some directions, and embed their fonts for offline viewing. A required format that cannot be exported remains an explicit delivery limitation.
