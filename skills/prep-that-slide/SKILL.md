---
name: prep-that-slide
description: Create or refine PDF presentations, editable PowerPoint (PPTX), HTML talks, and Google Slides through an authorized integration with slide-editing tools. Use for slide narrative, adaptable presets, evidence layouts, typography and export quality. Use available authoring and rendering tools; the skill does not bundle an export engine or Google connection. Do not use for ordinary prose editing, website implementation, or PDF form filling and extraction.
license: MIT
metadata:
  display-name: Prep That Slide
  summary: Design PDF, PowerPoint (PPTX), HTML and connected Google Slides presentations with available authoring and export tools.
  status: experimental
  areas: presentations, documents, design
---

# Prep That Slide

Make a presentation that the intended reader can understand, trust and act on. Visual choices serve that purpose. A client review, investor pitch, research briefing and live talk need different density, pacing and evidence.

## Establish The Deliverable

Read the brief, supplied material and any existing deck or generator before editing. Preserve useful source structure and the user's chosen tools. Determine the audience, desired decision, delivery format, reading setting and constraints from context. Ask only for missing information that would materially change the result; otherwise state a reasonable assumption and proceed.

- For a PDF sent without a presenter, make the argument complete on the page. Speaker notes cannot carry essential qualifications or decisions.
- For a live talk, simplify the projected pages and put permitted supporting detail in notes or a handout.
- For a narrow revision, change the affected pages and shared styles only as needed. Recheck all pages affected by a shared change.
- Honor a requested PDF, editable slide file, HTML deck or paper size. Do not substitute a web link for a requested PDF. If the format is unspecified, infer it from the use: a PDF for reading, an editable slide deck for a presenter or team handover, HTML for browser delivery. If that distinction is still unclear and affects the build, ask one short question. Editable HTML source is not an editable PowerPoint file.

