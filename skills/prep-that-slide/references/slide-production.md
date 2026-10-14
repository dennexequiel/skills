# Slide Production

## Choose The Deliverable Before The Tool

An editable deck means the recipient can change meaningful text, diagrams and data, not just replace a picture of a page. Inspect the available tools and any supplied template first. Preserve working source and avoid converting through several formats without a concrete need.

| Requested output | Suitable path | Check before promising delivery |
| --- | --- | --- |
| Editable PPTX | Existing native slide API or a library such as PptxGenJS or python-pptx | Text and required charts are native objects, notes survive, recipient fonts are available |
| PDF and matching editable slides | Native deck, then a supported PowerPoint or LibreOffice PDF export | Render the final deck; compare page count, content, fonts and geometry in both files |
| Browser talk | Existing HTML slide source, or an available framework such as Slidev or Marp | Navigation, projection fit, static print states and any requested offline behavior |
| Native Google Slides or Keynote | Authorized native integration or a tested interchange/import path | Import quality and object editability in the target application; PPTX alone is not a native project |

Tool features change. Check the installed version and official documentation when a capability matters. For example, some HTML exporters offer both image-based and experimental editable PPTX modes. Inspect the actual objects and exporter warnings; the file extension is not evidence of editability. Notes and complex visual effects may not survive those paths. Do not install a framework merely because it appears here.

## Improve An Existing PowerPoint

Use the attached file or a readable local path. Inspect the actual `.pptx` and rendered slides before redesigning. An attachment name or extracted text alone does not show the original layout. Keep the original file intact and save the revised presentation under a new name unless the user requests an in-place edit.

- Establish whether the request is a visual refresh, a content edit or a full restructuring. A request to improve the deck usually permits clearer hierarchy, shorter repetition and better layouts while preserving the facts and material qualifications. Do not silently change the audience, conclusions or supplied brand requirements.
- Inventory visible and hidden slides, speaker notes, tables, chart data, images, links and any media or animations that matter to delivery. Notes can contain context absent from the slides; hidden slides are source material, not automatically part of the final sequence. Flag unreadable or unsupported content before it affects a claim or requested deliverable.
- Select an editing or authoring tool based on the required content. A tool that writes new PPTX files may not preserve every object in an existing deck. Preserve supported objects where useful; reconstruct only the approved content that needs redesign. Keep source data available for charts and do not infer missing values from bar heights.
- Apply the chosen preset as an adjustable theme. Keep text, tables, progress bars and requested chart data editable where supported. Retain supplied notes and essential links unless the brief says otherwise. Put material qualifications on the page for a standalone PDF.
- Compare the revised deck with the source: check numeric values, units, dates, conclusions, notes and assets. Track meaningful slide merges or omissions in working notes so content does not disappear during reorganization. Report only changes or limitations the user needs to review.

Use the native delivery checks below, including a rendered review of every final slide. If only screenshots or a PDF are available, use them as visual/content references and state what cannot be recovered, such as original chart data or speaker notes. Never describe a reconstructed deck as preserving source objects that were unavailable.

## Work With Connected Google Slides

Inspect the integration's actual tools and the target presentation before promising an edit. It must support the operations needed for the request, such as reading slides, editing text, positioning shapes, or updating notes. A connection that can only search Drive or read presentation content cannot perform a redesign. The connected account also needs permission to edit the target deck. Follow the request's choice of an in-place edit or a separate copy; do not create additional approval steps when that choice is already authorized.

Read the current slides, layout, notes and relevant object data. Apply the selected fonts, colors and spacing through supported native objects. Preserve source facts and requested editability. Check tools for charts, media and notes individually rather than assuming all slide features are exposed. Do not silently flatten a chart whose data the user needs to edit.

After writing, read the changed slides back and inspect their rendered thumbnails or a supported export. Verify the slide count, required content, notes and meaningful object editability. A successful update response alone does not show that the text fits. If preview or export is unavailable, identify that specific delivery limit. Give the target deck link only after confirming which presentation was updated; creating a local PPTX does not establish that a Google Slides deck exists.

Google documents [presentation creation and editing](https://developers.google.com/workspace/slides/api/guides/overview), [authorization scopes](https://developers.google.com/workspace/slides/api/scopes), and [Drive export formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats), including PDF and PPTX for presentations. These API capabilities do not imply that a particular connector exposes them. Sharing changes, publishing and sending to recipients remain separate from editing the requested deck.

## Author Native Slides

Set the physical canvas before laying out content. Use native theme fonts, shared color/type constants and reusable layout measurements where supported. A 16:9 canvas does not imply one physical size. PptxGenJS distinguishes `LAYOUT_16x9` and `LAYOUT_WIDE`; choose intentionally and use the dimensions of that layout. Its geometry is in inches and font sizes in points. See the [official layout documentation](https://gitbrent.github.io/PptxGenJS/docs/usage-pres-options/) when using it.

The bundled presets use CSS-oriented values for previewing. Map their semantic colors and font choices into the native theme, then tune physical geometry and point sizes for the recipient's viewing context. Do not paste CSS pixel sizes directly into point fields. Select an available named font from each stack; native themes do not interpret CSS fallback stacks.

Use native text boxes for headings and prose, native charts with editable data when chart editing is required, and shapes/connectors for diagrams that the recipient needs to change. Evidence screenshots remain images and should retain useful descriptions and captions. Some illustrations may reasonably be flattened, but identify this when it affects an explicit editing requirement.

Keep qualifications essential to a standalone PDF on the page. Speaker notes can hold delivery cues, narration and extra support when requested, but a normal slide PDF does not include them. Set meaningful title, author and language metadata from supplied facts; do not invent an author or import another client's identity.

## Verify Native Delivery

1. Reopen the saved deck using a compatible application or parser. Check slide count, dimensions, text, requested notes and chart data. Inspect shapes to ensure meaningful content is not entirely rasterized.
2. On a temporary copy, edit a representative heading and any required chart data, save, reopen and render it. Do not modify the final deck merely to prove editability. A parser check supports structural correctness; it does not establish compatibility with every recipient application.
3. Render every final slide through an available slide renderer, then inspect all pages. A browser screenshot of the source does not verify PowerPoint layout. Check font substitution, wrapped titles, table alignment, missing shapes, notes and image crops.
4. If a PDF is requested, export from the final deck where practical, then use the PDF checks. A font referenced by name in PPTX is not necessarily embedded or installed for the recipient. Disclose required fonts or agree on available alternatives.
5. Retain the editable file, generation source, asset provenance and reproduction instructions. State which renderer was checked. If the recipient's PowerPoint, Keynote or Google Slides environment was not checked, do not imply it was.

## Browser Delivery

Test next/previous navigation, keyboard focus, presenter controls if included, and direct links when the brief requires them. Respect reduced-motion preferences and make all essential content readable without animation. Fit the intended viewport; a slide cropped on a laptop is not ready because it fits a large preview.

Use the PDF workflow for print output. Screen transitions, scaled wrappers and hidden inactive slides require an explicit static print state. Avoid rasterizing all text for convenience when searchable text matters. Use visual previews to choose a style, not as a substitute for the requested export.

For browser frameworks already in use, consult their own export documentation: [Slidev](https://sli.dev/guide/exporting) and [Marp CLI](https://github.com/marp-team/marp-cli#export-to-pdf-pptx-and-images). Verify the installed version's native-object support and limits rather than assuming every PPTX export is editable.
