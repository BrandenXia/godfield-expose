// Install development dependencies with npm ci, then npx playwright install chromium.
// Default: real MV3 injection. --userscript: generated bundle in the main world.
// --all runs both. The userscript mode is a fixture test, not a test of
// Tampermonkey's installation, metadata matching, or injection machinery.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
async function runBrowserTest(mode) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'godfield-inspector-test-'));
  const extension = path.resolve(__dirname, '../extension');
  const userscript = mode === 'userscript';
  const screenshotSuffix = userscript ? '-userscript' : '';
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true,
      args: userscript ? ['--disable-extensions'] :
        [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      viewport: { width: 1280, height: 900 }
    });
    if (userscript) {
      // Execute the exact distributed bundle before the page's first script,
      // in the main world required by the synchronous window.firebase hook.
      await context.addInitScript({ path: path.resolve(__dirname, '../userscript/godfield-room-inspector.user.js') });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Serve a deterministic game-shaped page at the exact allowed origin. This
    // exercises manifest injection or the userscript bundle without server writes.
    await page.route('https://godfield.net/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/images/')) {
        const file = path.basename(url.pathname);
        if (['crossbow.webp', 'exchange.webp'].includes(file)) {
          return route.fulfill({contentType: 'image/webp', body: await fs.readFile(path.join(__dirname, '../tests/assets', file))});
        }
        return route.fulfill({status:404, body:''});
      }
      if (url.pathname.startsWith('/i18n/')) return route.fulfill({contentType:'application/json', body:'{}'});
      return route.fulfill({
        contentType: 'text/html', body: `<!doctype html><html><body><h1>God Field test room</h1>
      <script>
        window.fixture = {
          hookAtFirstScript: typeof Object.getOwnPropertyDescriptor(window, 'firebase')?.set === 'function',
          readyStateAtFirstScript: document.readyState,
          subscriptions: 0, unsubscriptions: 0, gameSnapshots: 0
        };
        window.firebase = { onSnapshot(ref, next) {
          fixture.subscriptions++;
          window.deliver = next;
          return () => { fixture.unsubscriptions++; window.stopped = true; };
        } };
        // Subscribe immediately after the SDK assignment: polling would miss it.
        window.stop = firebase.onSnapshot({path: 'modes/private/rooms/fixture'}, snapshot => {
          fixture.gameSnapshots++;
          window.lastGameSnapshot = snapshot;
        });
      </script></body></html>`
      });
    });
    await page.goto('https://godfield.net/?lang=en');
    assert.deepEqual(await page.evaluate(() => ({
      hookAtFirstScript: fixture.hookAtFirstScript,
      readyStateAtFirstScript: fixture.readyStateAtFirstScript,
      subscriptions: fixture.subscriptions
    })), { hookAtFirstScript: true, readyStateAtFirstScript: 'loading', subscriptions: 1 });
    const panel = page.locator('#godfield-room-inspector .panel');
    await panel.getByRole('button', {name:'Expand inspector'}).click();
    await panel.getByText('Connected · waiting for a room snapshot…').waitFor();
    assert.equal(await panel.count(), 1);
    const room = { game: { updateCount: 1, players: [
      { id: 0, name: 'You', hp: 40, mp: 20, cp: 10, items: [{id: 1, modelId: 3}] },
      { id: 1, name: '<img src=x onerror=alert(1)>', hp: 35, mp: 15, cp: 5, items: [
        {id: 2, modelId: 12, fakeModelId: 3}, {id: 3, modelId: 0}, {id: 4, modelId: 9999, used: true}
      ] },
      { id: 2, name: 'Missing inventory', hp: 40 }
    ] } };
    await page.evaluate(room => deliver({data: () => room, metadata: {fromCache: false}}), room);
    await panel.getByText('Live room snapshot', { exact: true }).waitFor();
    await panel.getByText('Unknown / concealed item').waitFor();
    await panel.getByText('Unmapped item #9999').waitFor();
    await panel.getByText('Displayed as: Exchange').waitFor();
    assert.equal(await panel.locator('img').count(), 2);
    assert.equal(await panel.locator('img[src=x]').count(), 0);
    await panel.locator('img[src$="crossbow.webp"]').waitFor();
    await page.waitForFunction(() => [...document.querySelector('#godfield-room-inspector').shadowRoot.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0));
    const select = panel.getByRole('combobox', {name:'Item language'});
    await select.selectOption('ja');
    await panel.getByText('クロスボウ', {exact:true}).waitFor();
    await panel.getByText('Displayed as: 両替').waitFor();
    await panel.getByText('+攻2', {exact:true}).waitFor();
    // Observing a successful catalog fetch updates Auto, not a manual override.
    await page.evaluate(() => fetch('/i18n/zh-hant.json'));
    await panel.getByText('クロスボウ', {exact:true}).waitFor();
    await select.selectOption('auto');
    await panel.getByText('十字弓', {exact:true}).waitFor();
    // Language follows the game's request even after it removes the URL parameter.
    await page.evaluate(() => { history.replaceState({}, '', '/'); return fetch('/i18n/zh-hans.json'); });
    await panel.getByText('弩箭', {exact:true}).waitFor();
    for (const code of ['en','fr','ja','ko','pt','ru','zh-hans','zh-hant']) {
      await select.selectOption(code);
      assert.equal(await panel.locator('.body').getAttribute('lang'), code);
    }
    await select.selectOption('en');
    assert.equal(await page.evaluate(() => lastGameSnapshot.data().game.updateCount), 1);
    // Verify open/closed details persist when the next snapshot arrives.
    await panel.locator('summary').first().click();
    await page.waitForFunction(() => !document.querySelector('#godfield-room-inspector').shadowRoot.querySelector('details').open);
    await page.evaluate(room => deliver({data: () => room, metadata: {fromCache: true}}), room);
    await panel.getByText('Live room snapshot · cached, may be stale').waitFor();
    assert.equal(await panel.locator('details').first().getAttribute('open'), null);
    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', {name: 'Save JSON'}).click();
    const download = await downloadPromise;
    const output = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(output.players.length, 3);
    await fs.mkdir('test-results', {recursive: true});
    await page.screenshot({path: `test-results/inspector${screenshotSuffix}.png`});
    // Missing sprite: retain the name and show a fallback instead of a broken image.
    await page.evaluate(room => {
      room.game.players[0].items.push({id:10, modelId:13});
      deliver({data:()=>room});
    }, room);
    await panel.locator('summary').first().click();
    await page.waitForFunction(() => document.querySelector('#godfield-room-inspector').shadowRoot.querySelector('img[src$="punch.webp"]')?.hidden === true);
    await panel.getByText('Punch', {exact:true}).waitFor();
    await page.setViewportSize({width:360,height:780});
    assert.ok(await panel.evaluate(el => el.getBoundingClientRect().right <= window.innerWidth));
    assert.equal(await panel.locator('ul').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    await page.screenshot({path:`test-results/inspector-mobile${screenshotSuffix}.png`});
    await panel.getByRole('button', {name: 'Collapse inspector'}).click();
    await panel.getByRole('button', {name: 'Expand inspector'}).click();
    await page.evaluate(() => stop());
    await panel.getByText('Left room · inventory cleared').waitFor();
    assert.equal(await panel.locator('details').count(), 0);
    assert.equal(await page.evaluate(() => stopped), true);
    assert.deepEqual(await page.evaluate(() => ({
      subscriptions: fixture.subscriptions,
      unsubscriptions: fixture.unsubscriptions,
      gameSnapshots: fixture.gameSnapshots
    })), { subscriptions: 1, unsubscriptions: 1, gameSnapshots: 3 });
    assert.deepEqual(errors, []);
    console.log(`PASS (${userscript ? 'userscript bundle fixture; not Tampermonkey injection' : 'real MV3 injection'}): document-start SDK interception, no extra subscriptions, snapshot rendering, redaction, disguises, XSS, cache labeling, details state, JSON export, collapse, unsubscribe, eight languages, automatic game locale, original images, missing-image fallback and narrow screens.`);
  } finally {
    await context?.close();
    await fs.rm(profile, {recursive: true, force: true});
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--userscript', '--all'].includes(args[0]))) {
    throw new Error('Usage: node scripts/browser-test.cjs [--userscript|--all]');
  }
  const modes = args[0] === '--all' ? ['extension', 'userscript'] :
    [args[0] === '--userscript' ? 'userscript' : 'extension'];
  for (const mode of modes) await runBrowserTest(mode);
})().catch(error => { console.error(error); process.exitCode = 1; });
