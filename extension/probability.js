(() => {
  'use strict';
  const weights = GODFIELD_CATALOG.models.map(m => m.giftRate || 0);
  const totalWeight = weights.reduce((a,b) => a+b, 0);
  const sum = values => values.reduce((a,b) => a+b, 0);
  // Lanczos log-gamma and a continued fraction for the regularized beta CDF.
  function logGamma(z) {
    const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if (z < .5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z--; let x = .99999999999980993;
    for (let i=0; i<c.length; i++) x += c[i]/(z+i+1);
    const t=z+c.length-.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function fraction(a,b,x) {
    const tiny=1e-300;
    let c=1, d=1-(a+b)*x/(a+1); if (Math.abs(d)<tiny) d=tiny;
    d=1/d; let h=d;
    for (let m=1; m<=300; m++) {
      let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));
      d=1+aa*d; if(Math.abs(d)<tiny)d=tiny; c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;h*=d*c;
      aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
      d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;
      const delta=d*c;h*=delta;if(Math.abs(delta-1)<1e-12)break;
    }
    return h;
  }
  function betaCDF(x,a,b) {
    if(x<=0)return 0;if(x>=1)return 1;
    const factor=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    const result=x<(a+1)/(a+b+2)?factor*fraction(a,b,x)/a:1-factor*fraction(b,a,1-x)/b;
    return Math.max(0,Math.min(1,result));
  }
  function quantile(p,a,b) {
    let lo=0,hi=1;
    for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(betaCDF(mid,a,b)<p)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function betaSummary(a,b,n=1) {
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||!Number.isInteger(n)||n<1||n>100)throw Error('Invalid probability parameters');
    // Integrate over the posterior rate: E[(1-p)^n], not (1-E[p])^n.
    let logNone=0;
    for(let k=0;k<n;k++)logNone+=Math.log((b+k)/(a+b+k));
    return {mean:a/(a+b), low:quantile(.025,a,b), high:quantile(.975,a,b), atLeastOne:-Math.expm1(logNone), expected:n*a/(a+b)};
  }
  function posterior(counts, strength=500) {
    if(!Array.isArray(counts)||counts.length!==weights.length||counts.some((c,i)=>!Number.isSafeInteger(c)||c<0||c>1000000||!weights[i]&&c!==0)||!Number.isFinite(strength)||strength<10||strength>10000)throw Error('Invalid gift observations or prior strength');
    const n=sum(counts), total=strength+n;
    return weights.flatMap((w,i)=>w>0?[{id:i+1, count:counts[i], prior:w/totalWeight, alpha:strength*w/totalWeight+counts[i], total,
      probability:(strength*w/totalWeight+counts[i])/total}]:[]).sort((a,b)=>b.probability-a.probability||a.id-b.id);
  }
  function tracker() {
    const empty=()=>Array(weights.length).fill(0);
    let connection=null, version=null, stamp=null, signature=null, ended=false, between=false;
    let opening=empty(), later=empty(), quality={};
    function clearCounts(){opening=empty();later=empty();quality={batches:0,gaps:0,baselines:0,invalid:0,conflicts:0,games:0};}
    clearCounts();
    function observe(state) {
      if(!state||!['playing','finished'].includes(state.status)) {if(state?.status==='lobby')between=true;return;}
      if(state.fromCache || state.pendingWrites || !Number.isSafeInteger(state.connectionId) || state.connectionId<=0 || !Number.isSafeInteger(state.updateCount) || state.updateCount<1)return;
      if(connection!==state.connectionId){clearCounts();connection=state.connectionId;version=stamp=signature=null;ended=between=false;}
      const o=state.observation, v=state.updateCount;
      if(!o||typeof o.eventsAvailable!=='boolean'||!Array.isArray(o.gifts)||o.gifts.length>256)return;
      const s=Number.isFinite(o.stamp)?o.stamp:null;
      const sig=JSON.stringify([o.eventsAvailable,o.truncated,o.startsGame,o.gifts]);
      const openingBatch=v===1&&o.startsGame===true;
      const newerStamp=s!==null&&stamp!==null&&s>stamp;
      const newGame=openingBatch&&version!==null&&(newerStamp||(s===null||stamp===null)&&(between||ended&&v<version));
      // Never move the high-water mark backward for an old snapshot. Otherwise
      // replaying its successor would incorrectly count that successor again.
      if(version!==null&&v<version&&!newGame){quality.gaps++;return;}
      if(v===version&&!newGame){if(sig!==signature){quality.conflicts++;signature=sig;}return;}
      let accept=version===null ? openingBatch : newGame || v===version+1;
      if(version===null&&!openingBatch)quality.baselines++;
      else if(!newGame&&version!==null&&v!==version+1){quality.gaps+=v>version? v-version-1:1;accept=false;}
      // Even an identical gift list on a *new* contiguous version represents new
      // events. Never deduplicate by model IDs or inventory differences.
      version=v;stamp=s;signature=sig;ended=state.status==='finished';between=false;
      if(!o.eventsAvailable||o.truncated){quality.invalid++;return;}
      if(!accept)return;
      if(openingBatch)quality.games++;
      quality.batches++;
      const counts=openingBatch?opening:later;
      for(const id of o.gifts){if(Number.isSafeInteger(id)&&weights[id-1]>0&&sum(counts)<1000000)counts[id-1]++;else quality.invalid++;}
    }
    return {observe, clear:clearCounts, snapshot:()=>({opening:[...opening],later:[...later],quality:{...quality},connection,version})};
  }
  globalThis.GodfieldProbability = Object.freeze({weights,totalWeight,betaSummary,betaCDF,posterior,tracker});
})();
