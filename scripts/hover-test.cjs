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
        if (['crossbow.webp','exchange.webp'].includes(name)) return route.fulfill({
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
    await popup.getByText('Dream · real item',{exact:true}).waitFor();
    await popup.getByText('Crossbow',{exact:true}).waitFor();
    await popup.getByText('Exchange',{exact:true}).waitFor();
    await popup.getByText('Real item',{exact:true}).waitFor();
    await popup.getByText('Dream appearance',{exact:true}).waitFor();
    await fs.mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/hover-dream${screenshotSuffix}.png`});
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      native[7].a.style.left='210px';native[8].a.style.left='100px';
      document.querySelector('#main').append(native[7].a);
    });
    await page.locator('#item-8').hover();
    await popup.getByText('Punch',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Crossbow',{exact:true}).count(),0);
    await page.locator('#item-8').click();
    assert.equal(await page.evaluate(()=>clicks),1);
    await page.keyboard.press('Escape');
    // The live view loses its disguise: use the current fields, not a cached mapping.
    await page.evaluate(()=>{native[8].f=null;room.game.players[1].items[0].fakeModelId=0;deliver({data:()=>room});});
    await page.mouse.move(10,10);
    await page.locator('#item-8').hover();
    await popup.getByText('Item details',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Dream appearance',{exact:true}).count(),0);
    await page.evaluate(()=>native[8].a.remove());
    await popup.waitFor({state:'hidden'});
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
    // Full panel still has a keyboard shortcut and translated card previews.
    await page.keyboard.press('Alt+i');
    await inspector.getByRole('button',{name:'Collapse inspector'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log(`PASS (${userscript ? 'userscript bundle fixture' : 'real MV3 injection'}): native player/card association, duplicate names, identical dream appearances, sorted cards, keyboard access, pinning, live updates, stale-data rejection, click passthrough, DOM removal, room cleanup and viewport clamping.`);
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
