const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({});
for (const file of ['catalog.js','matchups.js']) vm.runInContext(fs.readFileSync(`extension/${file}`, 'utf8'), context);
const rules = context.GodfieldMatchups;
const item = (modelId, extra = {}) => ({id:modelId, modelId, ...extra});
const player = (id, items = [], extra = {}) => ({id, name:`Player ${id}`, mp:20, team:0, itemsAvailable:true, items, curses:[], ...extra});
const pair = (a,d,p=player(1),q=player(2)) => rules.compare(item(a),item(d),p,q);

test('ordinary defenses respect opposite elements, light substitution and light bypass', () => {
  assert.equal(pair(13,113).text, 'DEF 1; 2 ATK gets through');
  assert.equal(pair(59,145).kind, 'full'); // Fire / water.
  assert.equal(pair(60,144).kind, 'full'); // Water / fire.
  assert.equal(pair(61,117).kind, 'full'); // Wood / stone.
  assert.equal(pair(62,116).kind, 'full'); // Stone / wood.
  assert.equal(pair(59,146).kind, 'bypass');
  assert.equal(pair(59,169).kind, 'full'); // Light armor substitutes.
  assert.equal(pair(91,180).kind, 'bypass'); // Light attack ignores ordinary DEF30.
});
test('reflection and blocking use attack category and NE weapon restrictions', () => {
  assert.equal(pair(13,38).text, 'Reflects the attack');
  assert.equal(pair(59,38).kind, 'bypass');
  assert.equal(pair(211,38).kind, 'bypass');
  assert.equal(pair(211,42).text, 'Blocks the attack');
  assert.equal(pair(13,42).kind, 'bypass');
  assert.equal(pair(91,190).kind, 'full');
  assert.equal(pair(222,114).text, 'Bounces to a random target');
  assert.equal(pair(222,180).kind, 'bypass');
});
test('darkness, counters and element filtering are not falsely reported as blocks', () => {
  assert.match(pair(86,113).text, /HP 0/);
  assert.equal(pair(86,180).kind, 'full');
  assert.equal(pair(86,181).kind, 'counter');
  assert.equal(pair(91,189).kind, 'filter');
  assert.match(pair(91,189,player(1),player(2,[],{curses:['flash']})).text, /Flash prevents/);
});
test('performed miracles remain available, while MP and cost waivers are checked', () => {
  const wall = item(233,{used:true});
  assert.equal(rules.availability(wall,player(1,[wall],{mp:6}),true).ready,true);
  assert.equal(rules.availability(wall,player(1,[wall],{mp:5}),true).ready,false);
  assert.equal(rules.availability(wall,player(1,[wall,item(204)],{mp:0}),true).ready,null);
  assert.equal(rules.availability(wall,player(1,[wall,item(204)],{mp:0,curses:['flash']}),true).ready,false);
  assert.equal(rules.availability(wall,player(1,[wall],{mp:null}),true).ready,null);
});
test('uses current MP, flags repeat hits and keeps attack add-ons conditional', () => {
  assert.equal(rules.attack(item(58),player(1,[],{mp:7})).atk,14);
  assert.equal(rules.attack(item(58),player(1,[],{mp:null})).atk,null);
  assert.ok(rules.attack(item(14),player(1)).notes.some(n=>n.includes('per hit')));
  assert.equal(pair(231,180).kind,'conditional');
  assert.equal(pair(203,180).kind,'conditional');
  assert.equal(rules.attack(item(199),player(1)),null);
});
test('groups by opponents, excludes teammates/dead players, preserves solo opponents', () => {
  const owner=player(1,[item(13)],{team:1});
  const enemies=[player(2,[item(113)],{team:2}),player(3,[item(180)],{team:1}),player(4,[item(180)],{dead:true}),player(5,[])];
  const result=rules.analyze(item(13),owner,{players:[owner,...enemies]});
  assert.deepEqual(Array.from(result.sections[0].groups,g=>g.player.id),[2,5]);
  assert.equal(result.uncertainTeams,false);
  assert.equal(rules.analyze(item(13),null,{players:enemies}).ambiguous,true);
});
test('compatible defenses stack unless Flash restricts selection; unknowns stay unknown', () => {
  const owner=player(1,[item(23)]);
  const enemy=player(2,[item(113),item(118),item(0)],{team:null});
  let result=rules.analyze(item(23),owner,{players:[owner,enemy]});
  assert.match(result.sections[0].groups[0].summary,/DEF 3 vs ATK 6/);
  assert.equal(result.sections[0].groups[0].unknown,1);
  assert.equal(result.uncertainTeams,true);
  enemy.curses=['flash'];
  result=rules.analyze(item(23),owner,{players:[owner,enemy]});
  assert.match(result.sections[0].groups[0].summary,/best single DEF 2/);
});
test('dual-purpose items have both sections and protection previews include bypassing threats', () => {
  const owner=player(1,[item(37)]),enemy=player(2,[item(91),item(13),item(233)]);
  const result=rules.analyze(item(37),owner,{players:[owner,enemy]});
  assert.deepEqual(Array.from(result.sections,s=>s.mode),['defenses','attacks']);
  assert.ok(result.sections[1].groups[0].rows.some(r=>r.item.modelId===91&&r.verdict.kind==='bypass'));
});
