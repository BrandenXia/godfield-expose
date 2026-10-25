// Bounded live experiment: two isolated Training deals, no combat commands.
// This is not part of npm test and never joins a human room.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');

async function main() {
  if (process.argv.slice(2).join(' ') !== '--live-training') {
    throw new Error('Explicit opt-in required: node scripts/randomness-probe.cjs --live-training');
  }
  const browser = await chromium.launch({channel:'chromium', headless:true});
  const results = [];
  try {
    for (let trial = 1; trial <= 2; trial++) {
      const context = await browser.newContext({viewport:{width:1280,height:900}});
      const page = await context.newPage();
      const requests = [];
      let clientHash;
      const sourceReads = [];
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/main.dart.js') {
          sourceReads.push(response.body().then(body=>{
            clientHash = createHash('sha256').update(body).digest('hex');
          }));
        }
      });
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.hostname !== 'asia-northeast1-godfield.cloudfunctions.net') return;
        let body;
        try { body = request.postDataJSON(); } catch { return; }
        // Never persist tokens, account identifiers, names, or room IDs.
        requests.push({endpoint:url.pathname, fields:Object.keys(body || {}).sort(),
          commandFields:Object.keys(body?.command || {}).sort(), observedAtMs:Date.now()});
      });
      try {
        await page.addInitScript(() => {
          const probe = window.rngProbe = {calls:0, sites:{}, captures:[], schema:[]};
          const schema = new Set();
          function fields(value, path = '', depth = 0) {
            if (!value || typeof value !== 'object' || depth > 12) return;
            if (Array.isArray(value)) {
              for (const item of value) fields(item, path+'[]', depth+1);
            } else {
              for (const [key, child] of Object.entries(value)) {
                const next = path ? path+'.'+key : key;
                schema.add(next);
                fields(child, next, depth+1);
              }
            }
          }
          const random = Math.random;
          Math.random = function () {
            // Hold game-code Math.random constant; preserve SDK randomness.
            const caller = new Error().stack?.split('\n')[2] || '';
            if (caller.includes('/main.dart.js:')) {
              probe.calls++;
              const site = caller.match(/main\.dart\.js:\d+:\d+/)?.[0] || 'unknown';
              probe.sites[site] = (probe.sites[site] || 0)+1;
              return 0.125;
            }
            return Reflect.apply(random, Math, []);
          };
          let sdk;
          Object.defineProperty(window, 'firebase', {configurable:true, get:()=>sdk, set(value) {
            sdk = value;
            const original = sdk.onSnapshot;
            sdk.onSnapshot = function (...args) {
              if (/^modes\/training\/rooms\/[^/]+$/.test(args[0]?.path || '')) {
                const index = args.findIndex((arg, i) => i > 0 && typeof arg === 'function');
                if (index >= 0) {
                  const next = args[index];
                  args[index] = function (snapshot) {
                    try {
                      const data = snapshot.data();
                      fields(data);
                      probe.schema = [...schema].sort();
                      if (!snapshot.metadata?.fromCache && data?.game?.players?.length &&
                          !probe.captures.some(c=>c.updateCount === data.game.updateCount)) {
                        probe.captures.push({updateCount:data.game.updateCount,
                          receivedAtMs:Date.now(),
                          serverUpdatedAtMs:typeof data.game.updatedAt?.toMillis === 'function' ? data.game.updatedAt.toMillis() : null,
                          hands:data.game.players.map(p=>(p.items || []).map(i=>i.modelId)),
                          events:(data.game.events || []).map(e=>({action:e.action,
                            modelId:e.item?.modelId ?? null})),
                          randomCalls:probe.calls});
                      }
                    } catch { probe.captureError = true; }
                    return Reflect.apply(next, this, arguments);
                  };
                }
              }
              return Reflect.apply(original, this, args);
            };
          }});
        });
        await page.goto('https://godfield.net/?lang=en');
        await page.getByText('Genesis', {exact:true}).waitFor({timeout:30000});
        await page.locator('input').fill('RNG Research');
        await page.getByText('Genesis', {exact:true}).click({force:true});
        await page.getByText('vs Computers', {exact:true}).waitFor({timeout:30000});
        await page.getByText('Training', {exact:true}).click({force:true});
        await page.getByText('Start Battle', {exact:true}).waitFor({timeout:30000});
        await page.getByText('Start Battle', {exact:true}).click({force:true});
        await page.waitForFunction(()=>rngProbe.captures.some(c=>c.hands.length===2 && c.hands.every(h=>h.length===9)), null, {timeout:30000});
        const capture = await page.evaluate(()=>({...rngProbe}));
        assert.ok(!capture.captureError);
        assert.ok(capture.calls > 0, 'The game must exercise the controlled RNG');
        assert.ok(!requests.some(r=>r.endpoint === '/submit-command'), 'No combat command expected');
        await Promise.all(sourceReads);
        assert.ok(clientHash, 'Record the exact client used by the experiment');
        results.push({trial, clientHash, ...capture, requests});
        console.log(`Captured Training deal ${trial}: ${capture.calls} controlled game RNG calls.`);
      } finally {
        // These are fresh experiment-only identities, never the user's account.
        try {
          await page.evaluate(async()=>{
            const user = window.firebase?.getAuth().currentUser;
            if (user) await firebase.deleteUser(user);
          });
        } finally { await context.close(); }
      }
    }
    const hands = results.map(r=>r.captures.find(c=>c.hands.every(h=>h.length===9)).hands);
    const report = {schemaVersion:2, experiment:'constant-client-rng-two-training-deals',
      clientRandomValue:0.125, sameHands:JSON.stringify(hands[0]) === JSON.stringify(hands[1]), results};
    await fs.mkdir('test-results', {recursive:true});
    await fs.writeFile('test-results/randomness-probe.json', JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({sameHands:report.sameHands, trials:results.length}));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
