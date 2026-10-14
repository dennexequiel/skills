const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

async function main() {
  const [playwrightPath, browserPath] = process.argv.slice(2);
  if (!playwrightPath || !browserPath) throw new Error('Usage: node verify-presets.cjs /absolute/path/to/playwright /absolute/path/to/browser');
  const skill = path.resolve(__dirname, '../../skills/prep-that-slide');
  const catalog = JSON.parse(readFileSync(path.join(skill, 'assets/presets.json'), 'utf8'));
  const fontManifest = JSON.parse(readFileSync(path.join(skill, 'assets/fonts/manifest.json'), 'utf8'));
  for (const asset of [...fontManifest.faces, ...fontManifest.licenses]) {
    const bytes = readFileSync(path.join(skill, 'assets/fonts', asset.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Font provenance mismatch: ${asset.file}`);
  }
  const iconSources = JSON.parse(readFileSync(path.join(skill, 'assets/icons/phosphor/sources.json'), 'utf8'));
  for (const asset of iconSources) {
    const bytes = readFileSync(path.join(skill, 'assets/icons/phosphor', asset.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Icon provenance mismatch: ${asset.file}`);
  }
  const minimumContrast = 4.5;
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const extendedColorPairs = [];
  for (const preset of catalog.presets) {
    for (const foreground of ['ink', 'muted', 'accent']) {
      for (const background of ['surface', 'tint']) {
        assert.ok(contrast(preset.colors[foreground], preset.colors[background]) >= minimumContrast,
          `${preset.id}: ${foreground} on ${background} must meet ${minimumContrast}:1`);
      }
    }
  }
  for (const preset of catalog.presets) {
    for (const [foreground, background] of preset.contrastPairs || []) {
      const ratio = contrast(preset.colors[foreground], preset.colors[background]);
      assert.ok(ratio >= minimumContrast, `${preset.id}: ${foreground} on ${background} must meet ${minimumContrast}:1`);
      extendedColorPairs.push({ preset: preset.id, foreground, background, ratio });
    }
  }
  const expectedPages = catalog.presets.reduce((total, preset) => total + (preset.previewPages?.length || 2), 0);
  const outputDirectory = mkdtempSync(path.join(tmpdir(), 'presentation-presets-'));
  const generate = args => spawnSync(process.execPath, [path.join(skill, 'scripts/preview-presets.mjs'), ...args], { encoding: 'utf8' });
  const output = path.join(outputDirectory, 'all.html');
  const result = generate(['--output', output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).pages, expectedPages);
  const previewHtml = readFileSync(output, 'utf8');
  assert.doesNotMatch(previewHtml, /(?:file:\/\/\/|\/Users\/|\/home\/|\/var\/folders\/)/,
    'Standalone preset previews must not contain machine-specific paths or local file references');
  const subset = generate(['--output', path.join(outputDirectory, 'subset.html'), '--presets', 'technical-notes,editorial-review']);
  assert.equal(subset.status, 0, subset.stderr);
  assert.deepEqual(JSON.parse(subset.stdout).presets, ['technical-notes', 'editorial-review']);
  const extendedSubset = generate(['--output', path.join(outputDirectory, 'signal.html'), '--presets', 'signal']);
  assert.equal(extendedSubset.status, 0, extendedSubset.stderr);
  assert.equal(JSON.parse(extendedSubset.stdout).pages, 4);
  const invalid = generate(['--output', path.join(outputDirectory, 'invalid.html'), '--presets', 'unknown']);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Unknown presentation preset: unknown/);
  assert.notEqual(generate([]).status, 0);
  const { chromium } = require(path.resolve(playwrightPath));
  const browser = await chromium.launch({ executablePath: path.resolve(browserPath), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const externalRequests = [];
    await page.route(/^https?:/, route => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.emulateMedia({ media: 'print' });
    await page.goto(pathToFileURL(output).href);
    await page.evaluate(async faces => {
      await Promise.all(faces.map(face => document.fonts.load(`${face.weight} 24px "${face.family}"`)));
      await document.fonts.ready;
    }, fontManifest.faces);
    const report = await page.evaluate(readFileSync(path.join(skill, 'scripts/check-layout.js'), 'utf8'));
    assert.equal(report.pages, expectedPages);
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.deepEqual(externalRequests, [], 'Preview must render without external asset requests');
    const signalExamples = await page.locator('[data-preset="signal"]').evaluateAll(slides => slides.map(slide => slide.dataset.example));
    assert.deepEqual(signalExamples, catalog.presets.find(preset => preset.id === 'signal').previewPages);
    const iconChecks = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-preset]')].map(slide => slide.dataset.preset))].map(preset => {
      const icons = [...document.querySelectorAll(`[data-preset="${preset}"] svg[data-icon]`)];
      return { preset, icons: icons.map(icon => {
        const rect = icon.getBoundingClientRect();
        return { name: icon.dataset.icon, width: rect.width, height: rect.height, hiddenFromAssistiveTech: icon.getAttribute('aria-hidden') === 'true' };
      }) };
    }));
    for (const preset of iconChecks) {
      assert.ok(preset.icons.length > 0, `${preset.preset}: sample must demonstrate a contextual Phosphor icon`);
      for (const icon of preset.icons) {
        assert.ok(icon.name.startsWith('phosphor:'), `${preset.preset}: unexpected preview icon family`);
        assert.ok(icon.width >= 16 && icon.height >= 16, `${preset.preset}: icon is too small or invisible`);
        assert.ok(icon.hiddenFromAssistiveTech, `${preset.preset}: redundant icon must not duplicate its adjacent text label`);
      }
    }
    const stepperGeometry = await page.evaluate(() => {
      const path = document.querySelector('[data-preset="warm-workshop"] .path');
      const bounds = path.getBoundingClientRect();
      const line = getComputedStyle(path, '::before');
      const steps = [...path.querySelectorAll('li')].map(step => {
        const marker = step.querySelector('.n').getBoundingClientRect();
        const card = step.querySelector('.card').getBoundingClientRect();
        return { markerCenter: marker.x + marker.width / 2, cardCenter: card.x + card.width / 2 };
      });
      return { steps, lineStart: bounds.x + parseFloat(line.left), lineEnd: bounds.right - parseFloat(line.right) };
    });
    assert.ok(stepperGeometry.steps.length > 1, 'Clay must include a multi-step example');
    for (const step of stepperGeometry.steps) {
      assert.ok(Math.abs(step.markerCenter - step.cardCenter) < 1, 'Clay markers must align with their content centers');
    }
    assert.ok(Math.abs(stepperGeometry.lineStart - stepperGeometry.steps[0].markerCenter) < 1,
      'Clay connector must start at the first marker center');
    assert.ok(Math.abs(stepperGeometry.lineEnd - stepperGeometry.steps.at(-1).markerCenter) < 1,
      'Clay connector must end at the last marker center');

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const fontChecks = [];
    for (const preset of catalog.presets) {
      const selectedFamilies = [preset.fonts.heading[0], preset.fonts.body[0]];
      const selectedFaces = fontManifest.faces.filter(face => selectedFamilies.includes(face.family));
      const allowed = new Set(selectedFaces.flatMap(face => face.platformFamilies));
      const selector = `[data-preset="${preset.id}"] h1, [data-preset="${preset.id}"] h2, [data-preset="${preset.id}"] p, [data-preset="${preset.id}"] li`;
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
      assert.ok(nodeIds.length > 0, `Missing sample typography: ${preset.id}`);
      const observed = new Set();
      for (const nodeId of nodeIds) {
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        for (const font of fonts.filter(item => item.glyphCount > 0)) {
          assert.ok(font.isCustomFont, `${preset.id}: fallback font ${font.familyName}`);
          assert.ok(allowed.has(font.familyName), `${preset.id}: unexpected font ${font.familyName}`);
          observed.add(font.familyName);
        }
      }
      const headingNames = selectedFaces.filter(face => face.family === preset.fonts.heading[0]).flatMap(face => face.platformFamilies);
      assert.ok(headingNames.some(name => observed.has(name)), `Heading font is not rendered: ${preset.id}`);
      fontChecks.push({ preset: preset.id, renderedFamilies: [...observed] });
    }
    await cdp.detach();
    const pdfPath = path.join(outputDirectory, 'presets.pdf');
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true });
    const pdfInfo = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    assert.equal(pdfInfo.status, 0, `PDF pagination check requires existing pdfinfo: ${pdfInfo.error?.message ?? pdfInfo.stderr}`);
    const pdfPages = Number(pdfInfo.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    assert.equal(pdfPages, report.pages, 'Exported PDF page count must match the intended slides');
    await page.screenshot({ path: path.join(outputDirectory, 'presets.png'), fullPage: true });
    console.log(JSON.stringify({ outputDirectory, colorPairs: catalog.presets.length * 6, extendedColorPairs, layout: report, pdfPages, fontChecks, iconChecks, externalRequests, stepperGeometry }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
