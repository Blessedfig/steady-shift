// Automatic accessibility and safety check for the public pages and sign-in screens.
// Fails on any "serious" or "critical" WCAG 2.2 AA problem (axe-core), sideways scrolling on a phone,
// or a Content-Security-Policy block. Run it the way .github/workflows/site-check.yml does.
const { chromium } = require('playwright');
const fs = require('fs');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE || 'http://localhost:8765/steady-shift/';
const PAGES = ['', 'demo.html', 'get-app.html', 'privacy.html', 'accessibility.html', '404.html', 'app/', 'desk/'];
(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const width of [390, 1280]) for (const path of PAGES) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const csp = [];
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text()) && !/fonts\.g/.test(m.text())) csp.push(m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|supabase\.co/, r => r.abort());
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const cspSeen = csp.splice(0); // only the page's own loading counts
    await page.evaluate(axeSrc);
    const bad = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      .map(v => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const problems = [...bad, ...(hscroll ? ['page scrolls sideways'] : []), ...cspSeen.map(c => 'CSP: ' + c.slice(0, 160))];
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${width}px /${path}`);
    problems.forEach(p => console.log('     - ' + p));
    failed += problems.length;
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
