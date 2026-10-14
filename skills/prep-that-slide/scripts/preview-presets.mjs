#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assetsDirectory = new URL('../assets/', import.meta.url);
const fontsDirectory = new URL('fonts/', assetsDirectory);
const FONT_WEIGHTS = [400, 600];
const FONT_MIME_TYPES = { truetype: 'font/ttf', opentype: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

const argumentsList = process.argv.slice(2);
let outputPath;
let requestedIds;
for (let index = 0; index < argumentsList.length; index += 2) {
  const flag = argumentsList[index];
  const value = argumentsList[index + 1];
  if (!value || !['--output', '--presets'].includes(flag)) {
    throw new Error('Usage: node preview-presets.mjs --output preview.html [--presets id,id]');
  }
  if (flag === '--output') outputPath = value;
  else requestedIds = value.split(',');
}
if (!outputPath) throw new Error('A preview output path is required: --output preview.html');
const catalog = JSON.parse(await readFile(new URL('presets.json', assetsDirectory), 'utf8'));
const selected = requestedIds
  ? requestedIds.map(id => {
    const preset = catalog.presets.find(item => item.id === id);
    if (!preset) throw new Error(`Unknown presentation preset: ${id}`);
    return preset;
  })
  : catalog.presets;

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const fontStack = names => names.map(name => ['serif', 'sans-serif', 'monospace'].includes(name) ? name : JSON.stringify(name)).join(', ');

// Fonts are embedded so the preview shows the intended faces offline. A missing face is an error, not a fallback.
async function embeddedFontFaces(requirements) {
  const manifestUrl = new URL('manifest.json', fontsDirectory);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the preview font manifest at ${fileURLToPath(manifestUrl)}: ${error.message}`);
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.faces)) {
    throw new Error(`Font manifest ${fileURLToPath(manifestUrl)} must have version 1 and a faces list.`);
  }
  const rules = [];
  for (const [family, weights] of requirements) {
    for (const weight of weights) {
      const face = manifest.faces.find(item => item.family === family && Number(item.weight) === weight && item.style === 'normal');
      if (!face) throw new Error(`Font manifest has no ${family} ${weight} normal face; the preview cannot show its intended typography.`);
      const mimeType = FONT_MIME_TYPES[face.format];
      if (!mimeType) throw new Error(`Font ${family} ${weight} has unsupported format "${face.format}".`);
      const fileUrl = new URL(face.file, fontsDirectory);
      if (!fileUrl.href.startsWith(fontsDirectory.href)) throw new Error(`Font ${family} ${weight} file "${face.file}" is outside ${fileURLToPath(fontsDirectory)}.`);
      let data;
      try {
        data = await readFile(fileUrl);
      } catch (error) {
        throw new Error(`Cannot read font ${family} ${weight} at ${fileURLToPath(fileUrl)}: ${error.message}`);
      }
      const digest = createHash('sha256').update(data).digest('hex');
      if (digest !== String(face.sha256).toLowerCase()) {
        throw new Error(`Font ${family} ${weight} at ${fileURLToPath(fileUrl)} does not match its manifest sha256.`);
      }
      rules.push(`@font-face { font-family: ${JSON.stringify(family)}; font-style: normal; font-weight: ${weight}; font-display: block; src: url(data:${mimeType};base64,${data.toString('base64')}) format(${JSON.stringify(face.format)}); }`);
    }
  }
  return rules.join('\n');
}

// One set of fictional facts keeps every style comparable.
const FACTS = { sessions: 6, entries: 48, forms: 19, evening: 15, notEvening: 4 };
const SAMPLE_LABEL = 'Fictional sample · Community workshops, May';
const eveningPercent = `${(FACTS.evening / FACTS.forms * 100).toFixed(4)}%`;
const notEveningPercent = `${(FACTS.notEvening / FACTS.forms * 100).toFixed(4)}%`;
const FEEDBACK_CHART_LABEL = `${FACTS.evening} of ${FACTS.forms} feedback forms asked for an evening option; ${FACTS.notEvening} did not.`;
const formMarks = () => Array.from({ length: FACTS.forms }, (_, index) => `<span class="${index < FACTS.evening ? 'yes' : 'no'}"></span>`).join('');
const arrowRight = width => `<svg class="arrow" width="${width}" height="16" viewBox="0 0 ${width} 16" aria-hidden="true"><path d="M1 8H${width - 3}M${width - 11} 2l8 6-8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Phosphor regular SVGs are inlined so previews render offline. Each sits beside a text label, so it stays hidden from assistive technology.
const ICON_NAMES = ['calendar-blank', 'chart-bar', 'check-circle', 'list-checks', 'magnifying-glass'];
const icons = {};
for (const name of ICON_NAMES) {
  const iconUrl = new URL(`icons/phosphor/${name}.svg`, assetsDirectory);
  let svg;
  try {
    svg = await readFile(iconUrl, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read Phosphor icon ${name} at ${fileURLToPath(iconUrl)}: ${error.message}`);
  }
  icons[name] = svg.trim().replace('<svg ', `<svg class="icon" data-icon="phosphor:${name}" aria-hidden="true" focusable="false" `);
}

const layouts = {
  'signal': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>Feedback points to an evening pilot</h1>
  <p class="signal-lead">The returned forms support one trial. They do not tell us how many people will attend.</p>
  <div class="signal-evidence">
    <section class="signal-panel"><h2 class="signal-panel-title">What the attendance log records${icons['calendar-blank']}</h2>
      <p class="signal-small">Attendance entries across the May sessions</p>
      <dl class="signal-counts"><div><dt>attendance entries</dt><dd class="num">${FACTS.entries}</dd></div><div><dt>sessions</dt><dd class="num">${FACTS.sessions}</dd></div></dl>
      <p class="signal-small">One person may appear more than once.</p>
    </section>
    <figure class="signal-panel"><h2 class="signal-panel-title">What the feedback forms say${icons['chart-bar']}</h2>
      <p class="signal-small">All ${FACTS.forms} returned forms, using the same scale</p>
      <div class="signal-bars" role="img" aria-label="${FEEDBACK_CHART_LABEL}">
        <div class="signal-bar-row"><span>Evening option</span><span class="signal-track"><span class="signal-fill" style="width: ${eveningPercent}"></span></span><strong class="num">${FACTS.evening}</strong></div>
        <div class="signal-bar-row"><span>No request</span><span class="signal-track"><span class="signal-fill signal-neutral" style="width: ${notEveningPercent}"></span></span><strong class="num">${FACTS.notEvening}</strong></div>
      </div>
      <figcaption class="signal-small">Counts refer to forms, not all attendees.</figcaption>
    </figure>
  </div>
  <div class="signal-takeaways"><div><strong class="num">${FACTS.evening} / ${FACTS.forms}</strong><p>returned forms ask for an evening option.</p></div><div><strong>One pilot</strong><p>A small trial fits the evidence we have.</p></div></div>`,
    `<p class="kicker">Signal · Fictional workshop planning</p>
  <h1>Prepare the pilot, then open booking</h1>
  <p class="signal-lead">Agree the practical details and check the booking experience before announcing a date.</p>
  <ol class="signal-stages" aria-label="Proposed sequence, not completion progress">
    <li><span class="signal-stage-number">01</span><h2>Choose</h2><p>Topic and time</p></li>
    <li><span class="signal-stage-number">02</span><h2>Confirm</h2><p>Venue and cost</p></li>
    <li><span class="signal-stage-number">03</span><h2>Check</h2><p>Mobile booking</p></li>
    <li><span class="signal-stage-number">04</span><h2>Approve</h2><p>Plan and budget</p></li>
    <li><span class="signal-stage-number">05</span><h2>Announce</h2><p>Open booking</p></li>
  </ol>
  <div class="signal-stage-groups"><p>Prepare the details</p><p>Check and approve</p><p>Release</p></div>
  <p class="signal-small signal-sequence-note">Proposed order. No work is marked complete.</p>
  <div class="signal-plan-notes">
    <section class="signal-panel"><h2>Keep the trial small</h2><p>Plan one evening session. The feedback does not justify a full programme yet.</p></section>
    <section class="signal-panel"><h2>Confirm the cost</h2><p>Check the venue and facilitator before asking for budget approval.</p></section>
    <section class="signal-panel"><h2>Check on a phone</h2><p>Review the booking steps before inviting people to register.</p></section>
  </div>`,
    `<p class="kicker">Signal · Fictional workshop planning</p>
  <h1>One pilot, three things to settle</h1>
  <p class="signal-lead">Use the feedback to choose a small next step, then check what it needs.</p>
  <figure class="signal-map" aria-label="One evening pilot requires a topic and time, venue and cost confirmation, and a mobile booking review.">
    <svg class="signal-connectors" viewBox="0 0 1168 408" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M452 152H286m10-7-10 7 10 7"/><path d="M716 152H882m-10-7 10 7-10 7"/><path d="M584 280V312m-7-10 7 10 7-10"/></g></svg>
    <div class="signal-map-node signal-map-left"><h2>Topic + time</h2><p>Choose a workshop that<br>suits an evening slot.</p></div>
    <div class="signal-map-center"><h2>One evening<br>pilot</h2><p>The proposed next step</p></div>
    <div class="signal-map-node signal-map-right"><h2>Venue + cost</h2><p>Confirm availability,<br>a facilitator and the budget.</p></div>
    <div class="signal-map-node signal-map-bottom"><h2>Mobile booking</h2><p>Review before announcing the session.</p></div>
  </figure>
  <p class="signal-map-note"><strong>Decision requested:</strong> approve planning for one pilot and a mobile booking review. No budget is approved yet.</p>`,
    `<p class="kicker">Signal · Fictional workshop planning</p>
  <h1>Keep the plan within the evidence</h1>
  <p class="signal-lead">Each limit or open task has a practical response.</p>
  <div class="signal-response-head"><h2>${icons['magnifying-glass']}What we know</h2><h2>${icons['list-checks']}How to respond</h2></div>
  <ol class="signal-responses">
    <li><div class="signal-issue"><h3>Only ${FACTS.forms} forms were returned</h3><p>They cannot predict attendance.</p></div><span class="signal-response-arrow">${arrowRight(28)}</span><div class="signal-action"><p>Plan one trial before considering more sessions.</p></div></li>
    <li><div class="signal-issue"><h3>${FACTS.entries} entries may include repeat visits</h3><p>Entries are not a count of different people.</p></div><span class="signal-response-arrow">${arrowRight(28)}</span><div class="signal-action"><p>Use ${FACTS.evening} of ${FACTS.forms} forms to describe the feedback.</p></div></li>
    <li><div class="signal-issue"><h3>No budget is approved</h3><p>The venue and facilitator need confirming.</p></div><span class="signal-response-arrow">${arrowRight(28)}</span><div class="signal-action"><p>Confirm costs and get approval before announcing.</p></div></li>
    <li><div class="signal-issue"><h3>A booking review is proposed</h3><p>This sample contains no booking test results.</p></div><span class="signal-response-arrow">${arrowRight(28)}</span><div class="signal-action"><p>Review the steps on a phone before opening booking.</p></div></li>
  </ol>`,
  ],
  'clear-brief': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>Feedback backs an evening pilot</h1>
  <div class="brief">
    <div class="brief-row"><h2>Answer</h2><p class="answer">Yes, for one pilot. ${FACTS.evening} of ${FACTS.forms} feedback forms ask for an evening option.</p></div>
    <div class="brief-row"><h2>Evidence</h2><figure>
      <div class="stack"><span class="yes"><span class="num">${FACTS.evening}</span> ask for an evening option</span><span class="no"><span class="num">${FACTS.notEvening}</span> do not</span></div>
      <figcaption class="caption">All ${FACTS.forms} forms returned after the ${FACTS.sessions} sessions in May, drawn to scale.</figcaption>
    </figure></div>
    <div class="brief-row"><h2>Limits</h2><p>The forms show what respondents want, not every attendee. The ${FACTS.entries} attendance entries can count one person more than once, so they give no response rate.</p></div>
  </div>`,
    `<p class="kicker">Next step</p>
  <h1>Plan first.<br>Announce after approval.</h1>
  <div class="route">
    <div class="step"><span class="n">1</span><h2>Choose topic and time</h2><p>One workshop topic in one evening slot.</p></div>
    <div class="link">${arrowRight(48)}</div>
    <div class="step"><span class="n">2</span><h2>Confirm the details</h2><p>Check venue, facilitator and cost.</p></div>
    <div class="link"><span class="tag">Approval</span>${arrowRight(112)}</div>
    <div class="step later"><span class="n">3</span><h2>Announce</h2><p>Open booking once the plan is approved.</p></div>
  </div>
  <p class="alongside">${icons['magnifying-glass']}<span><strong>Alongside:</strong> review how booking works on phones before booking opens.</span></p>
  <div class="decision"><h2>Decision today</h2><p class="ask">Approve planning for one evening pilot and a mobile booking review.</p><p class="limit">No budget is approved. The feedback does not support an attendance forecast.</p></div>`,
  ],
  'mono-brief': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>The feedback supports<br>one evening pilot</h1>
  <p class="intro">${FACTS.evening} of ${FACTS.forms} returned forms ask for an evening option. Start with one session and check what happens.</p>
  <table class="evidence-table">
    <thead><tr><th scope="col">What we have</th><th scope="col">Recorded</th><th scope="col">What it tells us</th></tr></thead>
    <tbody>
      <tr><th scope="row">Feedback forms</th><td class="num">${FACTS.forms} returned</td><td>${FACTS.evening} ask for evenings; ${FACTS.notEvening} do not.</td></tr>
      <tr><th scope="row">Attendance entries</th><td class="num">${FACTS.entries} across ${FACTS.sessions} sessions</td><td>Repeat visits may count more than once.</td></tr>
      <tr><th scope="row">Response rate</th><td>Not established</td><td>We do not know how many individual attendees replied.</td></tr>
    </tbody>
  </table>
  <aside class="takeaway">${icons['chart-bar']}<div><h2>Use the feedback to plan a trial</h2><p>It supports testing an evening slot. It does not tell us how many people will attend.</p></div></aside>`,
    `<p class="kicker">Recommendation</p>
  <h1>Agree the plan.<br>Then open booking.</h1>
  <div class="planning">
    <div><h2>Before the announcement</h2>
      <ol class="plan-steps">
        <li><span class="step-number">01</span><div><h3>Choose the topic and time</h3><p>Plan one workshop in one evening slot.</p></div></li>
        <li><span class="step-number">02</span><div><h3>Confirm the practical details</h3><p>Check the venue, facilitator and cost.</p></div></li>
        <li><span class="step-number">03</span><div><h3>Review booking on phones</h3><p>Check the route before people use it.</p></div></li>
      </ol>
    </div>
    <aside class="approval"><h2>For approval today</h2><p class="request">Planning for one evening pilot and a mobile booking review.</p><p class="limit">No budget is approved yet. The feedback does not support an attendance forecast.</p></aside>
  </div>
  <aside class="takeaway">${icons['check-circle']}<div><h2>Announce after the plan is approved</h2><p>The topic, venue, facilitator and cost should be agreed before booking opens.</p></div></aside>`,
  ],
  'monochrome-grid': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>One evening pilot.<br>Backed by the feedback.</h1>
  <div class="signal-grid">
    <figure class="signal">
      <p class="count num">${FACTS.evening}<span> / ${FACTS.forms}</span></p>
      <p class="meaning">returned forms ask for an evening option.</p>
      <div class="marks" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div>
      <figcaption>Filled: ask for evenings. Outlined: do not.</figcaption>
    </figure>
    <div class="context">
      <dl class="sample-counts"><div><dt>Sessions held</dt><dd class="num">${FACTS.sessions}</dd></div><div><dt>Attendance entries</dt><dd class="num">${FACTS.entries}</dd></div></dl>
      <div class="context-limit"><h2>Entries are not unique people</h2><p>Repeat visits can count more than once. We cannot calculate a response rate from these entries.</p></div>
    </div>
  </div>
  <p class="interpretation">The feedback supports planning a trial. It does not support an attendance forecast.</p>`,
    `<p class="kicker">Recommendation</p>
  <h1>Plan the pilot.<br>Approve before booking.</h1>
  <ol class="pilot-grid" aria-label="Planning sequence">
    <li><span class="index">01</span><h2>Choose</h2><p>One workshop topic.<br>One evening slot.</p></li>
    <li><span class="index">02</span><h2>Confirm</h2><p>Venue, facilitator and cost. Review booking on phones.</p></li>
    <li><span class="index">03</span><h2>Announce</h2><p>Open booking after the plan is approved.</p></li>
  </ol>
  <aside class="decision-bar">${icons['check-circle']}<div><h2>Decision today</h2><p>Approve planning for one evening pilot and a mobile booking review.</p></div></aside>
  <p class="interpretation">No budget is approved yet. The feedback does not predict attendance.</p>`,
  ],
  'orange-white': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <div class="evidence-split">
    <div class="explanation"><h1>Try an evening.<br>Start with one<br>workshop.</h1><p class="lead">${FACTS.evening} of ${FACTS.forms} returned forms ask for an evening option. The feedback gives us a reason to plan one pilot.</p><p class="source-line">Based on the forms returned after ${FACTS.sessions} sessions in May.</p></div>
    <figure class="feedback-chart">
      <div class="chart-label">${icons['chart-bar']}<h2>What respondents asked for</h2></div>
      <div class="chart-row"><div class="chart-heading"><span>Evening option</span><strong class="num">${FACTS.evening}</strong></div><div class="bar-track"><span class="bar yes" style="width:${eveningPercent}"></span></div></div>
      <div class="chart-row"><div class="chart-heading"><span>Did not ask for evenings</span><strong class="num">${FACTS.notEvening}</strong></div><div class="bar-track"><span class="bar no" style="width:${notEveningPercent}"></span></div></div>
      <div class="chart-axis"><span>0 forms</span><span>${FACTS.forms} forms</span></div>
      <figcaption>Both bars use the same scale: all ${FACTS.forms} returned forms.</figcaption>
    </figure>
  </div>
  <div class="reading-notes"><div><h2>What the feedback supports</h2><p>Planning one evening pilot. It does not tell us how many people will attend.</p></div><div><h2>What the attendance count means</h2><p>${FACTS.entries} entries may include repeat visits, so the response rate is unknown.</p></div></div>`,
    `<p class="kicker">Recommendation</p>
  <h1 class="plan-title">A clear plan before<br>the first booking.</h1>
  <ol class="open-steps" aria-label="Planning sequence">
    <li><span class="step-number">01</span><h2>Pick the session</h2><p>Choose one workshop topic and one evening time.</p></li>
    <li><span class="step-number">02</span><h2>Check the details</h2><p>Confirm venue, facilitator and cost. Review mobile booking.</p></li>
    <li><span class="step-number">03</span><h2>Open booking</h2><p>Announce the session once the plan is approved.</p></li>
  </ol>
  <div class="planning-decision"><div class="decision-copy"><h2>${icons['check-circle']} For approval today</h2><p>Plan one evening pilot and review booking on phones.</p></div><p class="boundary">No budget is approved yet.<br>No attendance forecast is made.</p></div>`,
  ],
  'navy-orange': [
    `<div class="evidence-layout">
    <figure class="evidence-panel">
      <h2>Returned feedback</h2>
      <p class="response-count num">${FACTS.evening}<span> / ${FACTS.forms}</span></p>
      <p class="response-label">forms ask for an evening option.</p>
      <div class="response-marks" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div>
      <figcaption>Filled: ask for evenings.<br>Outlined: do not.</figcaption>
      <dl class="sample-details"><div><dt>Sessions held</dt><dd class="num">${FACTS.sessions}</dd></div><div><dt>Attendance entries</dt><dd class="num">${FACTS.entries}</dd></div></dl>
    </figure>
    <div class="evidence-copy">
      <p class="kicker">${SAMPLE_LABEL}</p>
      <h1>Make room for<br>one evening pilot</h1>
      <p class="lead">Most returned forms ask for an evening option. Use that feedback to plan one trial session.</p>
      <div class="evidence-limit"><h2>What the numbers tell us</h2><p>The ${FACTS.entries} attendance entries can include repeat visits. They do not tell us how many individual attendees replied.</p></div>
      <aside class="evidence-takeaway">${icons['chart-bar']}<p>The feedback supports a trial,<br>not an attendance forecast.</p></aside>
    </div>
  </div>`,
    `<p class="kicker">Recommendation</p>
  <h1 class="planning-title">Plan one session.<br>Agree before announcing.</h1>
  <div class="planning-layout">
    <ol class="planning-steps" aria-label="Planning steps">
      <li><span class="step-number">01</span><div><h2>Choose the topic and time</h2><p>One workshop in one evening slot.</p></div></li>
      <li><span class="step-number">02</span><div><h2>Confirm the details</h2><p>Check venue, facilitator and cost.</p></div></li>
      <li><span class="step-number">03</span><div><h2>Review booking on phones</h2><p>Check the route before booking opens.</p></div></li>
    </ol>
    <aside class="planning-decision">
      <h2>${icons['check-circle']} Decision today</h2>
      <p class="request">Approve planning for one evening pilot and a mobile booking review.</p>
      <p class="limit">No budget is approved yet. Announce the session after the plan is agreed.</p>
    </aside>
  </div>`,
  ],
  'editorial-review': [
    `<div class="editorial-masthead"><p class="kicker">${SAMPLE_LABEL}</p><div class="editorial-motif" aria-hidden="true"><span></span><span></span><span></span></div></div>
  <div class="investigation">
    <div class="question-copy"><h1>An evening<br>session?</h1><p class="lead">${FACTS.evening} of ${FACTS.forms} returned forms<br>asked for one.</p><p class="source-context">Feedback after ${FACTS.sessions} workshops in May.</p></div>
    <figure class="response-sheet"><h2>${icons['chart-bar']}What the returned forms say</h2><div class="response-dots" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div><figcaption><span><b>${FACTS.evening}</b> ask for evenings</span><span><b>${FACTS.notEvening}</b> do not</span></figcaption><p class="unit-label">One circle per returned form.</p></figure>
  </div>
  <div class="editorial-reading">
    <section class="reading-limit"><h2>Who does this represent?</h2><p>Only the people who returned a form. The ${FACTS.entries} attendance entries can include repeat visits, so they do not give us a response rate.</p></section>
    <section class="reading-action"><h2>What should we do with it?</h2><p>Plan one evening pilot. The feedback supports a trial; it does not predict attendance.</p></section>
  </div>`,
    `<div class="editorial-masthead"><p class="kicker">Recommendation</p><div class="editorial-motif" aria-hidden="true"><span></span><span></span><span></span></div></div>
  <h1 class="editorial-plan-title">Plan it. Check it.<br>Then open booking.</h1>
  <ol class="editorial-sequence" aria-label="Planning sequence">
    <li><span class="step-mark">01</span><h2>Choose the topic and time</h2><p>One workshop in one evening slot.</p></li>
    <li><span class="step-mark">02</span><h2>Confirm the details</h2><p>Venue, facilitator, cost and mobile booking.</p></li>
    <li><span class="step-mark">03</span><h2>Announce after approval</h2><p>Open booking once the plan is agreed.</p></li>
  </ol>
  <aside class="editorial-decision"><h2>Decision today</h2><div><p>Approve planning for one evening pilot and a mobile booking review.</p><p class="limit">No budget is approved yet. The feedback does not predict attendance.</p></div></aside>`,
  ],
  'technical-notes': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>The feedback supports<br>an evening pilot</h1>
  <figure class="blueprint-evidence">
    <div class="metric-panel"><p class="metric num">${FACTS.evening}<span> / ${FACTS.forms}</span></p><p>returned forms ask for an evening option.</p></div>
    <div class="chart-panel"><h2>What the returned forms say</h2>
      <div class="form-units" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div>
      <div class="chart-legend"><p><strong>${FACTS.evening}</strong> ask for evenings</p><p><strong>${FACTS.notEvening}</strong> do not</p></div>
      <figcaption>One block per returned form, after ${FACTS.sessions} sessions in May.</figcaption>
    </div>
  </figure>
  <div class="evidence-reading">
    <div><h2>Enough to plan a trial</h2><p>Start with one evening session. The feedback does not tell us how many people will attend.</p></div>
    <div><h2>Attendance entries are not people</h2><p>The ${FACTS.entries} entries can include repeat visits. We cannot calculate a response rate from ${FACTS.forms} forms and ${FACTS.entries} entries.</p></div>
  </div>`,
    `<p class="kicker">Recommendation</p>
  <h1>Plan first.<br>Open booking after approval.</h1>
  <div class="blueprint-flow">
    <div class="preparation">
      <section class="input"><h2>Plan the workshop</h2><p>Topic, time, venue, facilitator and cost.</p></section>
      <section class="input"><h2>Check mobile booking</h2><p>Review the route before people use it.</p></section>
    </div>
    <svg class="merge" viewBox="0 0 64 284" preserveAspectRatio="none" aria-hidden="true"><path d="M0 67H24V142H60M0 217H24V142M52 134l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    <section class="approval-node">${icons['check-circle']}<h2>Approve<br>the plan</h2><p>Agree the details before booking opens.</p></section>
    <div class="flow-arrow">${arrowRight(48)}</div>
    <section class="release-node"><p class="release-label">After approval</p><h2>Announce and<br>open booking</h2><p>One workshop in one evening slot.</p></section>
  </div>
  <div class="planning-request"><h2>Decision today</h2><div><p>Approve planning for one evening pilot and a mobile booking review.</p><p class="limit">No budget is approved yet. The feedback does not predict attendance.</p></div></div>`,
  ],
  'bold-story': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>Most feedback asks for an evening session.</h1>
  <figure class="focal">
    <div class="focal-head">
      <p class="yes-label"><span class="count num">${FACTS.evening}</span><span class="count-label">asked for an evening option</span></p>
      <p class="no-label"><span class="count num">${FACTS.notEvening}</span><span class="count-label">did not</span></p>
    </div>
    <div class="segments" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div>
    <figcaption class="caption">One block per returned feedback form, ${FACTS.forms} in all. This is respondents only: the ${FACTS.entries} attendance entries may include repeat visits, so it is not everyone's view.</figcaption>
  </figure>`,
    `<p class="kicker">Next step</p>
  <h1>Plan one evening pilot. Announce only after approval.</h1>
  <ol class="steps3" aria-label="Planning steps">
    <li><span class="n">1</span><h2>Pick topic and time</h2><p>One workshop, one evening slot.</p></li>
    <li><span class="n">2</span><h2>Confirm the details</h2><p>Venue, facilitator and cost.</p></li>
    <li class="later"><span class="n">3</span><h2>Announce</h2><p>Open booking after a mobile check.</p><span class="tag">after approval</span></li>
  </ol>
  <div class="today"><h2>${icons['calendar-blank']}Today</h2><p class="ask">Approve planning and a mobile booking review.</p><p class="limit">No budget is approved. No attendance forecast is made.</p></div>`,
  ],
  'data-room': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>Most returned forms ask for an evening option</h1>
  <div class="ledger-evidence">
    <table class="ledger-table">
      <caption>${icons['list-checks']}Count of ${FACTS.forms} returned forms</caption>
      <thead><tr><th scope="col">Response</th><th scope="col">Forms</th><th scope="col">Share</th></tr></thead>
      <tbody>
        <tr><th scope="row">Asked for evenings</th><td class="num">${FACTS.evening}</td><td class="num">${(FACTS.evening / FACTS.forms * 100).toFixed(1)}%</td></tr>
        <tr><th scope="row">Did not ask</th><td class="num">${FACTS.notEvening}</td><td class="num">${(FACTS.notEvening / FACTS.forms * 100).toFixed(1)}%</td></tr>
      </tbody>
      <tfoot><tr><th scope="row">Returned forms</th><td class="num">${FACTS.forms}</td><td class="num">${(100).toFixed(1)}%</td></tr></tfoot>
    </table>
    <figure class="ledger-chart">
      <figcaption>${icons['chart-bar']}Share of all ${FACTS.forms} returned forms, 0 to 100%</figcaption>
      <div class="ledger-row"><span>Asked for evenings</span><strong class="num">${(FACTS.evening / FACTS.forms * 100).toFixed(1)}%</strong><span class="ledger-track" aria-hidden="true"><span class="ledger-fill" style="width: ${eveningPercent}"></span></span></div>
      <div class="ledger-row ledger-row-no"><span>Did not ask</span><strong class="num">${(FACTS.notEvening / FACTS.forms * 100).toFixed(1)}%</strong><span class="ledger-track" aria-hidden="true"><span class="ledger-fill" style="width: ${notEveningPercent}"></span></span></div>
      <div class="ledger-scale num" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    </figure>
  </div>
  <dl class="ledger-verdict">
    <div class="ledger-supports"><dt>Supports</dt><dd>Planning one evening pilot</dd></div>
    <div><dt>Does not support</dt><dd>An attendance forecast</dd></div>
  </dl>
  <p class="ledger-context">${icons['calendar-blank']}<span><strong>${FACTS.entries} attendance entries across ${FACTS.sessions} sessions.</strong> Entries count visits and one person may appear more than once, so there is no response rate.</span></p>`,
    `<div class="ledger-brief">
    <div><p class="kicker">Next step</p><h1>One approval point before booking opens</h1></div>
    <section class="ledger-request">
      <h2 class="ledger-label">${icons['check-circle']}Decision requested</h2>
      <p class="ledger-ask">Approve planning for one evening pilot and a mobile booking review.</p>
      <dl class="ledger-open"><div><dt>Budget</dt><dd>None approved</dd></div><div><dt>Mobile booking review</dt><dd>Proposed; no test results</dd></div></dl>
    </section>
  </div>
  <p class="ledger-sequence-note">${icons['list-checks']}Proposed order. No step is complete.</p>
  <div class="ledger-phases"><p>Before approval</p><p class="ledger-gate">After plan and budget approval</p></div>
  <ol class="ledger-steps" aria-label="Proposed sequence">
    <li><span class="ledger-step num">1</span><h2>Choose</h2><p>Topic and evening time slot</p></li>
    <li><span class="ledger-step num">2</span><h2>Confirm</h2><p>Venue, facilitator and cost</p></li>
    <li class="ledger-after-gate"><span class="ledger-step num">3</span><h2>Announce</h2><p>Open booking after the mobile booking review</p></li>
  </ol>`,
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>${FACTS.evening} of ${FACTS.forms} returned forms ask for evenings</h1>
  <figure class="ledger-donut">
    <div class="ledger-donut-chart">
      <svg viewBox="0 0 120 120" role="img" aria-label="${FEEDBACK_CHART_LABEL}">
        <circle class="ledger-donut-yes" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="${(FACTS.evening / FACTS.forms * 100).toFixed(4)} 100" transform="rotate(-90 60 60)"/>
        <circle class="ledger-donut-no" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="${(FACTS.notEvening / FACTS.forms * 100).toFixed(4)} 100" stroke-dashoffset="-${(FACTS.evening / FACTS.forms * 100).toFixed(4)}" transform="rotate(-90 60 60)"/>
      </svg>
      <p class="ledger-donut-total" aria-hidden="true"><span class="num">${FACTS.forms}</span>returned forms</p>
    </div>
    <div class="ledger-donut-side">
      <dl class="ledger-donut-legend">
        <div class="ledger-donut-row"><dt>Asked for evenings</dt><dd class="num">${FACTS.evening}</dd><dd class="num">${(FACTS.evening / FACTS.forms * 100).toFixed(1)}%</dd></div>
        <div class="ledger-donut-row ledger-donut-row-no"><dt>Did not ask</dt><dd class="num">${FACTS.notEvening}</dd><dd class="num">${(FACTS.notEvening / FACTS.forms * 100).toFixed(1)}%</dd></div>
      </dl>
      <p class="ledger-donut-takeaway">Supports planning one evening pilot. It does not predict attendance.</p>
    </div>
    <figcaption>${icons['list-checks']}Shares of the ${FACTS.forms} returned forms, not of all attendees.</figcaption>
  </figure>`,
  ],
  'brutalist-cyberpunk': [
    `<p class="kicker">${SAMPLE_LABEL}</p>
  <h1>Try one<br>evening session.</h1>
  <figure class="reset-evidence">
    <div class="reset-bar">
      <p class="reset-block reset-yes"><span class="reset-count num">${FACTS.evening}</span><span>forms ask for an evening option</span></p>
      <p class="reset-block reset-no"><span class="reset-count num">${FACTS.notEvening}</span><span>do not</span></p>
    </div>
    <figcaption>${icons['chart-bar']}Full bar = all ${FACTS.forms} returned forms, drawn to scale.</figcaption>
  </figure>
  <div class="reset-reading">
    <p class="reset-context">${icons['calendar-blank']}<span><strong>${FACTS.entries} attendance entries, ${FACTS.sessions} sessions.</strong> Entries count visits, not people, so there is no response rate.</span></p>
    <dl class="reset-verdict"><div><dt>Supports</dt><dd>One evening pilot</dd></div><div class="reset-limit"><dt>Does not support</dt><dd>An attendance forecast</dd></div></dl>
  </div>`,
    `<div class="reset-plan">
    <p class="kicker">Next step</p>
    <h1>Approve the plan.<br>Then open booking.</h1>
    <p class="reset-order">${icons['list-checks']}Proposed order. Nothing is done yet.</p>
    <ol class="reset-steps">
      <li><span class="reset-step num">01</span><div><h2>Choose</h2><p>Topic and one evening time slot</p></div></li>
      <li><span class="reset-step num">02</span><div><h2>Confirm</h2><p>Venue, facilitator and cost</p></div></li>
    </ol>
    <p class="reset-gate">Approval: plan and budget</p>
    <ol class="reset-steps reset-after" start="3">
      <li><span class="reset-step num">03</span><div><h2>Announce</h2><p>Open booking after the mobile booking review</p></div></li>
    </ol>
  </div>
  <aside class="reset-decision">
    <h2 class="reset-label">${icons['check-circle']}Decision today</h2>
    <p class="reset-ask">Approve planning for one evening pilot and a mobile booking review.</p>
    <ul class="reset-open"><li>No budget approved</li><li>Booking review proposed. No results yet.</li></ul>
  </aside>`,
  ],
  'warm-workshop': [
    `<div class="split">
    <figure class="forms-panel">
      <div class="forms" role="img" aria-label="${FEEDBACK_CHART_LABEL}">${formMarks()}</div>
      <ul class="legend"><li>${FACTS.evening} asked for an evening option</li><li class="no">${FACTS.notEvening} did not</li></ul>
    </figure>
    <div class="talk">
      <p class="kicker">${SAMPLE_LABEL}</p>
      <h1>What ${FACTS.forms} feedback forms told us</h1>
      <p class="lead">Most returned forms ask for an evening session. That supports planning one trial.</p>
      <div class="keep"><h2>Keep in mind</h2><p>This feedback comes only from returned forms. The ${FACTS.entries} attendance entries may include repeat visits, so we don't know how many attendees replied.</p></div>
      <div class="prompt"><h2>Question for the team</h2><p>Which topic would suit an evening slot?</p></div>
    </div>
  </div>`,
    `<p class="kicker">Next step</p>
  <h1 class="path-title">Plan the pilot in three steps</h1>
  <ol class="path" aria-label="Planning steps">
    <li><span class="n">1</span><div class="card"><h2>Choose a topic<br>and time</h2><p>One workshop.<br>One evening slot.</p></div></li>
    <li><span class="n">2</span><div class="card"><h2>Confirm the<br>details</h2><p>Check the venue, a facilitator and the cost.</p></div></li>
    <li class="later"><span class="n">3</span><div class="card"><h2>Announce<br>the session</h2><p>Check booking on phones, then open booking.</p><span class="tag">After approval</span></div></li>
  </ol>
  <div class="ask"><h2>${icons['check-circle']}Decision today</h2><p>Approve planning for one evening pilot and a mobile booking review.</p><p class="limit">No budget is approved yet. The feedback does not predict attendance.</p></div>`,
  ],
};

