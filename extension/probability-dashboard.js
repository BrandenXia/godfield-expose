(() => {
  'use strict';
  function create({language, onOpen=()=>{}}) {
    const model=GodfieldProbability, tracker=model.tracker();
    let state={status:'waiting-sdk'}, refresh=()=>{}, manual={rate:50,strength:20,success:0,failure:0};
    let options={pool:'opening',strength:500,n:9,item:112};
    try {
      const saved=JSON.parse(localStorage.getItem('godfield-probability-settings-v1')||'null');
      if(saved && ['opening','later'].includes(saved.pool) && Number.isFinite(saved.strength)&&saved.strength>=10&&saved.strength<=10000 &&
          Number.isInteger(saved.n)&&saved.n>=1&&saved.n<=100 && Number.isInteger(saved.item)&&model.weights[saved.item-1]>0) options={pool:saved.pool,strength:saved.strength,n:saved.n,item:saved.item};
    } catch {}
    function save(){try{localStorage.setItem('godfield-probability-settings-v1',JSON.stringify(options));}catch{}}
    const doc=document, host=doc.createElement('div');
    host.id='godfield-probability-dashboard';
    const shadow=host.attachShadow({mode:'open'});
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    const icon=(name)=>{
      const paths={chart:'M4 19V5 M4 19H20 M8 15V11 M13 15V7 M18 15V3',dice:'M5 3H19Q21 3 21 5V19Q21 21 19 21H5Q3 21 3 19V5Q3 3 5 3 M7 7h.01 M12 12h.01 M17 17h.01',settings:'M4 7H10 M14 7H20 M4 17H14 M18 17H20 M10 4V10 M14 14V20',close:'M6 6L18 18 M18 6L6 18'};
      const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
      for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
      const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;
    };
    let visible=false, activeTab='gifts', returnFocus=null;
    const shell=el('div','shell'), rail=el('div','rail'), drawer=el('aside','drawer');
    drawer.id='probability-drawer';drawer.setAttribute('aria-label','Probability dashboard');drawer.hidden=true;
    const launcher=el('button','launcher');launcher.append(icon('chart'));launcher.title='Probability dashboard';
    launcher.setAttribute('aria-label','Open probability dashboard');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls',drawer.id);
    const tabs=el('div','tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Dashboard sections');tabs.setAttribute('aria-orientation','vertical');tabs.hidden=true;
    const sections={}, tabButtons={};
    for(const [id,label,glyph] of [['gifts','Gift odds','chart'],['events','Event chance','dice'],['settings','Settings','settings']]){
      const button=el('button','nav-button');button.append(icon(glyph),el('span','',label));button.title=label;
      button.id=`odds-tab-${id}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`odds-${id}`);
      const section=el('section','tab-page');section.id=`odds-${id}`;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',button.id);
      sections[id]=section;tabButtons[id]=button;tabs.append(button);button.onclick=()=>chooseTab(id);
      button.onkeydown=event=>{
        const ids=Object.keys(tabButtons),index=ids.indexOf(id);
        const next=event.key==='ArrowDown'?(index+1)%ids.length:event.key==='ArrowUp'?(index+ids.length-1)%ids.length:event.key==='Home'?0:event.key==='End'?ids.length-1:null;
        if(next!==null){event.preventDefault();chooseTab(ids[next]);tabButtons[ids[next]].focus();}
      };
    }
    function chooseTab(id){activeTab=id;for(const key of Object.keys(sections)){sections[key].hidden=key!==id;tabButtons[key].setAttribute('aria-selected',String(key===id));tabButtons[key].tabIndex=key===id?0:-1;}}
    function open(){
      if(!visible){returnFocus=doc.activeElement?.shadowRoot?.activeElement||doc.activeElement;visible=true;launcher.setAttribute('aria-expanded','true');host.classList.add('is-open');drawer.hidden=false;launcher.hidden=true;tabs.hidden=false;onOpen();}
      chooseTab(activeTab);refresh();tabButtons[activeTab].focus();return true;
    }
    function close(){visible=false;launcher.setAttribute('aria-expanded','false');host.classList.remove('is-open');drawer.hidden=true;launcher.hidden=false;tabs.hidden=true;(returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:launcher).focus();}
    launcher.onclick=open;
    shadow.addEventListener('keydown',event=>{if(event.key==='Escape'&&visible){event.preventDefault();event.stopPropagation();close();}});
    rail.append(launcher,tabs);shell.append(rail,drawer);
    const style=el('style','');
    style.textContent=`
      :host{all:initial;position:fixed;right:12px;top:50%;transform:translateY(-50%);z-index:2147483647;font:13px/1.45 system-ui,sans-serif;color:#183e33;color-scheme:light}
      :host(.is-open){top:12px;bottom:12px;transform:none;width:min(480px,calc(100vw - 24px))}
      *{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit}button,select{cursor:pointer}svg{width:21px;height:21px;flex-shrink:0}
      .shell{display:flex;height:100%;align-items:flex-start;filter:drop-shadow(0 5px 14px #003b3b30)}.rail{flex:0 0 52px;background:#075741;border-radius:12px 0 0 12px;padding:5px;margin-top:54px}
      :host(:not(.is-open)) .rail{border-radius:12px;margin:0}.tabs{display:grid;gap:5px}.rail button{width:42px;min-height:44px;padding:8px 2px;border:0;border-radius:7px;background:transparent;color:#d8f4e5;display:flex;flex-direction:column;align-items:center;gap:4px}
      .rail button:hover{background:#24745b}.rail button[aria-selected=true]{background:#e0f7d7;color:#075741}.nav-button span{font-size:9px;line-height:1.2;font-weight:650}.launcher svg{width:25px;height:25px}
      .drawer{flex:1;min-width:0;max-height:100%;height:100%;display:flex;flex-direction:column;background:#eff5ee;border:1px solid #9abda9;border-radius:14px;overflow:hidden}
      header{background:#075741;color:#edfff3;padding:16px;display:flex;gap:10px;align-items:flex-start}h1{font-size:20px;letter-spacing:-.5px;margin:3px 0}header p{margin:0;color:#bfdfcf;font-size:11px}.eyebrow{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#b3e7cb}
      .close{margin-left:auto;flex-shrink:0;display:grid;place-items:center;padding:5px!important;background:transparent!important;color:#d8f4e5!important;border-color:#58957c!important}
      main{overflow:auto;overscroll-behavior:contain;padding:14px;min-height:0;scrollbar-width:thin}.controls{display:flex;flex-wrap:wrap;gap:12px;padding:16px;background:white;border:1px solid #cbded0;border-radius:10px}
      label{font-size:11px;font-weight:700;display:flex;flex-direction:column;gap:5px;color:#426657}input,select{background:#fff;color:#183e33;border:1px solid #b0cbbc;border-radius:6px;padding:8px;max-width:100%;min-width:0}input[type=number]{width:125px}input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #e3b957;outline-offset:-2px}
      button{border:1px solid #9abda9;background:#fff;color:#075741;border-radius:7px;padding:8px 12px;font-size:12px;font-weight:700}.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .notice{color:#527566;font-size:11px;margin:10px 0}.error{color:#a52a2a;font-weight:600;white-space:pre-wrap}.error:empty{display:none}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.metric,.card{background:white;border:1px solid #cbded0;border-radius:10px;padding:14px}.metric{padding:10px}.metric strong{display:block;font-size:23px;color:#075741}.metric span{font-size:10px;color:#527566}
      .columns,.stack{display:grid;gap:12px}h2{margin:0 0 4px;font-size:16px;letter-spacing:-.3px}h3{font-size:13px;margin:12px 0 6px}.sub{color:#527566;font-size:11px;margin:0 0 12px}.big{font-size:30px;letter-spacing:-1px;color:#075741;font-weight:800;line-height:1.2}.watch-title{font-size:12px;margin:10px 0 5px}.range{font-size:11px;color:#527566;margin:6px 0}
      .forecast{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.forecast h3,.forecast .watch-title{font-size:12px;font-weight:600;margin:12px 0 6px;min-height:35px}
      .table-wrap{overflow:auto;max-height:380px}table{border-collapse:collapse;width:100%;font-size:11px}th{text-align:left;color:#527566;font-size:9px;text-transform:uppercase;position:sticky;top:0;background:white;z-index:1}td,th{padding:9px 3px;border-bottom:1px solid #e1ece3}td.num,th.num{text-align:right;white-space:nowrap}.item-name{font-weight:650;color:#244d3d}.item-cell{display:flex;align-items:center;gap:7px}.id{font-size:9px;color:#73897e}
      .item-art{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;background:#e1f7d7;border-radius:6px;color:#6f9b7f;font-size:20px}.item-art img{width:100%;height:100%;object-fit:contain}.watch-item{display:flex;align-items:center;gap:10px}.watch-item .item-art{flex-basis:44px;width:44px;height:44px}.watch-select{width:100%;flex:1}
      .bar{height:3px;background:#e2eee5;margin-top:5px;border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:#239772}.category-row{display:grid;grid-template-columns:1fr auto;gap:4px;margin:10px 0}.category-row .bar{grid-column:1/-1}
      .search{width:100%;margin-bottom:8px}.event-inputs{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.event-inputs input{width:105px}details{margin-top:18px;border-top:1px solid #d5e5da;padding-top:12px;font-size:12px;color:#426657}summary{cursor:pointer;font-weight:700}.connection{font-size:10px;color:#d1eedb;margin-top:6px}.foot{margin:16px 0;font-size:11px;color:#527566}
      @media(max-width:500px){:host(.is-open){top:6px;bottom:6px;right:6px;width:calc(100vw - 12px)}.rail{flex-basis:44px;padding:3px}.rail button{width:38px}.card{padding:11px}main{padding:10px}header{padding:12px}h1{font-size:18px}.item-art{flex-basis:26px;width:26px;height:26px}.item-cell{gap:4px}}
    `;
    shadow.append(style,shell);doc.documentElement.append(host);
    const header=el('header',''), heading=el('div','');
    heading.append(el('div','eyebrow','God Field · Bayesian estimates'),el('h1','','Probability dashboard'),el('p','','Next-item odds, updated by what this tab actually observes.'));
    const connection=el('div','connection');connection.setAttribute('role','status');heading.append(connection);
    const closeButton=el('button','close');closeButton.append(icon('close'));closeButton.title='Close dashboard (Esc)';closeButton.setAttribute('aria-label','Close probability dashboard');closeButton.onclick=close;
    header.append(heading,closeButton);drawer.append(header);
    const main=el('main',''), controls=el('section','controls');drawer.append(main);main.append(...Object.values(sections));
    const control=(parent,title,input)=>{const label=el('label','',title);label.append(input);parent.append(label);return input;};
    const select=el('select','');
    for(const [value,text] of [['opening','Opening gifts'],['later','Later gifts · mixed contexts']]){const o=el('option','',text);o.value=value;select.append(o);}select.value=options.pool;
    control(controls,'Observed gift pool',select);
    const strength=el('input','');Object.assign(strength,{type:'number',min:'10',max:'10000',step:'10',value:String(options.strength)});control(controls,'Prior strength · equivalent gifts',strength);
    const horizon=el('input','');Object.assign(horizon,{type:'number',min:'1',max:'100',step:'1',value:String(options.n)});control(controls,'Look ahead · gifts',horizon);
    const actions=el('div','actions'), reset=el('button','','Clear observations'), exportButton=el('button','','Export estimates');actions.append(reset,exportButton);controls.append(actions);sections.settings.append(el('h2','','Model settings'),el('p','sub','Choose the sample and how strongly published weights influence your forecast.'),controls);
    const error=el('p','error');error.setAttribute('role','alert');sections.settings.append(error);
    const metrics=el('section','metrics'), count=el('strong',''), games=el('strong',''), gaps=el('strong','');
    for(const [node,label] of [[count,'Gifts counted'],[games,'Game openings'],[gaps,'Update gaps']]){const box=el('div','metric');box.append(node,el('span','',label));metrics.append(box);}sections.gifts.append(metrics);
    const evidence=el('p','notice'),poolSummary=el('p','notice');sections.settings.append(evidence);sections.gifts.append(poolSummary);
    const columns=el('div','columns'), stack=el('div','stack'), leftStack=el('div','stack'), rankCard=el('section','card');
    rankCard.append(el('h2','','Likely next items'),el('p','sub','Forecast for the selected gift pool. Equal probabilities are ties; model IDs only break display order.'));
    const search=el('input','search');search.type='search';search.placeholder='Search any translated name or item ID';search.setAttribute('aria-label','Search items');rankCard.append(search);
    const tableWrap=el('div','table-wrap'), table=el('table',''), tableHead=el('thead',''), tr=el('tr','');
    for(const [text,cls] of [['Item',''],['Prior','num'],['Observed','num'],['Next gift','num']])tr.append(el('th',cls,text));
    tableHead.append(tr);const rows=el('tbody','');table.append(tableHead,rows);tableWrap.append(table);rankCard.append(tableWrap);
    leftStack.append(rankCard);columns.append(leftStack,stack);sections.gifts.append(columns);
    const watchCard=el('section','card');watchCard.append(el('h2','','Track an item'),el('p','sub','Rate and next-N forecast within the selected gift pool.'));
    const watch=el('select','watch-select');watch.setAttribute('aria-label','Tracked item');const watchItem=el('div','watch-item'),watchArt=el('span','');watchItem.append(watchArt,watch);watchCard.append(watchItem);
    const nextLabel=el('p','watch-title','Next gift'), nextValue=el('div','big'), credible=el('p','range'), horizonLabel=el('h3',''), horizonValue=el('div','big'), expected=el('p','range');
    const forecast=el('div','forecast'),nextForecast=el('div',''),horizonForecast=el('div','');
    nextForecast.append(nextLabel,nextValue,credible);horizonForecast.append(horizonLabel,horizonValue,expected);forecast.append(nextForecast,horizonForecast);watchCard.append(forecast);columns.prepend(watchCard);
    const categoryCard=el('section','card'), categories=el('div','');categoryCard.append(el('h2','','Next-gift categories'),el('p','sub','Summed item probabilities from the same posterior.'),categories);stack.append(categoryCard);
    const eventCard=el('section','card');eventCard.append(el('h2','','Event chance · manual'),el('p','sub','For comparable hit, activation, or other yes/no trials. Enter your own counts; these are not collected from the game.'));
    const eventInputs=el('div','event-inputs');const eventFields={};
    for(const [key,label,min,max] of [['rate','Prior chance %',.1,99.9],['strength','Prior trials',1,10000],['success','Successes',0,100000],['failure','Failures',0,100000]]){
      const input=el('input','');Object.assign(input,{type:'number',min:String(min),max:String(max),step:key==='rate'?'.1':'1',value:String(manual[key])});control(eventInputs,label,input);eventFields[key]=input;
    }
    const eventError=el('p','error');eventError.setAttribute('role','alert');
    const eventValue=el('div','big'),eventRange=el('p','range');eventCard.append(eventInputs,eventError,eventValue,eventRange);sections.events.append(eventCard);
    const details=el('details','');details.append(el('summary','','How the estimates work'));
    details.append(el('p','','Gift model: a Dirichlet prior proportional to the official gift weights (total 500), updated with counted gift events. Prior strength controls how quickly observations can move those rates. It is a modeling choice, not server evidence.'));
    details.append(el('p','','The 95% credible range describes uncertainty in an item’s long-run rate under this model. “At least one” integrates that uncertainty with a beta-binomial prediction; it is not simply the mean probability compounded N times.'));
    details.append(el('p','','This assumes draws within the selected pool share stable probabilities. It cannot recover a seed, detect a deterministic next card, or establish independence. Opening and later gifts stay separate; later gifts may combine state-dependent mechanisms. A sparse or selectively visible sample can bias the estimate.'));
    details.append(el('p','','Only explicit, uncached gift events in consecutive updates are counted. Repeated versions, partial batches, initial mid-game snapshots, and gaps do not create draws. Inventory changes, trades, and unknown models are not treated as gifts. Counts cover observed events, not every player’s full deal.'));
    details.append(el('p','','The manual event calculator uses a Beta prior and successes/failures you enter. Keep base hit rates and game conditions separate; guaranteed hits and conditional abilities do not belong in an ordinary hit-rate sample.'));
    sections.settings.append(details,el('p','foot','Local to this tab. Observation counts reset on reload or a new room subscription. Settings are saved; manual trials are not. Observations continue while the sidebar is closed. No extra game requests are made.'));
    const percent=value=>value>0&&value<.0001?'<0.01%':`${(value*100).toFixed(2)}%`;
    const title=id=>GodfieldLocalization.item(id,language())?.name||`#${id}`;
    let all=[], snapshot=null, locale=null;
    function artwork(id){
      const box=el('span','item-art'),img=el('img','');
      img.alt='';img.loading='lazy';img.src=GodfieldLocalization.item(id,language()).image;
      img.onerror=()=>{box.textContent='?';};box.append(img);return box;
    }
    function renderTable(){
      const term=search.value.trim().normalize('NFKC').toLowerCase();rows.replaceChildren();
      const filtered=all.filter(row=>!term||String(row.id)===term.replace(/^#/,'')||Object.values(GODFIELD_CATALOG.languages).some(l=>l.names[row.id-1].normalize('NFKC').toLowerCase().includes(term)));
      for(const row of filtered){const tr=el('tr',''), name=el('td','item-name'), cell=el('div','item-cell'),label=el('span','',title(row.id));label.append(el('div','id',`#${row.id}`));cell.append(artwork(row.id),label);name.append(cell);tr.append(name,el('td','num',percent(row.prior)),el('td','num',String(row.count)),el('td','num',percent(row.probability)));rows.append(tr);}
      if(!filtered.length){const tr=el('tr',''),td=el('td','','No matching items');td.colSpan=4;tr.append(td);rows.append(tr);}
    }
    function renderWatch(){
      const row=all.find(r=>r.id===options.item);if(!row)return;
      watchArt.replaceChildren(artwork(row.id));
      const summary=model.betaSummary(row.alpha,row.total-row.alpha,options.n);
      nextValue.textContent=percent(summary.mean);credible.textContent=`95% credible range of rate: ${percent(summary.low)}–${percent(summary.high)}`;
      horizonLabel.textContent=`At least one in the next ${options.n} gifts`;
      horizonValue.textContent=percent(summary.atLeastOne);expected.textContent=`Expected count: ${summary.expected.toFixed(2)} · ${row.count} observed`;
    }
    function renderManual(){
      const values={};
      for(const [key,input] of Object.entries(eventFields)){
        const value=Number(input.value);
        if(input.value===''||!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max)||key!=='rate'&&!Number.isInteger(value)){
          eventError.textContent='Enter valid trial counts and a prior chance between 0.1% and 99.9%.';eventValue.textContent='—';eventRange.textContent='';return;
        }values[key]=value;
      }
      manual=values;eventError.textContent='';
      const prior=manual.rate/100, result=model.betaSummary(prior*manual.strength+manual.success,(1-prior)*manual.strength+manual.failure);
      eventValue.textContent=percent(result.mean);eventRange.textContent=`Next-trial estimate · 95% credible range of rate ${percent(result.low)}–${percent(result.high)} · ${manual.success+manual.failure} manual trials`;
    }
    refresh=()=>{
      if(!visible)return;
      snapshot=tracker.snapshot();const counts=snapshot[options.pool];all=model.posterior(counts,options.strength);
      const n=counts.reduce((a,b)=>a+b,0), q=snapshot.quality;
      count.textContent=String(n);games.textContent=String(q.games);gaps.textContent=String(q.gaps);
      connection.textContent=state.fromCache?'Cached snapshot · estimates unchanged':state.pendingWrites?'Pending local write · estimates unchanged':['playing','finished'].includes(state.status)?`${state.status==='finished'?'Game finished':'Receiving room updates'} · version ${snapshot.version??'—'}`:'Waiting / disconnected · estimates frozen';
      poolSummary.textContent=`${options.pool==='opening'?'Opening gifts':'Later gifts · mixed contexts'} · prior strength ${options.strength}${n?'':' · Prior only — no gifts counted in this pool yet.'}`;
      evidence.textContent=`${q.baselines} mid-game baselines skipped · ${q.invalid} invalid batches/items · ${q.conflicts} conflicting repeated versions. ${options.pool==='later'?'Later gift contexts may have different selection rules.':''}`;
      if(locale!==language()){
        locale=language();drawer.lang=locale;watch.replaceChildren();
        for(const row of [...all].sort((a,b)=>a.id-b.id)){const option=el('option','',`${title(row.id)} · #${row.id}`);option.value=String(row.id);watch.append(option);}watch.value=String(options.item);
      }
      renderTable();renderWatch();categories.replaceChildren();
      for(const category of ['weapons','armor','sundries','trade','miracles']){
        const probability=all.filter(r=>GODFIELD_CATALOG.models[r.id-1].category===category).reduce((s,r)=>s+r.probability,0);
        const row=el('div','category-row');row.append(el('span','',GODFIELD_CATALOG.languages[language()].categories[category]),el('strong','',percent(probability)));
        const bar=el('div','bar'),fill=el('i','');fill.style.width=`${probability*100}%`;bar.append(fill);row.append(bar);categories.append(row);
      }
    };
    function changeOptions(){
      const s=Number(strength.value),n=Number(horizon.value);
      if(strength.value===''||s<10||s>10000||!Number.isFinite(s)||!Number.isInteger(n)||n<1||n>100){error.textContent='Use prior strength 10–10,000 and a look-ahead of 1–100 gifts.';return;}
      options={...options,pool:select.value,strength:s,n};error.textContent='';save();refresh();
    }
    select.onchange=strength.onchange=horizon.onchange=changeOptions;
    watch.onchange=()=>{options.item=Number(watch.value);save();renderWatch();};search.oninput=renderTable;
    for(const input of Object.values(eventFields))input.oninput=renderManual;
    reset.onclick=()=>{tracker.clear();error.textContent='';refresh();};
    exportButton.onclick=()=>{
      const report={format:'godfield-bayesian-estimates-v1',createdAt:new Date().toISOString(),settings:options,observations:tracker.snapshot(),manual,
        probabilities:all.map(({id,prior,count,probability})=>({id,prior,count,probability})),assumption:'Exchangeable draws with stable probabilities within each selected observed gift pool; not seed prediction.'};
      const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const link=el('a','');link.href=url;link.download='godfield-probabilities.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    renderManual();chooseTab(activeTab);
    return {open, observe(next){state=next;tracker.observe(next);},refresh(){refresh();}};
  }
  globalThis.GodfieldProbabilityDashboard=Object.freeze({create});
})();
