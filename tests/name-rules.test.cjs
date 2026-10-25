const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({URLSearchParams});
for (const file of ['catalog.js','localization.js','name-rules.js']) vm.runInContext(fs.readFileSync(`extension/${file}`,'utf8'),context);
const {compile,evaluate,defaults} = context.GodfieldNameRules;
const player = (ids, extra={}) => ({itemsAvailable:true, items:ids.map((modelId,id)=>({id,modelId})), hp:40, mp:10, cp:20, ...extra});
const match = (source,p,language='en') => {
  const parsed=compile(source);assert.equal(parsed.errors.length,0,parsed.errors.join('\n'));
  return JSON.parse(JSON.stringify(evaluate(parsed.rules,p,language)));
};
test('presets support translated names, actual dream models, ordering and label localization',()=>{
  const p=player([112,208],{items:[{id:1,modelId:112,fakeModelId:3},{id:2,modelId:208}]});
  const labels=match(defaults,p,'zh-hans');
  assert.deepEqual(labels.map(l=>l.text),['升天弓','太阳守护','DEF 0']);
  assert.equal(labels[0].color,'#b13978');
  assert.equal(match('has("太陽のお守り") => #abc "{item}"',p)[0].text,'Sun Amulet');
  assert.equal(match('has(112) => #abc "{item}"',p)[0].text,'Ascension Bow');
});
test('DEF counts dual-purpose items and treats missing/concealed inventory as unknown',()=>{
  assert.equal(match('def == 0 => #abc "zero"',player([112,208])).length,1);
  assert.equal(match('def == 0 => #abc "zero"',player([0])).length,0);
  assert.equal(match('def == 0 => #abc "zero"',player([],{itemsAvailable:false})).length,0);
  assert.equal(match('def == 0 => #abc "zero"',player([99999])).length,0);
  assert.equal(match('def >= 1 => #abc "{def}"',player([37])).length,1);
  assert.equal(match('def == 6 => #abc "{def}"',player([145]))[0].text,'6');
  assert.equal(match('def == 0 => #abc "zero"',player([])).length,1);
});
test('logical precedence, grouping, not, and unknowns do not invent missing items',()=>{
  const rule='not has(208) and (def == 0 or hp <= 10) => #abc "vulnerable"';
  assert.equal(match(rule,player([112])).length,1);
  assert.equal(match(rule,player([112,208])).length,0);
  assert.equal(match(rule,player([0],{hp:5})).length,0);
  assert.equal(match('has(112) or has(208) => #abc "{item}"',player([112,0]))[0].text,'Ascension Bow');
  assert.equal(match('not (hp > 10) => #abc "low"',player([],{hp:null})).length,0);
  assert.equal(match('has(112) and hp <= 10 or has(208) => #abc "yes"',player([208])).length,1);
  assert.equal(match(defaults,player([112],{dead:true})).length,0);
});
test('invalid rules are rejected atomically with line numbers, without execution',()=>{
  const result=compile('has(112) => #abc "ok"\nhas("does not exist") => #abc "bad"');
  assert.equal(result.rules.length,0);assert.match(result.errors[0],/^Line 2:/);
  for (const rule of ['hp = 0 => #abc "x"','has(0) => #abc "x"','hp < 2 => red "x"',
    'hp < 2 => #fff "{unknown}"','hp < 2 => #fff "x"; alert(1)','hp < 2 => #fff ""',
    'not '.repeat(20)+'has(112) => #abc "x"']) assert.ok(compile(rule).errors.length,rule);
  assert.ok(compile('x'.repeat(12001)).errors.length);
  assert.ok(compile(Array(33).fill('hp > 0 => #abc "ok"').join('\n')).errors.length);
  assert.equal(compile('// comment\n\n').rules.length,0);
  assert.equal(match('hp > 0 => #abc "<img src=x onerror=alert(1)>"',player([]))[0].text,'<img src=x onerror=alert(1)>');
});
