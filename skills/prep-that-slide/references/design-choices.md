# Design Choices

## Ask, Offer Or Choose

Resolve the few decisions that change the build: reading or presenting, requested file types, audience and purpose, brand or template, and any explicit preferences. Do not ask again for information already supplied. A style preference is usually optional; missing source material or a required output capability can be a real blocker.

- **Clear brief or existing design:** follow it, even when it matches no preset.
- **Uncertain preference:** choose two or three suitable directions and show the same short title, body, evidence and caveat in each. Let the user compare actual hierarchy and density. If they ask to choose before work proceeds, wait for that choice.
- **Delegated direction:** choose, state the assumption briefly, and build. Do not turn "make it polished" into a compulsory interview.

Use the [preset data](../assets/presets.json) as an optional starting point. Each entry includes recommended fonts with fallbacks, semantic colors, spacing, type defaults and composition guidance. All can be overridden. Presets are visual directions, not fixed slide layouts or industry rules.

| Preset | Useful starting context | Distinctive treatment |
| --- | --- | --- |
| Clear Brief | Decisions, proposals, short explanations | Sans headings, generous spacing, one clear conclusion per page |
| Mono Brief | Client reviews, recommendations and scoped plans | Geist Mono headings, Geist body, evidence tables and restrained Phosphor icons |
| Monochrome Grid | Minimal product briefs and direct decisions | Vercel-inspired Geist type, strict grid, pure black/white and inverted panels |
| Orange White | Platform explanations and delivery plans | Cloudflare-inspired white canvas, Inter type, orange markers and open spacing |
| Navy Orange | Client recommendations, product plans and evidence-led briefs | Geist Mono headings, Geist body, navy evidence panels, white reading space and orange markers |
| Editorial Review | Investigations, research and evidence-led explanations | Clean Geist headings, bold geometry, cobalt, acid yellow and coral; questions answered with evidence |
| Blueprint | Systems, engineering, technical education | Space Grotesk headings, Inter body, strong blue evidence panels and precise diagrams |
| Bold Story | Product stories and live talks | Large statements, dark canvas, sparse copy, selective imagery |
| Ledger | Analyst briefs, measured results and comparisons | Geist Mono headings and figures, Geist explanations, compact tables, labelled bars and total-centered donuts |
| Clay | Learning, facilitation and people-focused material | Manrope throughout, warm paper tones and centered milestone layouts |
| Hard Reset | Launch notes, provocations and high-contrast recommendations | Heavy uppercase Inter, IBM Plex Mono text, near-black pages, full-bleed acid-yellow blocks and cyan limit labels |
| Signal | Research explainers, comparisons and recommendations | Bold Inter titles, rounded white panels, a gray segmented band, a charcoal decision center and terracotta marks |

Catalogue names describe the visual direction. Blueprint uses the script ID `technical-notes`; Clay uses `warm-workshop`; Ledger uses `data-room`; Hard Reset uses `brutalist-cyberpunk`. These stable IDs keep saved preview commands usable.

To generate a comparison with existing Node.js, run this script from any directory, using its installed path:

```sh
node /path/to/prep-that-slide/scripts/preview-presets.mjs --output /path/to/preview.html --presets clear-brief,editorial-review,technical-notes
```

Without `--presets`, it shows all available directions with evidence and planning pages in each. Signal includes four samples to demonstrate paired evidence panels, a segmented sequence band, a decision map and dark issue-to-action rows. Each style shows at least one Phosphor regular icon in context; the inlined SVGs carry `data-icon="phosphor:<name>"` for checks. Selection preserves the requested order. This is a local HTML comparison, not a finished client deck. It embeds the selected families from `assets/fonts/manifest.json`, with the weights required by each preset, and requires no runtime network request. Missing font files are errors. The font assets have individual open licenses; retain those when redistributing them. Other fonts, weights and language coverage need their own check. Replace the fictional sample copy with representative content when presenting choices to a user.

## Brand References

