const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
for(const file of ['catalog.js','probability.js'])vm.runInContext(fs.readFileSync(`extension/${file}`,'utf8'),context);
const api=context.GodfieldProbability;
const zero=()=>Array(api.weights.length).fill(0);
const batch=(version,gifts,extra={})=>({status:'playing',connectionId:1,updateCount:version,observation:{eventsAvailable:true,truncated:false,startsGame:version===1,stamp:1000+version,gifts},...extra});
const total=counts=>counts.reduce((a,b)=>a+b,0);
test('official weighted prior, posterior normalization and expected Bayesian shrinkage',()=>{
  assert.equal(api.totalWeight,500);assert.equal(api.posterior(zero()).length,237);
  const counts=zero();counts[2]=5;
  const posterior=api.posterior(counts);
  assert.ok(Math.abs(total(posterior.map(p=>p.probability))-1)<1e-12);
  assert.equal(posterior.find(p=>p.id===3).probability,25/505);
  assert.equal(posterior.find(p=>p.id===112).probability,1/505);
  assert.equal(api.posterior(zero()).find(p=>p.id===3).probability,.04);
  assert.throws(()=>api.posterior(zero(),0));
  counts[0]=1;assert.throws(()=>api.posterior(counts));
});
test('beta quantiles match analytic distributions and horizon integrates uncertainty',()=>{
  const uniform=api.betaSummary(1,1,9);
  assert.ok(Math.abs(uniform.low-.025)<1e-10);assert.ok(Math.abs(uniform.high-.975)<1e-10);
  assert.ok(Math.abs(uniform.atLeastOne-.9)<1e-12); // 1-E[(1-p)^9] = 9/10.
  const b=api.betaSummary(1,499);
  assert.ok(Math.abs(b.low-(1-Math.pow(.975,1/499)))<1e-10);
  assert.ok(Math.abs(b.high-(1-Math.pow(.025,1/499)))<1e-10);
  const concentrated=api.betaSummary(100,100);
  assert.ok(concentrated.high-concentrated.low<uniform.high-uniform.low);
  assert.ok(Math.abs(concentrated.low+concentrated.high-1)<1e-10);
  assert.throws(()=>api.betaSummary(0,1));assert.throws(()=>api.betaSummary(1,1,101));
});
test('Beta event updates match conjugate successes and failures and remain finite at scale',()=>{
  assert.equal(api.betaSummary(10+8,10+2).mean,.6);
  const low=api.betaSummary(.02,1000000),high=api.betaSummary(1000000,.02);
  for(const r of [low,high]){assert.ok(Number.isFinite(r.low));assert.ok(r.high>=r.low&&r.high<=1);}
});
test('collects explicit gifts once, separates opening/later, never learns from inventories',()=>{
  const t=api.tracker();const first=batch(1,[3,112,3]);
  t.observe({...first,fromCache:true});assert.equal(total(t.snapshot().opening),0);
  t.observe({...first,pendingWrites:true});assert.equal(total(t.snapshot().opening),0);
  t.observe(first);t.observe(first);assert.equal(total(t.snapshot().opening),3);
  t.observe(batch(2,[112]));t.observe(batch(3,[112]));assert.equal(t.snapshot().later[111],2);
  t.observe(batch(4,[],{players:[{items:[{modelId:208}]}]}));assert.equal(total(t.snapshot().later),2);
  t.observe(batch(5,[0,9999,240]));assert.equal(t.snapshot().quality.invalid,3);
  t.clear();t.observe(batch(5,[0,9999,240]));assert.equal(total(t.snapshot().opening),0);assert.equal(t.snapshot().quality.invalid,0);
});
test('regressing versions cannot rewind the deduplication cursor, even after the game ends',()=>{
  const t=api.tracker();t.observe(batch(1,[3]));t.observe(batch(2,[112]));
  t.observe(batch(1,[3]));t.observe(batch(2,[112]));
  assert.equal(total(t.snapshot().opening),1);assert.equal(total(t.snapshot().later),1);
  t.observe(batch(3,[],{status:'finished'}));t.observe(batch(1,[3]));t.observe(batch(2,[112]));
  assert.equal(total(t.snapshot().opening),1);assert.equal(total(t.snapshot().later),1);
  assert.equal(t.snapshot().version,3);
});
test('skips gaps, late baselines, oversized batches and conflicting versions; room changes reset counts',()=>{
  const t=api.tracker();t.observe(batch(4,[3]));assert.equal(t.snapshot().quality.baselines,1);
  t.observe(batch(5,[3]));t.observe(batch(8,[208]));assert.equal(t.snapshot().quality.gaps,2);
  t.observe(batch(9,[112]));t.observe(batch(9,[208]));
  assert.equal(total(t.snapshot().later),2);assert.equal(t.snapshot().quality.conflicts,1);
  t.observe(batch(10,[208],{observation:{...batch(10,[]).observation,truncated:true,gifts:[208]}}));
  assert.equal(total(t.snapshot().later),2);assert.equal(t.snapshot().quality.invalid,1);
  t.observe(batch(1,[112],{connectionId:2}));assert.equal(total(t.snapshot().later),0);assert.equal(total(t.snapshot().opening),1);
});
test('new game with advancing timestamp can begin at version one without double counting its replay',()=>{
  const t=api.tracker();t.observe(batch(1,[112]));
  const next=batch(1,[208],{observation:{...batch(1,[208]).observation,stamp:5000}});
  t.observe(next);t.observe(next);
  assert.equal(total(t.snapshot().opening),2);assert.equal(t.snapshot().quality.games,2);
  t.observe(batch(2,[],{status:'finished',observation:{...batch(2,[]).observation,stamp:5100}}));
  t.observe(batch(1,[3],{observation:{...batch(1,[3]).observation,stamp:6000}}));
  assert.equal(total(t.snapshot().opening),3);
});
