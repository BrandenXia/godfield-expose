const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
async function run(mode) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(),'godfield-visibility-test-'));
  const userscript = mode === 'userscript';
  const suffix = userscript ? '-userscript' : '';
  let context;
  try {
    const extension = path.resolve(__dirname,'../extension');
    context = await chromium.launchPersistentContext(profile, {channel:'chromium',headless:true,
      args:userscript ? ['--disable-extensions'] : [`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
      viewport:{width:1200,height:800}});
    if (userscript) await context.addInitScript({path:path.resolve(__dirname,'../userscript/godfield-room-inspector.user.js')});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://godfield.net/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/images/')) {
        const name=path.basename(url.pathname);
        if(['torch.webp','exchange.webp','crossbow.webp','ice-armor.webp'].includes(name)) return route.fulfill({contentType:'image/webp',body:await fs.readFile(path.join(__dirname,'../tests/assets',name))});
        return route.fulfill({status:404,body:''});
      }
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#55bb99;font-family:system-ui;color:#006a51">
        <h1>Native visibility fixture</h1><p>Real cards and visible opponent status without hover.</p>
        <div id="main" style="position:relative;width:1080px;height:660px">
          <img id="fog-screen" src="/images/screens/fog.webp" style="position:absolute;width:1080px;height:660px">
        </div>
        <script>
          window.cardClicks=0;window.selected=null;window.commands=0;window.nativeCards=[];window.nativePlayers=[];
          window.firebase={onSnapshot(ref,next){window.deliver=next;return()=>{};}};
          firebase.onSnapshot({path:'modes/private/rooms/visibility'},snapshot=>{window.received=snapshot;});
          const root=document.querySelector('#main');
          const model=(id,name,image,category,atk=0,def=0)=>({a:id,b:name,c:image,d:{c:category},f:atk,x:def});
          window.models={
            3:model(3,'Exchange','exchange','trade'),
            12:model(12,'Crossbow','crossbow','weapons',2),
            13:model(13,'Punch','punch','weapons',3),
            59:model(59,'Torch','torch','weapons',1),
            145:model(145,'Ice Armor','ice-armor','armor',0,6)
          };
          function register(node,view,type,fn) {
            fn.___dart__$dart_dartClosure_dartJSInterop_fixture={a:{a:view}};
            node.addEventListener(type,fn);
          }
          class Card {
            constructor(id,real,fake,left) {
              this.a=document.createElement('div');this.a.id='card-'+id;
              Object.assign(this.a.style,{position:'absolute',top:'240px',left:left+'px',width:'80px',height:'100px',background:'#eeffee'});
              this.x={a:document.createElement('button')};this.x.a.setAttribute('aria-label','Select card '+id);
              Object.assign(this.x.a.style,{position:'absolute',inset:'0',opacity:'0',cursor:'pointer'});
              this.f=this.r=null;this.w=null;
              this.hn({id,real,fake});root.append(this.a);nativeCards.push(this);
            }
            gL(){return this.f||this.e;}
            hn(data){
              this.c=data.id;this.e=models[data.real];this.f=data.fake?models[data.fake]:null;
              const img=document.createElement('img');img.width=img.height=80;
              img.src='/images/items/'+this.gL().d.c+'/'+this.gL().c+'.webp';
              if(this.f){this.r={a:document.createElement('div')};this.r.a.append(img);this.a.append(this.r.a);}
              else this.a.append(img);
              register(this.a,this,'mouseover',()=>{});
              register(this.x.a,this,'click',()=>{cardClicks++;window.lastSelectedModel=this.gL().a;});
              this.a.append(this.x.a);this.bH();
            }
            bH(){this.a.querySelector('.stat')?.remove();const s=document.createElement('span');s.className='stat';s.textContent=this.gL().f?'ATK'+this.gL().f:'DEF'+(this.gL().x||0);Object.assign(s.style,{position:'absolute',top:'80px',left:'0'});this.a.append(s);}
            dk(){throw new Error('The reveal animation must not be invoked');}
          }
          class Player {
            constructor(id,name,top) {
              this.a=document.createElement('div');this.a.id='player-'+id;
              Object.assign(this.a.style,{position:'absolute',top:top+'px',left:'450px',width:'390px',height:'40px'});
              this.c=id;this.e=name;this.CW=null;this.ay=['fog'];
              this.y={a:document.createElement('div')};this.z={a:document.createElement('div')};this.Q={a:document.createElement('div')};
              Object.assign(this.Q.a.style,{width:'390px',height:'40px',background:'#eeffee',borderRadius:'20px',fontSize:'17px'});
              this.Q.a.textContent=name+' · HP40 MP10 $20';
              this.dy={a:document.createElement('button')};this.dy.a.setAttribute('aria-label','Target '+name);
              Object.assign(this.dy.a.style,{position:'absolute',inset:'0',opacity:'0',cursor:'pointer'});
              this.iT();root.append(this.a);nativePlayers.push(this);
            }
            iT(){this.z.a.append(this.Q.a);this.y.a.append(this.z.a);this.a.append(this.y.a);register(this.dy.a,this,'click',()=>{selected=this.c;});}
            fs(hp){this.Q.a.firstChild.textContent=this.e+' · HP'+hp+' MP10 $20';}
            em(hidden){
              this.CW?.a.remove();this.CW=null;
              if(hidden){this.z.a.remove();const a=document.createElement('div');a.textContent='Fog';Object.assign(a.style,{width:'390px',height:'40px',background:'#6666ff'});this.CW={a};this.y.a.append(a);}
              else this.y.a.append(this.z.a);
            }
            aI(hidden){this.em(hidden);this.animationArgument=hidden;return Promise.resolve('native animation result');}
            si2(active){if(active)(this.CW||this.Q).a.append(this.dy.a);else this.dy.a.remove();}
          }
          window.createCard=(...args)=>new Card(...args);
          window.createPlayer=(...args)=>new Player(...args);
          window.room={game:{players:[{id:1,name:'You',team:0,mp:10,curses:['dream','fog'],items:[{id:1,modelId:59,fakeModelId:3},{id:2,modelId:12,fakeModelId:3},{id:3,modelId:145}]},{id:2,name:'Enemy',team:0,hp:40,mp:10,items:[{id:10,modelId:145}]}]}};
          window.rawSnapshot={data(){return room;},metadata:{fromCache:false}};deliver(rawSnapshot);
          createCard(1,59,3,70);createCard(2,12,3,170);createCard(3,145,0,270);
          createPlayer(2,'Enemy',60);nativePlayers[0].em(true);nativePlayers[0].si2(true);
        </script></body></html>`});
    });
    await page.goto('https://godfield.net/?lang=en');
    const torch=page.locator('#card-1'),crossbow=page.locator('#card-2');
    await torch.locator('[data-gfi-real-art="59"] img').waitFor();
    await crossbow.locator('[data-gfi-real-art="12"] img').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-gfi-real-art] img')].every(img=>img.complete&&img.naturalWidth>0));
    assert.equal(await torch.locator('img[src$="exchange.webp"]').count(),0);
    assert.equal(await torch.locator('.stat').innerText(),'ATK1');
    assert.equal(await crossbow.locator('.stat').innerText(),'ATK2');
    assert.equal(await page.locator('#card-3 [data-gfi-real-art]').count(),0);
    assert.equal(await page.evaluate(()=>nativeCards[0].f===null&&nativeCards[0].r===null),true);
    assert.equal(await page.evaluate(()=>received===rawSnapshot&&received.data()===room&&room.game.players[0].items[0].fakeModelId===3),true);
    assert.deepEqual(await page.evaluate(()=>room.game.players[0].curses),['dream','fog']);
    await torch.getByRole('button',{name:'Select card 1'}).click();
    assert.equal(await page.evaluate(()=>lastSelectedModel),59);
    assert.equal(await page.evaluate(()=>cardClicks),1);
    // Fog stays in the game's curse record; only its presentation is suppressed.
    await page.getByText('Enemy · HP40 MP10 $20',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>nativePlayers[0].CW),null);
    assert.equal(await page.locator('#fog-screen').evaluate(el=>getComputedStyle(el).visibility),'hidden');
    await page.getByRole('button',{name:'Target Enemy'}).click();
    assert.equal(await page.evaluate(()=>selected),2);
    assert.equal(await page.evaluate(()=>commands),0);
    const future=await page.evaluate(async()=>await nativePlayers[0].aI(true));
    assert.equal(future,'native animation result');
    assert.equal(await page.evaluate(()=>nativePlayers[0].animationArgument),false);
    await page.evaluate(()=>nativePlayers[0].fs(27));
    await page.getByText('Enemy · HP27 MP10 $20',{exact:true}).waitFor();
    // A non-selectable player does not gain a target button when fog changes.
    await page.evaluate(()=>{nativePlayers[0].si2(false);nativePlayers[0].em(true);});
    assert.equal(await page.getByRole('button',{name:'Target Enemy'}).count(),0);
    await page.evaluate(()=>nativePlayers[0].si2(true));
    // Both the current view and later cards use real models, without double-wrapping.
    await page.evaluate(()=>createCard(4,59,3,370));
    await page.locator('#card-4 [data-gfi-real-art="59"]').waitFor();
    await page.locator('#card-4 button').click();
    assert.equal(await page.evaluate(()=>cardClicks),2);
    // Missing real art falls back to its true name, never the disguise.
    await page.evaluate(()=>createCard(5,13,3,470));
    await page.locator('#card-5 [data-gfi-real-art] img').waitFor({state:'hidden'});
    await page.locator('#card-5').getByText('Punch',{exact:true}).waitFor();
    // Unknown view layouts fail open rather than guessing or altering listeners.
    await page.evaluate(()=>{models[99]={a:99,b:'Unknown',c:'../bad',d:{c:'weapons'}};createCard(6,99,3,570);});
    assert.equal(await page.locator('#card-6 [data-gfi-real-art]').count(),0);
    // Hover remains available for matchups, but has no dream comparison.
    await torch.hover();
    const popup=page.locator('#godfield-room-inspector .hover-preview');
    await popup.getByText('Combat analysis',{exact:true}).waitFor();
    await popup.getByText('Ice Armor',{exact:true}).waitFor();
    assert.equal(await popup.getByText('Torch',{exact:true}).count(),0);
    assert.equal(await popup.getByText('Dream appearance',{exact:true}).count(),0);
    assert.equal(await popup.locator('.card').count(),0);
    await page.keyboard.press('Escape');
    await page.mouse.move(20,20);
    await fs.mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/native-visibility${suffix}.png`});
    assert.deepEqual(errors,[]);
    console.log(`PASS (${mode}): direct dream art/stats, original snapshot preservation, native item clicks, fog status visibility/updates, selectable targets, native animation return, unsupported views and real-name image fallback.`);
  } finally { await context?.close(); await fs.rm(profile,{recursive:true,force:true}); }
}
(async()=>{
  const arg=process.argv[2];
  if(process.argv.length>3||arg&&!['--all','--userscript'].includes(arg))throw Error('Usage: visibility-test.cjs [--all|--userscript]');
  for(const mode of arg==='--all'?['extension','userscript']:[arg==='--userscript'?'userscript':'extension'])await run(mode);
})().catch(error=>{console.error(error);process.exitCode=1;});
