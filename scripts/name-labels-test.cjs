const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
async function run(mode) {
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'godfield-labels-'));
  const userscript=mode==='userscript'; let context;
  try {
    const extension=path.resolve(__dirname,'../extension');
    context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
      args:userscript?['--disable-extensions']:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:900}});
    if(userscript) await context.addInitScript({path:path.resolve(__dirname,'../userscript/godfield-room-inspector.user.js')});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://godfield.net/**',route=>{
      if(new URL(route.request().url()).pathname.startsWith('/images/')) return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#55bb99;font-family:system-ui">
        <h1>Player name labels</h1><div id="main" style="position:relative;width:1080px;height:600px"></div>
        <script>
        window.clicks=0;window.native=[];
        window.firebase={onSnapshot(ref,next){window.deliver=next;return()=>{};}};
        firebase.onSnapshot({path:'modes/private/rooms/fixture'},()=>{});
        window.room={game:{players:[
          {id:1,name:'Twin',hp:40,mp:10,cp:20,items:[{id:1,modelId:112},{id:2,modelId:208}]},
          {id:2,name:'Twin',hp:8,mp:10,cp:20,items:[{id:3,modelId:145}]}
        ]}};
        window.tag=(id,name,top)=>{
          const root=document.createElement('div');root.id='player-'+id;
          Object.assign(root.style,{position:'absolute',left:'40px',top:top+'px',width:'390px',height:'40px',background:'#eeffee',borderRadius:'20px'});
          const plate=document.createElement('div');Object.assign(plate.style,{position:'absolute',width:'390px',height:'40px'});
          const text=document.createElement('span');text.className='native-name';text.textContent=name;
          Object.assign(text.style,{position:'absolute',left:'40px',width:'135px',height:'40px',lineHeight:'40px',fontSize:'25px',color:'#008f6f'});
          const stats=document.createElement('span');stats.textContent='HP 40 · MP 10 · $20';Object.assign(stats.style,{position:'absolute',left:'160px',lineHeight:'40px'});
          const target=document.createElement('button');target.setAttribute('aria-label','Target '+id);Object.assign(target.style,{position:'absolute',inset:'0',opacity:'0'});
          plate.append(text,stats,target);root.append(plate);
          const view={a:root,c:id,e:name,Q:{a:plate,c:{a:text}}};
          const click=()=>clicks++;click.___dart__$dart_dartClosure_dartJSInterop_fixture={a:{a:view}};
          target.addEventListener('click',click);document.querySelector('#main').append(root);native.push(view);
        };
        tag(1,'Twin',60);tag(2,'Twin',120);deliver({data:()=>room});
        </script></body></html>`});
    });
    await page.goto('https://godfield.net/?lang=en');
    const inspector=page.locator('#godfield-room-inspector');
    const first=page.locator('#player-1'), second=page.locator('#player-2');
    await first.getByText('Ascension Bow',{exact:true}).waitFor();
    await first.getByText('Sun Amulet',{exact:true}).waitFor();
    await first.getByText('DEF 0',{exact:true}).waitFor();
    await second.getByText('HP 8',{exact:true}).waitFor();
    assert.equal(await second.getByText('DEF 0',{exact:true}).count(),0);
    assert.equal(await first.locator('.native-name').evaluate(n=>getComputedStyle(n).color),'rgb(177, 57, 120)');
    await first.getByRole('button',{name:'Target 1'}).click();assert.equal(await page.evaluate(()=>clicks),1);
    await first.hover();await inspector.locator('.hover-preview').getByText('Twin · 2 items',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await inspector.getByRole('button',{name:'Expand inspector'}).click();
    await inspector.getByRole('button',{name:'Name labels',exact:true}).click();
    const input=inspector.getByLabel('Rule text');
    await input.fill('has("太阳守护") => #1266aa "{item}"\ndef == 0 => #aa3333 "No DEF"');
    await inspector.getByRole('button',{name:'Apply rules'}).click();
    await first.getByText('Sun Amulet',{exact:true}).waitFor();await first.getByText('No DEF',{exact:true}).waitFor();
    assert.equal(await first.getByText('Ascension Bow',{exact:true}).count(),0);
    await input.fill('has("not an item") => #abc "bad"');
    await inspector.getByRole('alert').getByText(/Line 1: Unknown item/).waitFor();
    assert.equal(await inspector.getByRole('button',{name:'Apply rules'}).isDisabled(),true);
    assert.ok(await first.getByText('Sun Amulet',{exact:true}).isVisible());
    await page.reload();await first.getByText('No DEF',{exact:true}).waitFor();
    await inspector.getByRole('button',{name:'Expand inspector'}).click();
    await inspector.getByLabel('Item language').selectOption('zh-hans');
    await first.getByText('太阳守护',{exact:true}).waitFor();
    await page.evaluate(()=>{room.game.players[0].items=[{id:1,modelId:112},{id:2,modelId:0}];deliver({data:()=>room});});
    await first.locator('[data-gfi-name-badges]').waitFor({state:'detached'});
    assert.equal(await first.locator('.native-name').evaluate(n=>getComputedStyle(n).color),'rgb(0, 143, 111)');
    await page.evaluate(()=>{room.game.players[0].items=[{id:2,modelId:208}];deliver({data:()=>room});native[0].a.remove();tag(1,'Twin',60);});
    await first.getByText('太阳守护',{exact:true}).waitFor();
    await inspector.getByRole('button',{name:'Name labels',exact:true}).click();
    await inspector.getByLabel('Enable name labels').uncheck();
    await inspector.getByRole('button',{name:'Apply rules'}).click();
    await first.locator('[data-gfi-name-badges]').waitFor({state:'detached'});
    await inspector.getByRole('button',{name:'Load presets'}).click();
    await inspector.getByRole('button',{name:'Apply rules'}).click();
    await first.getByText('太阳守护',{exact:true}).waitFor();
    await fs.mkdir('test-results',{recursive:true});
    await page.screenshot({path:'test-results/name-labels'+(userscript?'-userscript':'')+'.png'});
    await page.setViewportSize({width:360,height:600});
    const rect=await inspector.locator('.panel').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=360&&rect.y>=0);
    await page.screenshot({path:'test-results/name-labels-mobile'+(userscript?'-userscript':'')+'.png'});
    await page.setViewportSize({width:640,height:360});
    const landscape=await inspector.locator('.panel').boundingBox();
    assert.ok(landscape.y>=0&&landscape.y+landscape.height<=360);
    await page.evaluate(()=>deliver({data:()=>({game:null})}));
    await first.locator('[data-gfi-name-badges]').waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('PASS ('+mode+'): rule presets, native names, duplicate-name identity, target clicks, hover, editor validation, persistence, translations, unknown DEF, DOM replacement, disable/reset, room exit, mobile editor.');
  } finally {await context?.close();await fs.rm(profile,{recursive:true,force:true});}
}
(async()=>{
  const args=process.argv.slice(2);
  if(args.length>1||args.length===1&&!['--all','--userscript'].includes(args[0]))throw Error('Use --all or --userscript');
  for(const mode of args[0]==='--all'?['extension','userscript']:[args[0]==='--userscript'?'userscript':'extension'])await run(mode);
})().catch(e=>{console.error(e);process.exitCode=1;});
