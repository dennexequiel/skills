# PDF Production

## Choose The Smallest Working Pipeline

Inspect the existing source, builder, fonts, image assets and available rendering tools first. Reuse them when they fit. A simple static PDF does not need a JavaScript framework, animation library or slide-hosting service. An editable PowerPoint request needs a compatible authoring path; HTML exported to PDF does not fulfill that requirement.

Keep file paths configurable and resolve assets relative to the source or installed skill. Do not copy machine-specific cache paths from examples into a reusable build. Scripts, fonts and images must be licensed for the intended use. Reuse available dependencies; request approval for additions when project instructions require it.

## HTML To PDF

For a new deck, the optional starter CSS uses `[data-slide]` for page containers, CSS variables for the visual system and `@page` for print size. Copy it into the document workspace and adapt it there. Treat canvas width/height and `@page size` as one choice; update both if the format changes. Existing documents can keep their own markup and generator.

Use semantic headings, lists, tables, figures and labels. Keep meaningful content in the DOM as selectable text. Mark decorative SVG icons appropriately and give meaningful images useful descriptions. Tagged PDF output is helpful when available, but tagging alone does not establish correct reading order or accessibility conformance.

Before exporting:

1. Enter print media so the inspection uses the actual print rules. Set an appropriate viewport and a timeout for asset loading.
2. Load the selected font faces and await `document.fonts.ready`. Confirm requested families and weights are present; the Font Loading API can report success while fallback fonts render missing faces or glyphs.
3. Await image decoding. Surface broken assets rather than silently exporting their placeholders.
4. Reveal all pages and final content. Disable transitions and animations, hidden slides, delayed reveals and interaction-only controls. Avoid printing a screen-scaled slide or only the current slide.
5. Run the optional layout check, fix findings and inspect the layout. Export with the chosen CSS page size, backgrounds enabled when needed, and automatic browser headers/footers disabled unless requested.

The bundled `scripts/check-layout.js` is a browser expression, not a Node CLI. Read its text from the installed skill and evaluate it in the inspected page through the available browser tool. For example, with an existing Playwright page:

```js
// page is already navigated, using print media, with local assets loaded.
const checkSource = await readFile(layoutCheckPath, "utf8");
const report = await page.evaluate(checkSource);
```

It inspects `[data-slide]` elements without changing them. A cropping wrapper may carry `data-intentional-crop` to exempt overflowing images or SVG art inside that wrapper. Text inside a crop remains subject to checks. Do not mark a whole page as a crop or use the marker to silence unexplained overflow.

The check catches absent or hidden pages, text and elements outside their page, some internal clipping, unresolved font loads and broken images. It cannot prove good typography, correct glyphs, contrast, reading order, factual accuracy, every clipping mechanism or final PDF pagination. Follow it with PDF inspection.

## Inspect The Export

Use available PDF tools to check page count and dimensions, extract text and render pages to images. For example, if Poppler is installed:

```sh
pdfinfo output.pdf
pdftotext -layout output.pdf output-text.txt
pdftoppm -scale-to 1400 -png output.pdf preview
```

A contact sheet helps find inconsistent margins, density, palette and rhythm. Read all pages; inspect dense tables, metadata blocks, bullets, long titles, diagrams and evidence crops at full size. Open the PDF itself when possible to judge its intended reading scale and text selection. Confirm no unexpected blank or duplicate pages, clipped content, fallback glyphs, missing assets or print-only artifacts.

A browser preview can show correct fonts while the PDF contains damaged glyphs. If titles overlap or characters disappear only in the PDF, inspect the embedded font report and the rasterized pages. Try licensed static instances of the same family when a variable-font export is implicated. Do not replace the user's chosen family or claim that every variable font is unsafe. Recheck all pages after changing the font files.

After a source edit, rebuild the output before inspecting or delivering it. After a shared font or layout change, recheck every affected page. Keep original evidence images intact and create any labeled crops in the presentation layer or a separate derivative. Use a consistent page sequence when refreshing previews.

## Completion Evidence

For a complete PDF delivery, retain the editable source, required local assets, a reproducible export command or instructions, and a concise record of what was verified. A recorded page count and clean layout check support the claim that the file rendered; visual inspection supports readability. Neither proves business results or comprehensive accessibility.

If the environment cannot export, deliver the source with the specific missing capability. If it can export but cannot inspect the PDF, identify that limit. Do not install a new tool, upload the document to an external service or claim a successful check just to avoid reporting a limit.
