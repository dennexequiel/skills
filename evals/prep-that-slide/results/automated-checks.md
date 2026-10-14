# Automated Sample Checks

These results cover the bundled layout checker and preset samples. The [measurement record](automated-checks.json) contains the run date, tool versions, source hashes and browser measurements. All sample source and assets are included in this repository.

| Check | Recorded result |
| --- | --- |
| Repository validation | `bun run check`: 115 tests pass, zero fail. |
| Layout fixtures | All seven cases pass, including detection of deliberately clipped text, hidden pages and broken images. |
| Preset samples | 12 presets render as 27 HTML pages and export as 27 PDF pages. No text overflow, broken images or external asset requests are detected in the checked HTML. |
| Fonts and icons | Bundled asset hashes match. Expected fonts render and all 12 presets include Phosphor icons. |
| Text contrast | 72 standard pairs and 15 declared variant pairs meet the runner's 4.5:1 threshold. |
| Selection and alignment | Requested preset order is preserved, unknown presets and missing output arguments fail, and Clay's step markers align with their cards. |

## Reproduce

Use the commands and prerequisites in the [evaluation guide](../README.md#run-the-checks). The [layout fixture](../layout-cases.html), [preset definitions](../../../skills/prep-that-slide/assets/presets.json) and [preview generator](../../../skills/prep-that-slide/scripts/preview-presets.mjs) are the inputs. The preset runner prints the directory containing its generated HTML and PDF.

## Limits

This is an automated fixture run, not a model-behavior evaluation. HTML checks use browser print media; PDF checks cover successful export and page count. Inspect the exported pages visually before delivery. Native PowerPoint editing, Google Slides editing, factual accuracy, design quality and full accessibility are outside these checks.
