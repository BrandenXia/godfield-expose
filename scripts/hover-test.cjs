const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
async function runHoverTest(mode) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'godfield-hover-test-'));
  const userscript = mode === 'userscript';
  const screenshotSuffix = userscript ? '-userscript' : '';
  let context;
  try {
    const extension = path.resolve(__dirname, '../extension');
    context = await chromium.launchPersistentContext(profile, {
      channel:'chromium', headless:true,
      args:userscript ? ['--disable-extensions'] : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      viewport:{width:1280,height:900}
    });
    if (userscript) {
      await context.addInitScript({path:path.resolve(__dirname,'../userscript/godfield-room-inspector.user.js')});
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://godfield.net/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/images/')) {
        const name = path.basename(url.pathname);
        if (['crossbow.webp','exchange.webp','torch.webp','ice-armor.webp','super-mirror.webp','god-shield.webp','ice.webp','rock.webp','flame.webp'].includes(name)) return route.fulfill({
          contentType:'image/webp', body:await fs.readFile(path.join(__dirname,'../tests/assets',name))
        });
        return route.fulfill({status:404,body:''});
      }
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="background:#55bb99">
        <div id="main" style="position:relative;width:1080px;height:720px"></div>
        <script>
          window.clicks = 0;
          window.firebase = {onSnapshot(ref,next){window.deliver=next;return()=>{};}};
          firebase.onSnapshot({path:'modes/private/rooms/fixture'},()=>{});
          // Mirror the observed Dart interop callback and native view shapes.
          // Real listeners still execute normally; the extension must discover
          // their associated view rather than match text or image filenames.
          window.native = {};
          function register(node,view,type) {
            const callback = () => {if(type==='click') window.clicks++;};
            callback.___dart__$dart_dartClosure_dartJSInterop_fixture = {a:{a:{a:view}}};
            node.addEventListener(type,callback,false);
          }
          window.playerTag = (id,name,top) => {
            const node=document.createElement('div');
            node.id='player-'+id;
            Object.assign(node.style,{position:'absolute',top:top+'px',left:'40px',width:'390px',height:'40px',background:'#eeffee',borderRadius:'20px',color:'#008f6f'});
            const plate=document.createElement('div');plate.textContent=name;node.append(plate);
            const view={a:node,c:id,e:name,Q:{a:plate}};
            register(plate,view,'click');
            document.querySelector('#main').append(node);
            return node;
          };
          window.itemCard = (id,real,fake,left) => {
            const node=document.createElement('div');
            node.id='item-'+id;
            Object.assign(node.style,{position:'absolute',top:'400px',left:left+'px',width:'80px',height:'100px',background:'#eeffee'});
            const img=document.createElement('img');img.src='/images/items/trade/exchange.webp';img.width=80;img.height=80;node.append(img);
            const view={a:node,c:id,e:{a:real},f:fake?{a:fake}:null,w:null};
            register(node,view,'mouseover');
            register(node,view,'click');
            native[id]=view;
            document.querySelector('#main').append(node);
            return node;
          };
        </script></body></html>`});
    });
    await page.goto('https://godfield.net/?lang=en');
    const inspector = page.locator('#godfield-room-inspector');
    const popup = inspector.locator('.hover-preview');
    assert.equal(await inspector.getByRole('button',{name:'Expand inspector'}).count(),1);
    const room={game:{players:[
      {id:1,name:'Twin',hp:40,mp:10,cp:20,items:[{id:7,modelId:12,fakeModelId:3},{id:9,modelId:3}]},
      {id:2,name:'Twin',hp:35,mp:20,cp:10,items:[{id:8,modelId:13,fakeModelId:3}]}
    ]}};
    await page.evaluate(room=>{
      window.room=room;deliver({data:()=>room});
      playerTag(1,'Twin',80);playerTag(2,'Twin',150);
      itemCard(7,12,3,100);itemCard(8,13,3,210);
    },room);
    assert.equal(await page.locator('#main [data-gfi-target]').count(),4);
    await page.locator('#player-1').hover();
    await popup.getByText('Twin · 2 items',{exact:true}).waitFor();
    await popup.getByText('Crossbow',{exact:true}).waitFor();
    await popup.hover();
    await page.waitForTimeout(300);
    assert.ok(await popup.isVisible());
    await popup.getByRole('button',{name:'Pin preview'}).click();
    await page.mouse.move(10,10);
    await page.waitForTimeout(300);
    assert.ok(await popup.isVisible());
    await page.evaluate(()=>{room.game.players[0].hp=25;deliver({data:()=>room,metadata:{fromCache:true}});});
    await popup.getByText('HP 25 · MP 10 · CP 20',{exact:true}).waitFor();
    await popup.getByText('Cached snapshot · may be stale').waitFor();
    await page.keyboard.press('Escape');
    await popup.waitFor({state:'hidden'});
    await page.locator('#player-2').focus();
    await popup.getByText('Twin · 1 item',{exact:true}).waitFor();
    await popup.getByText('Punch',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Crossbow',{exact:true}).count(),0);
    await page.keyboard.press('Escape');
    // Two identical dream appearances resolve to different real models.
    await page.locator('#item-7').hover();
    await popup.getByText('Combat analysis',{exact:true}).waitFor();
    await popup.getByText('Combined compatible DEF 0 vs ATK 2',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Crossbow',{exact:true}).count(),0);
    assert.equal(await popup.getByText('Dream appearance',{exact:true}).count(),0);
    assert.equal(await popup.locator('.card, .item-art, .item-name').count(),0);
    await fs.mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/hover-dream${screenshotSuffix}.png`});
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      native[7].a.style.left='210px';native[8].a.style.left='100px';
      document.querySelector('#main').append(native[7].a);
    });
    await page.locator('#item-8').hover();
    await popup.getByText('Combined compatible DEF 0 vs ATK 3',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Punch',{exact:true}).count(),0);
    assert.equal(await popup.getByText('Crossbow',{exact:true}).count(),0);
    await page.locator('#item-8').click();
    assert.equal(await page.evaluate(()=>clicks),1);
    await page.keyboard.press('Escape');
    // The live view loses its disguise: use the current fields, not a cached mapping.
    await page.evaluate(()=>{native[8].f=null;room.game.players[1].items[0].fakeModelId=0;deliver({data:()=>room});});
    await page.mouse.move(10,10);
    await page.locator('#item-8').hover();
    await popup.getByText('Combat analysis',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Dream appearance',{exact:true}).count(),0);
    await page.evaluate(()=>native[8].a.remove());
    await popup.waitFor({state:'hidden'});
    // Noncombat cards do not open an empty preview.
    await page.evaluate(()=>itemCard(9,3,0,320));
    await page.locator('#item-9').hover();
    await page.waitForTimeout(300);
    assert.ok(await popup.isHidden());
    // No positional/name guessing after a layout change or stale inventory.
    await page.evaluate(()=>{room.game.players[0].items=[];deliver({data:()=>room});});
    await page.locator('#item-7').hover();
    await page.waitForTimeout(250);
    assert.ok(await popup.isHidden());
    await page.locator('#player-1').hover();
    await popup.getByText('No items.',{exact:true}).waitFor();
    await page.setViewportSize({width:360,height:600});
    await page.waitForTimeout(50);
    const rect=await popup.boundingBox();
    assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=360 && rect.y+rect.height<=600);
    await page.screenshot({path:`test-results/hover-mobile${screenshotSuffix}.png`});
    await page.evaluate(()=>deliver({data:()=>({game:null})}));
    await popup.waitFor({state:'hidden'});
    // Full panel still has a keyboard shortcut and translated matchups.
    await page.keyboard.press('Alt+i');
    await inspector.getByRole('button',{name:'Collapse inspector'}).waitFor();
    // Matchups use the real dream model and the item's owner, excluding allies.
    await page.setViewportSize({width:1280,height:900});
    await page.keyboard.press('Alt+i');
    await page.evaluate(()=>{
      document.querySelector('#main').replaceChildren();
      window.room={game:{players:[
        {id:1,name:'You',team:1,hp:40,mp:20,items:[{id:31,modelId:59,fakeModelId:3},{id:32,modelId:145},{id:33,modelId:13}]},
        {id:2,name:'Enemy',team:2,hp:40,mp:4,items:[{id:40,modelId:145},{id:41,modelId:180},{id:42,modelId:211},{id:43,modelId:214},{id:44,modelId:233,used:true},{id:45,modelId:190},{id:46,modelId:0}]},
        {id:3,name:'Ally',team:1,hp:40,mp:20,items:[{id:50,modelId:57}]},
        {id:4,name:'Eliminated',team:2,dead:true,items:[{id:51,modelId:57}]}
      ]}};
      deliver({data:()=>room});
      itemCard(31,59,3,100);itemCard(32,145,0,210);itemCard(33,13,0,320);
    });
    await page.locator('#item-31').hover();
    const analysis=popup.getByRole('region',{name:'Combat matchups'});
    await analysis.getByRole('heading',{name:'Possible enemy protection'}).waitFor();
    await analysis.getByText('Ice Armor',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Torch',{exact:true}).count(),0);
    assert.equal(await popup.locator('.card, .item-art, .item-name').count(),0);
    assert.ok(await analysis.locator('.matchup-art').count() > 0);
    await analysis.getByText('Super Mirror',{exact:true}).waitFor();
    assert.equal(await analysis.getByText('God Shield',{exact:true}).count(),0); // Wrong element.
    assert.equal(await analysis.getByRole('heading',{name:'Ally',exact:true}).count(),0);
    assert.equal(await analysis.getByRole('heading',{name:'Eliminated',exact:true}).count(),0);
    await analysis.getByText('1 concealed or unmapped item; more options may exist.').waitFor();
    await page.screenshot({path:`test-results/matchups-attack${screenshotSuffix}.png`});
    await page.keyboard.press('Escape');
    await page.locator('#item-32').hover();
    await analysis.getByRole('heading',{name:'Enemy attacks to prepare for'}).waitFor();
    await analysis.getByText('<Ice>',{exact:true}).waitFor();
    await analysis.getByText('<Rock>',{exact:true}).waitFor();
    assert.equal(await analysis.getByText('Incompatible defense element',{exact:true}).count(),2);
    await popup.getByRole('button',{name:'Pin preview'}).click();
    await page.evaluate(()=>{room.game.players[1].items.push({id:47,modelId:215});deliver({data:()=>room});});
    await analysis.getByText('DEF 6; 4 ATK gets through',{exact:true}).waitFor();
    await analysis.getByText('Needs 5 MP; has 4',{exact:true}).waitFor();
    await page.evaluate(()=>{room.game.players[1].mp=8;deliver({data:()=>room});});
    await analysis.getByText('Costs 5 MP',{exact:true}).waitFor();
    assert.equal(await analysis.getByText('Needs 5 MP; has 4',{exact:true}).count(),0);
    await page.screenshot({path:`test-results/matchups-defense${screenshotSuffix}.png`});
    await page.keyboard.press('Escape');
    // A previously performed miracle is still a possible response.
    await page.locator('#item-33').hover();
    await analysis.getByText('<Wall>',{exact:true}).waitFor();
    await analysis.getByText('Blocks the attack',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    // Ambiguous native IDs need explicit ownership; never guess an enemy set.
    await page.evaluate(()=>{room.game.players[1].items.push({id:31,modelId:59,fakeModelId:3});deliver({data:()=>room});});
    await page.locator('#item-31').hover();
    await analysis.getByLabel('Item owner').selectOption('2');
    await analysis.getByText('Item owner: Enemy',{exact:true}).waitFor();
    await analysis.getByRole('heading',{name:'You',exact:true}).waitFor();
    assert.equal(await analysis.getByRole('heading',{name:'Enemy',exact:true}).count(),0);
    await page.keyboard.press('Escape');
    // Full-panel cards already carry unambiguous ownership, including translations.
    await page.keyboard.press('Alt+i');
    await inspector.getByLabel('Item language').selectOption('ja');
    const ownCard=inspector.locator('.panel .body details').first().locator('.card').filter({hasText:'#59'});
    await ownCard.focus();
    await analysis.getByText('Item owner: You',{exact:true}).waitFor();
    await analysis.getByText('アイスアーマー',{exact:true}).waitFor();
    assert.equal(await popup.locator('.card, .item-art, .item-name').count(),0);
    assert.equal(await analysis.getByLabel('Item owner').count(),0);
    await popup.getByRole('button',{name:'Pin preview'}).click();
    await page.evaluate(()=>{room.game.players[1].items.push({id:48,modelId:145});deliver({data:()=>room});});
    await analysis.getByText('Combined compatible DEF 12 vs ATK 1 · special protection available',{exact:true}).waitFor();
    assert.ok(await popup.isVisible());
    await page.setViewportSize({width:360,height:600});
    await page.waitForTimeout(50);
    const matchupRect=await popup.boundingBox();
    assert.ok(matchupRect.x>=0 && matchupRect.y>=0 && matchupRect.x+matchupRect.width<=360 && matchupRect.y+matchupRect.height<=600);
    await page.screenshot({path:`test-results/matchups-mobile${screenshotSuffix}.png`});
    assert.deepEqual(errors,[]);
    console.log(`PASS (${userscript ? 'userscript bundle fixture' : 'real MV3 injection'}): native player/card association, duplicate names, identical dream appearances, sorted cards, keyboard access, pinning, live updates, stale-data rejection, click passthrough, DOM removal, room cleanup, viewport clamping, enemy matchups, teams, MP updates, reusable miracles and ambiguous ownership.`);
  } finally {
    await context?.close();
    await fs.rm(profile,{recursive:true,force:true});
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--userscript', '--all'].includes(args[0]))) {
    throw new Error('Usage: node scripts/hover-test.cjs [--userscript|--all]');
  }
  const modes = args[0] === '--all' ? ['extension', 'userscript'] :
    [args[0] === '--userscript' ? 'userscript' : 'extension'];
  for (const mode of modes) await runHoverTest(mode);
})().catch(error=>{console.error(error);process.exitCode=1;});
