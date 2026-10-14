const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const [playwrightPath, browserPath] = process.argv.slice(2);
  if (!playwrightPath || !browserPath) throw new Error("Usage: node verify-layout.cjs /absolute/path/to/playwright /absolute/path/to/browser");
  const { chromium } = require(path.resolve(playwrightPath));
  const check = readFileSync(path.resolve(__dirname, "../../skills/prep-that-slide/scripts/check-layout.js"), "utf8");
  const browser = await chromium.launch({ executablePath: path.resolve(browserPath), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.emulateMedia({ media: "print" });
    await page.goto(pathToFileURL(path.resolve(__dirname, "layout-cases.html")).href);
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(check);
    assert.equal(report.pages, 3);
    assert.equal(report.ok, false);
    assert.equal(report.issues.some(issue => issue.page === 1), false, "Healthy page and intentional artwork crop must pass");
    assert.ok(report.issues.some(issue => issue.type === "clipped-text" && issue.element === "clipped"));
    assert.ok(report.issues.some(issue => issue.type === "outside-page" && issue.element === "outside"));
    assert.ok(report.issues.some(issue => issue.type === "hidden-page" && issue.page === 3));
    assert.deepEqual(report.brokenImages, ["Deliberately broken image"]);
    await page.evaluate(() => document.querySelectorAll("#unhealthy, #hidden").forEach(element => element.remove()));
    assert.equal((await page.evaluate(check)).ok, true, "Healthy document must pass");
    await page.setContent("<!doctype html><p>No marked pages</p>");
    const empty = await page.evaluate(check);
    assert.equal(empty.ok, false);
    assert.ok(empty.issues.some(issue => issue.type === "no-pages"));
    console.log("Layout fixture checks passed: valid crop, clipped text, outside label, hidden page, broken image, healthy document, missing pages.");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