Monochrome Grid takes its grid and restrained typography cues from the [Vercel Geist Design System](https://vercel.com/geist/introduction). Its palette is strictly black and white. Hierarchy comes from type size, weight, spacing, borders and filled versus outlined shapes. Do not introduce gray tints or colored highlights unless the user changes that brief.

Orange White takes its spacious white layout, Inter typography and orange emphasis from the [Cloudflare Developer Platform](https://www.cloudflare.com/developer-platform/). Keep most of the canvas white. Reserve bright orange for graphical emphasis and use dark text on orange fills. The darker orange token supports readable text on white.

These are adaptable visual directions, not official brand templates. Use the supplied licensed fonts and the default Phosphor family. Logos, proprietary illustrations and brand-specific claims are not part of the presets.

## Editorial Review Direction

Use clean Geist sans-serif type, a white canvas and dark readable text. Cobalt, acid yellow and coral provide selective emphasis. Large short headings, hard edges, flat circles and squares give the layout a direct graphic character. Use a question when the same page provides a grounded answer; curiosity must not imply a hidden finding or exaggerate the evidence.

Use dark text on yellow or coral and white text on cobalt. Keep dots and bars scaled to the data, with clear labels. Abstract geometric motifs are decorative, stay separate from charts and carry no quantities. The preset supports investigative content without requiring a traditional newspaper or serif treatment. Other fonts and colors remain available when the user asks.

## Signal Direction

Select `signal` for warm white `#F5F3EE`, white panels, charcoal `#1E1F1D`, a range of warm grays and terracotta `#C2603C`. Signal uses no blue. Inter Regular and SemiBold provide bold, tightly tracked 48px titles and plain body text on light and dark pages. Keep the generous margins, 20px panel corners and the gutter between paired panels constant across the set. The bundled samples use 1280 x 720; adapt the dimensions and spacing to the delivery format.

Grays carry structure. The five `step` tokens run from `stepPale` to `stepDeep` for a segmented sequence: ink text on the three light steps, `inverseInk` on the two dark steps. `neutral` colors comparison bars, outlines and connectors; `border` draws hairlines and `muted` sets supporting text. Terracotta is a restrained mark: `highlight` for the main bar and arrows, `accent` for small icons and text on light surfaces, `inverseAccent` for a label on charcoal. Text never sits on a terracotta fill. `contrastPairs` records the additional text combinations checked by the preset evaluation.

Choose the structure by page purpose rather than recoloring one template:

- **Evidence:** two equal rounded panels, one for counts and one for a bar comparison on a shared scale, above a ruled row of two takeaways.
- **Planning:** one broad segmented band that steps from pale gray to charcoal, with ruled phase labels beneath and three rounded note panels below. State that the order is proposed; the band never implies completion.
- **Decision map:** a charcoal circle holds the proposed step in light text, with requirements in outlined rounded boxes to the left, right and below. A ruled note states the decision requested and what remains unapproved.
- **Issues and actions:** a charcoal page with rounded rows that pair each charcoal issue with a light response, joined by terracotta arrows.

For PDF, render all states without interaction. For editable slides, recreate the text, panels, band segments and connectors as native objects. Use Phosphor regular icons where they name a panel's subject, placed so that headings and body text keep one left edge.

## Ledger Direction

Select `data-room` (catalogue name Ledger) for measured results and comparisons. Use Geist Mono Medium for headings, figures and numeric table cells, with Geist Regular and SemiBold for explanations. The bundled mono face has weight 500; use it directly. Tabular numerals and right-aligned numeric columns keep counts and decimal places easy to compare.

Keep the white canvas, near-black ink and deep green `#1E5B3C` for the main figure and the decision. Let an actual table carry the detailed comparison, with clear row labels, units, a stated denominator and an emphasized total. A restrained header treatment and open row spacing usually suffice; avoid a full boxed grid or rules under every row. Pair the table with a labelled horizontal bar chart when the reader needs to compare proportions. Use the same source values for both, state the denominator, and give every bar a common zero-based scale. Put the interpretation below the table and chart. Choose other chart types only when the available data supports them; do not invent a trend to fill a slide. On the planning page, keep the decision and open items above a sequence of large mono step numbers. Contextual Phosphor icons, aligned labels and whitespace connect the layouts.

A donut is an alternative for two to four non-overlapping categories that form one whole. State the total in the center and show counts and percentages beside category names, so color is not the only way to read it. Derive arc lengths and labels from the same values; avoid 3D, exploded slices or multiple concentric rings. Keep it on a separate page when a table and bars already fill the evidence page. Use bars for precise category comparisons, lines for an actual time series and stacked bars for comparable totals with meaningful parts. Chart variety follows the data, not a quota.

## Hard Reset Direction

Select `brutalist-cyberpunk` (catalogue name Hard Reset) for near-black `#0C0C0C` pages, off-white `#F2F0E6` text and panels, acid yellow `#E4FF1A` and a selective electric cyan `#2DE2FF`. Inter SemiBold sets heavy uppercase titles and large figures; IBM Plex Mono Regular and SemiBold set labels and reading text. Use only those weights.

Build pages from a few large, square-cut blocks with deliberate asymmetry. On an evidence page, a full-bleed bar spans the page width; its yellow and outlined blocks are the data, drawn on one stated scale with the counts inside them. Context and limits share an uneven row at the foot. On a decision page, stack numbered steps on black, cut across them with a yellow approval slab that runs from the page edge, and set the request in a full-height off-white column.

Put near-black (`paperInk`) text on yellow and off-white fills, and yellow or cyan text only on near-black. Cyan flags limits, not decoration. Avoid glow, gradients, glitch or distorted text, rounded cards and decorative figures. Keep reading text at 17-20 px and step numbers within their marker column.

## Navy Orange Palette

Select `navy-orange` for navy `#15233B`, orange `#F05A27` and white `#FFFFFF`. Use Geist Mono for short headings and Geist for body text. Fonts and icons remain adjustable; Phosphor regular SVGs are the default.

The `accent` token is navy for readable links and labels; `highlight` is orange for chart marks, counts on navy and step backgrounds. Use navy text on white or orange, and white text on navy. Navy/white contrast is 15.73:1; navy/orange is 4.64:1. Orange/white is 3.39:1, so avoid orange small text on white or white body text on orange. These ratios assume the exact opaque colors; recheck any tint, opacity or replacement color. Pair chart colors with labels and filled versus outlined marks.

A navy evidence panel and white explanation area work well for findings. An open numbered list with a navy decision panel suits planning. Use the orange highlight selectively; keep the main reading area calm. The sample is a starting point, not a required layout for every page.

## Review Visual Quality Separately

A style comparison needs different composition, rather than repeating the same two-column page. Keep the central evidence and caveats comparable while changing hierarchy, placement and pacing. For example, an editorial treatment can lead with a large claim and narrow evidence column; a data-led treatment can make an accurately scaled chart the main object; a technical treatment can explain the next decision through a labeled process diagram. These are choices, not mandatory layouts.

Review the contact sheet for page rhythm, then representative pages at the recipient's reading size:

- **Hierarchy:** the main point is obvious before the reader studies the details. Labels, headings and evidence have different jobs and appropriate emphasis.
- **Composition:** alignment and whitespace connect related content. A large empty region should create focus, not expose a page whose content is stranded at the top.
- **Typography:** the intended fonts actually render, line breaks read naturally, and captions remain readable. Font Loading API success alone does not establish which glyphs were used.
- **Evidence:** charts retain honest scales and labels; screenshots show the relevant detail. Numbers and qualifications remain together.
- **Pacing:** page layouts change when their purpose changes. Avoid turning every argument into cards, every finding into a giant number, or every page into the same title-and-bullets template.

Record visual findings separately from export and geometry checks. Inspect the actual PDF or native-slide render, and describe concrete strengths or faults. Do not invent a universal aesthetic score. User approval remains the test of whether the chosen direction fits their preferences.

## Defaults Are A Starting Point

Resolve choices in this order: explicit user direction, brand requirements, existing document system, then a context-appropriate default. Do not carry one client's visual identity into another deck. Small revisions preserve the established design unless the user asks to revisit it.

| Choice | Starting default | Adapt when |
| --- | --- | --- |
| Canvas | 16:9 for screen reading; 1280 x 720 is a useful HTML working size | A4/Letter is better for printing, or a supplied template, venue or screen specifies another ratio |
| Type | Manrope headings with Inter body, if licensed files are available; otherwise use available system sans fonts | Editorial material benefits from a serif heading; technical material can use a mono heading; brand fonts win |
| Palette | White background, dark neutral text, one restrained accent | Brand colors, a dark theme, imagery or the subject call for another direction |
| Icons | Phosphor regular SVGs when available and wanted | Use the requested family, an established set, or omit icons if they add no meaning |
| Furniture | Minimal chrome and no repeating prose footer | Page numbers, confidentiality, running section labels or citations help the reader or are required |
| Source | Existing generator; otherwise simple semantic HTML/CSS is suitable for static PDF | An installed native slide or publishing tool fits the deliverable better |

These choices do not authorize installation or asset purchases. The supplied preview fonts are usable defaults. If another font or icon family is unavailable, use a declared alternative or obtain permitted assets. Do not silently substitute for an explicit brand requirement. Never reuse a font merely because its filename is available in another client's folder without checking permission and provenance.

## Canvas, Type And Density

Choose canvas and density separately from the preset. A dark theme can be a reader deck and a serif theme can be a live talk. Do not assume every PDF is A4 or every PPTX must be 16:9.

- **Screen reader deck:** 16:9 is a useful default. Essential reasoning and caveats stay on the page.
- **Projected talk:** use the venue or template ratio, otherwise 16:9. Larger type and fewer ideas; supporting detail can go in requested notes.
- **Printed briefing:** A4 or Letter as requested, with physical margins and type judged at actual print size.

CSS pixels and slide font points are different units. At the default browser print scale, 96 CSS px equal 72 pt. A 22 px paragraph is about 16.5 pt before any page scaling. In a native slide generator, use physical page geometry and point-based type directly. Do not copy the same numeric sizes blindly between formats. Start around 22-28 pt body for native screen slides, larger for projection; a printed report can use roughly 11-13 pt body. Judge the output at the intended distance and size rather than treating those ranges as a compliance test.

For a 1280 x 720 reader deck, start around 36-44 px for page titles, 22-26 px for section headings, 20-24 px for body text, and 16-18 px for captions or dense tables. A comfortable dense page may use 18-20 px body text with generous line height. Treat these as tuning ranges, not acceptance thresholds. A projected talk needs larger text and less content. A printed report needs a scale chosen in physical points.

Use one or two font families; differentiate by size and weight before adding more. A coordinated pair such as Geist Mono with Geist is useful when the heading needs a distinct voice. A single family with contrasting weights can be clearer than two similar sans fonts. Do not force a two-font pairing just to make a preset different. Mono works well for short technical headings or labels but makes long paragraphs wider. Serif headings can suit analytical or editorial material. Test the actual longest title and a dense paragraph before applying a pairing across the deck. Check that all needed language glyphs and weights exist.

Use roughly 1.4-1.55 line height for body text. Make paragraph gaps visibly larger than the space between wrapped lines. Keep captions readable at the intended viewing size. Do not make caveats into tiny gray text to protect the layout.

Native lists should normally use outside markers with about 1.4-1.6 em of inline padding, plus a small gap after the marker. Wrapped lines align with the text, not the marker. Custom numbered steps need a fixed marker column and a flexible text column. Nested lists are useful only when the hierarchy is real.

## Layout By Content

- **Summary:** two balanced groups, plus a separate decision or estimate strip if needed. Do not crowd a third narrow column with conditions.
- **Method or provenance:** a compact grid of labeled date, source and environment values, followed by the substance of the review. Different measurement dates stay distinct.
- **Evidence:** screenshot or chart beside interpretation. Retain the source, unit, period and limitation within the reading flow.
- **Comparison:** table with aligned columns and predictable units. Use tabular numerals; avoid long centered prose and compressed column widths.
- **Process:** a few numbered steps or a route diagram. Names and destinations should be legible without a spoken explanation. In a horizontal stepper, center each marker over its content column and align connector ends with the first and last marker centers. Check heading and paragraph alignment across the steps.
- **Scope or options:** cards when the items are peers, a table when the reader must compare attributes. A mixed hierarchy needs another arrangement.

Use flexible grid tracks such as `minmax(0, 1fr)` and `min-width: 0` on children. Allow long source addresses to wrap. Avoid rigid heights inside cards unless their content is controlled. Keep related margins consistent, and remove accidental trailing margins at the end of a column.

## Progress, Milestones And Navigation

Presets apply to progress bars, charts, tables, timelines and diagrams as well as text. Choose the visual by what the reader needs to understand; do not add every component to every deck.

| Reader question | Useful visual | Required context |
| --- | --- | --- |
| How much is complete? | Progress bar | Recorded completed amount, total or target, unit and reporting date |
| What happens next? | Labeled milestones or timeline | Sequence, actual versus proposed dates, and known status |
| Where am I in the deck? | Small section marker or page count | Current section or page; separate from project completion |
| How do options or results compare? | Table or labeled bar chart | Comparable units, periods and populations |

For quantitative progress, scale the fill to the actual fraction and put a readable label beside it, such as "6 of 12 tasks complete (50%), as of June 4." This describes task count, not half the work effort when tasks have different sizes. If the total is unknown, use a named status or milestones instead of inventing a percentage. Mark estimates as estimates; a planned date is not a completed milestone. Keep the full target visible and distinguish actual progress from a forecast.

For Navy Orange, use a navy outline for the track, white for the remaining area, and orange for completed progress. Keep the value label outside the track in navy, or use navy text on a sufficiently large orange fill. Other presets use their own readable tokens. Labels and fill position carry meaning alongside color; distinguish milestone states with words or shapes as needed.

PDF bars and milestones show their complete static state. In editable slides, use native shapes or charts for values the recipient needs to update, and check that labels and fills agree. Browser-only animation is optional and must respect reduced motion. A deck-position indicator is optional, respects requests for no repeating footer, and never implies that a project is complete.

## Icons, Images And Decoration

Choose one icon family and weight per deck unless the content requires a distinction. Use icons to identify recurring concepts, not before every sentence. Align them optically with the first text line. Use actual licensed SVGs rather than emoji substitutes when the brief asks for an icon system. Decorative icons stay hidden from assistive technology and do not replace labels.

Use images when they explain or substantiate something. Match crop and focal point to the content, preserve aspect ratio, and avoid decorative stock imagery competing with evidence. Retain original evidence files; label crops and additions such as annotations. Do not fabricate a screenshot of a tool result from transcribed values. Generated illustration cannot stand in for documentary evidence.

Animation can support a live or HTML deck. A PDF must contain the complete final state of every page. Design for static readability first; disable reveal gates and motion during printing. Do not add motion to a static deliverable as a substitute for clearer hierarchy.
