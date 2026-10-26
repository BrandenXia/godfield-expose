(() => {
  'use strict';
  function create({language}) {
    const model=GodfieldProbability, tracker=model.tracker();
    let state={status:'waiting-sdk'}, popup=null, refresh=()=>{}, manual={rate:50,strength:20,success:0,failure:0};
    let options={pool:'opening',strength:500,n:9,item:112};
    try {
      const saved=JSON.parse(localStorage.getItem('godfield-probability-settings-v1')||'null');
      if(saved && ['opening','later'].includes(saved.pool) && Number.isFinite(saved.strength)&&saved.strength>=10&&saved.strength<=10000 &&
          Number.isInteger(saved.n)&&saved.n>=1&&saved.n<=100 && Number.isInteger(saved.item)&&model.weights[saved.item-1]>0) options={pool:saved.pool,strength:saved.strength,n:saved.n,item:saved.item};
    } catch {}
    function save(){try{localStorage.setItem('godfield-probability-settings-v1',JSON.stringify(options));}catch{}}
    function open() {
      if(popup&&!popup.closed){popup.focus();refresh();return true;}
      popup=window.open('about:blank','_blank','popup,width=1120,height=850');
      if(!popup)return false;
      const win=popup, doc=win.document;
      doc.title='God Field · Probability dashboard';doc.documentElement.lang=language();
      const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
      const style=el('style','');
      style.textContent=`
        *{box-sizing:border-box}body{margin:0;background:#eff5ee;color:#183e33;font:14px/1.5 system-ui,sans-serif}button,input,select{font:inherit}button,select{cursor:pointer}
        header{background:#075741;color:#edfff3;padding:28px 32px;display:flex;justify-content:space-between;gap:16px;align-items:center}h1{font-size:29px;letter-spacing:-1px;margin:3px 0}header p{margin:0;color:#bfdfcf}.eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b3e7cb}
        main{max-width:1280px;margin:auto;padding:24px 32px}.controls{display:flex;flex-wrap:wrap;gap:14px;padding:16px 20px;background:white;border:1px solid #cbded0;border-radius:12px;margin-bottom:16px}
        label{font-size:11px;font-weight:700;display:flex;flex-direction:column;gap:5px;color:#426657}input,select{background:#fff;color:#183e33;border:1px solid #b0cbbc;border-radius:6px;padding:8px;max-width:100%;min-width:0}input[type=number]{width:125px}input:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #e3b957;outline-offset:2px}
        button{border:1px solid #9abda9;background:#fff;color:#075741;border-radius:7px;padding:8px 12px;font-size:12px;font-weight:700}.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
        .notice{color:#527566;font-size:12px;margin:12px 0}.error{color:#a52a2a;font-weight:600;white-space:pre-wrap}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0}.metric,.card{background:white;border:1px solid #cbded0;border-radius:12px;padding:20px}.metric strong{display:block;font-size:29px;color:#075741}.metric span{font-size:12px;color:#527566}
        .columns{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(290px,1fr);gap:18px;align-items:start}.stack{display:grid;gap:18px}h2{margin:0 0 4px;font-size:18px;letter-spacing:-.3px}h3{font-size:14px;margin:16px 0 6px}.sub{color:#527566;font-size:12px;margin:0 0 16px}.big{font-size:38px;letter-spacing:-1px;color:#075741;font-weight:800;line-height:1.2}.watch-title{font-size:13px;margin:12px 0 5px}.range{font-size:12px;color:#527566;margin-top:7px}
        .table-wrap{overflow:auto;max-height:500px}table{border-collapse:collapse;width:100%;font-size:12px}th{text-align:left;color:#527566;font-size:10px;text-transform:uppercase;letter-spacing:.5px;position:sticky;top:0;background:white}td,th{padding:10px 5px;border-bottom:1px solid #e1ece3}td.num,th.num{text-align:right;white-space:nowrap}.item-name{font-weight:650;color:#244d3d}.id{font-size:10px;color:#73897e}.bar{height:3px;background:#e2eee5;margin-top:5px;border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:#239772}.category-row{display:grid;grid-template-columns:1fr auto;gap:4px;margin:12px 0}.category-row .bar{grid-column:1/-1}
        .search{width:100%;margin-bottom:10px}.watch-select{width:100%}.event-inputs{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.event-inputs input{width:105px}details{margin-top:18px;border-top:1px solid #d5e5da;padding-top:12px;font-size:12px;color:#426657}summary{cursor:pointer;font-weight:700}.connection{font-size:12px;color:#d1eedb;max-width:280px}.foot{margin:20px 0;font-size:12px;color:#527566}
        @media(max-width:760px){header{padding:20px;display:block}.connection{margin-top:12px}main{padding:16px}.columns{grid-template-columns:1fr}.metrics{gap:8px}.metric{padding:12px}.metric strong{font-size:24px}.controls{padding:14px;gap:10px}h1{font-size:25px}.card{padding:16px}}
      `;
      doc.head.append(style);doc.body.replaceChildren();
      const header=el('header',''), heading=el('div','');
      heading.append(el('div','eyebrow','God Field · Bayesian estimates'),el('h1','','Probability dashboard'),el('p','','Next-item odds, updated by what this tab actually observes.'));
      const connection=el('div','connection');connection.setAttribute('role','status');header.append(heading,connection);doc.body.append(header);
      const main=el('main',''), controls=el('section','controls');doc.body.append(main);
      const control=(parent,title,input)=>{const label=el('label','',title);label.append(input);parent.append(label);return input;};
      const select=el('select','');
      for(const [value,text] of [['opening','Opening gifts'],['later','Later gifts · mixed contexts']]){const o=el('option','',text);o.value=value;select.append(o);}select.value=options.pool;
      control(controls,'Observed gift pool',select);
      const strength=el('input','');Object.assign(strength,{type:'number',min:'10',max:'10000',step:'10',value:String(options.strength)});control(controls,'Prior strength · equivalent gifts',strength);
      const horizon=el('input','');Object.assign(horizon,{type:'number',min:'1',max:'100',step:'1',value:String(options.n)});control(controls,'Look ahead · gifts',horizon);
      const actions=el('div','actions'), reset=el('button','','Clear observations'), exportButton=el('button','','Export estimates');actions.append(reset,exportButton);controls.append(actions);main.append(controls);
      const error=el('p','error');error.setAttribute('role','alert');main.append(error);
      const metrics=el('section','metrics'), count=el('strong',''), games=el('strong',''), gaps=el('strong','');
      for(const [node,label] of [[count,'Gift events counted in this pool'],[games,'Observed game openings'],[gaps,'Missing or out-of-order updates']]){const box=el('div','metric');box.append(node,el('span','',label));metrics.append(box);}main.append(metrics);
      const evidence=el('p','notice');main.append(evidence);
      const columns=el('div','columns'), stack=el('div','stack'), leftStack=el('div','stack'), rankCard=el('section','card');
      rankCard.append(el('h2','','Likely next items'),el('p','sub','Forecast for the selected gift pool. Equal probabilities are ties; model IDs only break display order.'));
      const search=el('input','search');search.type='search';search.placeholder='Search any translated name or item ID';search.setAttribute('aria-label','Search items');rankCard.append(search);
      const tableWrap=el('div','table-wrap'), table=el('table',''), tableHead=el('thead',''), tr=el('tr','');
      for(const [text,cls] of [['Item',''],['Prior','num'],['Observed','num'],['Next gift','num']])tr.append(el('th',cls,text));
      tableHead.append(tr);const rows=el('tbody','');table.append(tableHead,rows);tableWrap.append(table);rankCard.append(tableWrap);
      leftStack.append(rankCard);columns.append(leftStack,stack);main.append(columns);
      const watchCard=el('section','card');watchCard.append(el('h2','','Track an item'),el('p','sub','Rate and next-N forecast within the selected gift pool.'));
      const watch=el('select','watch-select');watch.setAttribute('aria-label','Tracked item');watchCard.append(watch);
      const nextLabel=el('p','watch-title','Next gift'), nextValue=el('div','big'), credible=el('p','range'), horizonLabel=el('h3',''), horizonValue=el('div','big'), expected=el('p','range');
      watchCard.append(nextLabel,nextValue,credible,horizonLabel,horizonValue,expected);stack.append(watchCard);
      const categoryCard=el('section','card'), categories=el('div','');categoryCard.append(el('h2','','Next-gift categories'),el('p','sub','Summed item probabilities from the same posterior.'),categories);stack.append(categoryCard);
      const eventCard=el('section','card');eventCard.append(el('h2','','Event chance · manual'),el('p','sub','For comparable hit, activation, or other yes/no trials. Enter your own counts; these are not collected from the game.'));
      const eventInputs=el('div','event-inputs');const eventFields={};
      for(const [key,label,min,max] of [['rate','Prior chance %',.1,99.9],['strength','Prior trials',1,10000],['success','Successes',0,100000],['failure','Failures',0,100000]]){
        const input=el('input','');Object.assign(input,{type:'number',min:String(min),max:String(max),step:key==='rate'?'.1':'1',value:String(manual[key])});control(eventInputs,label,input);eventFields[key]=input;
      }
      const eventError=el('p','error');eventError.setAttribute('role','alert');
      const eventValue=el('div','big'),eventRange=el('p','range');eventCard.append(eventInputs,eventError,eventValue,eventRange);leftStack.append(eventCard);
      const details=el('details','');details.append(el('summary','','How the estimates work'));
      details.append(el('p','','Gift model: a Dirichlet prior proportional to the official gift weights (total 500), updated with counted gift events. Prior strength controls how quickly observations can move those rates. It is a modeling choice, not server evidence.'));
      details.append(el('p','','The 95% credible range describes uncertainty in an item’s long-run rate under this model. “At least one” integrates that uncertainty with a beta-binomial prediction; it is not simply the mean probability compounded N times.'));
      details.append(el('p','','This assumes draws within the selected pool share stable probabilities. It cannot recover a seed, detect a deterministic next card, or establish independence. Opening and later gifts stay separate; later gifts may combine state-dependent mechanisms. A sparse or selectively visible sample can bias the estimate.'));
      details.append(el('p','','Only explicit, uncached gift events in consecutive updates are counted. Repeated versions, partial batches, initial mid-game snapshots, and gaps do not create draws. Inventory changes, trades, and unknown models are not treated as gifts. Counts cover observed events, not every player’s full deal.'));
      details.append(el('p','','The manual event calculator uses a Beta prior and successes/failures you enter. Keep base hit rates and game conditions separate; guaranteed hits and conditional abilities do not belong in an ordinary hit-rate sample.'));
      main.append(details,el('p','foot','Local to this tab. Observation counts reset on reload or a new room subscription. Settings are saved; manual trials are not. Keep the game tab open for live updates. No extra game requests are made.'));
      const percent=value=>value>0&&value<.0001?'<0.01%':`${(value*100).toFixed(2)}%`;
      const title=id=>GodfieldLocalization.item(id,language())?.name||`#${id}`;
      let all=[], snapshot=null, locale=null;
      function renderTable(){
        const term=search.value.trim().normalize('NFKC').toLowerCase();rows.replaceChildren();
        const filtered=all.filter(row=>!term||String(row.id)===term.replace(/^#/,'')||Object.values(GODFIELD_CATALOG.languages).some(l=>l.names[row.id-1].normalize('NFKC').toLowerCase().includes(term)));
        for(const row of filtered){const tr=el('tr',''), name=el('td','item-name',title(row.id));name.append(el('div','id',`#${row.id}`));tr.append(name,el('td','num',percent(row.prior)),el('td','num',String(row.count)),el('td','num',percent(row.probability)));rows.append(tr);}
        if(!filtered.length){const tr=el('tr',''),td=el('td','','No matching items');td.colSpan=4;tr.append(td);rows.append(tr);}
      }
      function renderWatch(){
        const row=all.find(r=>r.id===options.item);if(!row)return;
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
        if(win.closed)return;
        try{if(win.document!==doc)return;}catch{return;}
        snapshot=tracker.snapshot();const counts=snapshot[options.pool];all=model.posterior(counts,options.strength);
        const n=counts.reduce((a,b)=>a+b,0), q=snapshot.quality;
        count.textContent=String(n);games.textContent=String(q.games);gaps.textContent=String(q.gaps);
        connection.textContent=state.fromCache?'Cached snapshot · estimates unchanged':state.pendingWrites?'Pending local write · estimates unchanged':['playing','finished'].includes(state.status)?`${state.status==='finished'?'Game finished':'Receiving room updates'} · version ${snapshot.version??'—'}`:'Waiting / disconnected · estimates frozen';
        evidence.textContent=`${n ? 'Posterior uses observed gifts + published prior.' : 'Prior only — no gifts counted in this pool yet.'} ${q.baselines} mid-game baselines skipped · ${q.invalid} invalid batches/items · ${q.conflicts} conflicting repeated versions. ${options.pool==='later'?'Later gift contexts may have different selection rules.':''}`;
        if(locale!==language()){
          locale=language();doc.documentElement.lang=locale;watch.replaceChildren();
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
        const url=win.URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
        const link=el('a','');link.href=url;link.download='godfield-probabilities.json';link.click();setTimeout(()=>win.URL.revokeObjectURL(url),1000);
      };
      renderManual();refresh();return true;
    }
    window.addEventListener('beforeunload',()=>{if(popup&&!popup.closed){try{popup.document.querySelector('.connection').textContent='Game tab closed or reloaded · reopen the dashboard from the game for live estimates.';}catch{}}});
    return {open, observe(next){state=next;tracker.observe(next);},refresh(){refresh();}};
  }
  globalThis.GodfieldProbabilityDashboard=Object.freeze({create});
})();