const PAGE_NAMES = ['evidence', 'decision'];
const families = [...new Set(selected.flatMap(preset => [preset.fonts.heading[0], preset.fonts.body[0]]))];
const fontRequirements = new Map();
for (const preset of selected) {
  for (const [family, weights] of [
    [preset.fonts.heading[0], preset.fonts.headingWeight ? [preset.fonts.headingWeight] : FONT_WEIGHTS],
    [preset.fonts.body[0], FONT_WEIGHTS],
  ]) {
    const required = fontRequirements.get(family) || new Set();
    weights.forEach(weight => required.add(weight));
    fontRequirements.set(family, required);
  }
}
const fontFaces = await embeddedFontFaces(fontRequirements);
const starterCss = await readFile(new URL('presentation.css', assetsDirectory), 'utf8');
const galleryCss = await readFile(new URL('preset-preview.css', assetsDirectory), 'utf8');

const sections = selected.map(preset => {
  const pages = layouts[preset.id];
  if (!pages) throw new Error(`No sample layout exists for preset ${preset.id}; add one to preview-presets.mjs.`);
  const pageNames = preset.previewPages || PAGE_NAMES;
  if (pageNames.length !== pages.length) throw new Error(`Preset ${preset.id} has ${pages.length} layouts but ${pageNames.length} page names.`);
  const [, padX = preset.scale.padding] = preset.scale.padding.split(' ');
  const variables = [
    ...Object.entries(preset.colors).map(([key, value]) => `--${key}: ${value}`),
    `--font-heading: ${fontStack(preset.fonts.heading)}`,
    `--font-body: ${fontStack(preset.fonts.body)}`,
    `--heading-size: ${preset.scale.headingPx}px`,
    `--heading-weight: ${preset.fonts.headingWeight || 600}`,
    `--body-size: ${preset.scale.bodyPx}px`,
    `--gap: ${preset.scale.gapPx}px`,
    `--page-padding: ${preset.scale.padding}`,
    `--pad-x: ${padX}`,
  ].join('; ');
  const heading = preset.fonts.heading[0];
  const body = preset.fonts.body[0];
  const headingWeights = preset.fonts.headingWeight || "400 and 600";
  const type = heading === body ? `${heading} 400 and 600` : `${heading} ${headingWeights} for headings, ${body} 400 and 600 for text`;
  const note = `<aside class="chooser-note" data-screen-only aria-label="About ${escapeHtml(preset.name)}">
  <h2>${escapeHtml(preset.name)}</h2>
  <p><strong>Suits:</strong> ${escapeHtml(preset.use)}.</p>
  <p><strong>Composition:</strong> ${escapeHtml(preset.composition)}</p>
  <p><strong>Visuals:</strong> ${escapeHtml(preset.visuals)}</p>
  <p><strong>Type:</strong> ${escapeHtml(type)}, embedded from the bundled font files.</p>
</aside>`;
  const slides = pages.map((content, index) => `<section data-slide data-preset="${escapeHtml(preset.id)}" data-example="${escapeHtml(pageNames[index])}" style="${escapeHtml(variables)}" aria-label="${escapeHtml(preset.name)} sample, ${escapeHtml(pageNames[index])} page">
  ${index === 0 ? content.replace(SAMPLE_LABEL, `${escapeHtml(preset.name)} · Fictional workshops, May`) : content}
  <p class="folio">${String(index + 1).padStart(2, '0')}</p>
</section>`);
  return [note, ...slides].join('\n');
});
const pageCount = selected.reduce((total, preset) => total + layouts[preset.id].length, 0);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prep That Slide - Preset Catalogue</title><style>${fontFaces}
${starterCss}
:root { --page-width: ${catalog.canvas.widthPx}px; --page-height: ${catalog.canvas.heightPx}px; }
@media print { @page { size: ${catalog.canvas.widthPx}px ${catalog.canvas.heightPx}px; } }
${galleryCss}</style></head><body>
<header class="gallery-intro" data-screen-only>
  <h1>Prep That Slide</h1>
  <p>A fictional sample about community workshops. Each style presents the same facts on ${catalog.canvas.widthPx} × ${catalog.canvas.heightPx} pages: what the feedback supports and the planning decision. Some include additional diagram and action layouts. These notes show on screen only and do not print.</p>
</header>
${sections.join('\n')}
</body></html>`;
await writeFile(outputPath, html);
console.log(JSON.stringify({ output: outputPath, presets: selected.map(item => item.id), pages: pageCount, fonts: families, assets: fileURLToPath(assetsDirectory) }));