For an attached PowerPoint redesign, read [the existing-deck workflow](references/slide-production.md#improve-an-existing-powerpoint). Preserve the original, inspect its slides and notes, and verify that the revised deck retains the supplied facts.

For Google Slides, read the [connected editing workflow](references/slide-production.md#work-with-connected-google-slides). Check that the integration exposes the needed slide-editing operations and that the account can edit the target deck. A connection that only searches or reads files cannot update slides. Verify changes in the target presentation before claiming delivery. The skill supplies guidance, not a Google integration or a PDF/PPTX export engine.

Do not require a particular model, paid service, icon vendor or publishing account. Prefer tools already available. Follow the project's dependency and external-action permissions; creating a deck does not authorize sending or publishing it.

## Build The Argument Before The Decoration

Read [narrative and evidence](references/narrative-and-evidence.md) when turning notes, research, analytics or an existing report into a deck.

Identify the central message and a useful reading order. A review often connects goals, current evidence, implications, recommendations, delivery and decisions. A pitch or lesson needs another sequence. Do not impose a fixed section list or slide count.

Write page titles that tell the reader what they should learn. Give each page one main job. Group related findings and keep the qualification next to the claim it changes. Separate verified observations, interpretations, proposals and unknowns. Never invent source data, screenshots, dates, business outcomes or estimates to complete a layout.

Use charts for quantities, diagrams for relationships, tables for comparisons, and concise prose for reasoning. An attractive grid of cards is not a substitute for hierarchy. If the user wants brevity, move supporting detail to an appendix or linked source only when the main argument remains understandable.

## Choose A Visual Direction

Read [design choices](references/design-choices.md) for style selection, canvas and type scale. The optional [presets](assets/presets.json) describe typography, palettes, layout rhythm and visual treatment; they do not lock the user into a color or format. Record the selected choices in the document's source or existing project notes, not in the global skill.

Use the supplied brand, template and explicit preferences first. When the user is unsure, offer two or three relevant directions with a small visual comparison; the optional [preview generator](scripts/preview-presets.mjs) makes comparable samples without packages. When the user says "you choose," select a suitable direction and proceed. Do not force a preset questionnaire or approval gate for a clear brief.

Use the [screenshot gallery](references/preset-gallery.md) when a visual comparison helps choose a direction.

User preferences and brand assets take precedence over these defaults. Choose a restrained palette and one or two compatible font families. Phosphor regular SVGs are the default when icons help explain the content; use a requested family or omit icons when appropriate. Use the tone of the content to decide between editorial, technical, expressive or quiet styling. References are inspiration, not permission to copy another brand or misrepresent authorship.

Use [progress and milestone guidance](references/design-choices.md#progress-milestones-and-navigation) when the brief needs completion bars, timelines or section markers. The same preset colors and type apply; progress percentages need a stated basis.

For a new substantial deck, build a representative text-heavy page and an evidence or diagram page before styling everything. This is an internal design check unless the user requested approval. Provide a preview for approval when that is part of their process. A focused edit does not require a new style exploration.

When refining a supplied reference or an approved sample, preserve the parts the user likes. A request to adjust colors or contrast does not by itself call for a different composition. Keep reference qualities and requested changes clear before making a broad redesign.

Judge the representative pages for craft as well as fit: a clear focal point, deliberate reading order, balanced space and legible evidence. Compare them with the requested reference at the same viewing size. If the user rejects the design, identify the composition or typography problem before adding decoration. A clean layout check is not a design approval.

The optional [starter CSS](assets/presentation.css) supplies adjustable page, type, spacing and color tokens plus a few print-safe layouts. It is a starting point, not a mandatory theme or reason to replace an existing generator. The preview embeds the supplied open-license font files; they are defaults, not required brand choices. Font licenses and source hashes are in [the font manifest](assets/fonts/manifest.json). The Mono Brief preset uses Geist Mono headings with Geist body text. The Monochrome Grid and Orange White presets provide black-and-white and light orange-accented alternatives. Navy Orange pairs navy panels and white reading space with orange highlights. Signal uses rounded evidence panels and a segmented sequence with neutral grays and terracotta accents. Ledger uses mono figures, compact comparison tables, labelled bars, total-centered donuts and open spacing. Hard Reset uses heavy uppercase type, near-black pages and full-bleed acid-yellow blocks. Licensed Phosphor regular SVGs support these previews; their [license and source](assets/icons/phosphor/README.md) travel with the skill.

## Fit The Content Deliberately

Work at the intended page size and reading scale. A page that fits numerically can still be exhausting to read.

- Align related headings, labels, values and baselines. Put metadata in its own small grid when it would otherwise form a long introductory paragraph.
- Use hanging indents so wrapped bullet text aligns with the first line. Keep bullet spacing distinct from paragraph spacing.
- Use enough columns for meaningful groups, not to squeeze in more words. Three narrow columns often make long prose worse.
- Repair crowding in this order: remove repetition, sharpen sentences, choose a better layout, split the argument, then adjust type within a readable range. Do not remove material caveats or shrink the whole deck to rescue one page.
- Recheck shared font changes against long headings, tables, numbered steps, translated text and dense evidence pages.
- Crop screenshots intentionally and explain the crop. Keep the relevant defect, label or comparison visible. Do not crop away evidence that changes the conclusion.

## Produce And Verify The Actual Output

Read [PDF production](references/pdf-production.md) for a static reader deck or PDF export, and [slide production](references/slide-production.md) for editable PPTX, browser talks, speaker notes or multiple formats. Reuse an existing generator when practical. Keep editable source and local assets alongside the output so another agent can regenerate it.

For a matching PPTX and PDF, author the editable deck first and export the PDF from it when supported. Verify both artifacts. If a live talk and reader version need different density, share the facts but label the editions; do not silently remove essential context to make the pages identical.

The optional [browser layout check](scripts/check-layout.js) inspects print-rendered HTML pages marked `data-slide`. It has no package dependencies and can run through an existing browser automation tool. It reports missing images, font loading, overflow, clipped text and content beyond the page. A clean report is not visual approval or PDF accessibility certification.

For browser-based export, wait until fonts and images finish loading. For native slides, check actual editable objects, notes when requested, and a rendered export. A PPTX made only of page images does not satisfy an editable-content request.

Make print content visible without animation, interaction or a network fetch. Verify the exported PDF's page count, text, evidence images and font rendering. Inspect every page visually, using a contact sheet for consistency and full-size views for dense or changed pages. Look for awkward wrapping, tiny captions, weak contrast, broken bullets and excess or uneven whitespace as well as clipping.

Fix observable problems, export again and recheck the affected pages. Stop when the requested content, visual direction and delivery checks are satisfied. Do not keep expanding the scope to demonstrate more design work. If export or visual inspection is unavailable, deliver the usable source and identify that precise gap; do not call an unrendered file a verified PDF.

## Handover

Link the requested final artifact and its editable source. Briefly state the meaningful changes, checks completed and remaining limitations. If a particular model or tool was requested, record what actually ran; never infer authorship from the renderer or a plugin check. State the target format and any recipient font requirement. Keep working logs, evaluation fixtures and intermediate previews out of the client package unless requested. Leave publication, messaging, signatures and payment actions to their separately authorized workflows.
