const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRoom } = require('../extension/snapshot.js');

test('normalizes the room.game.players schema and excludes account data', () => {
  const result = normalizeRoom({ game: { updateCount: 3, players: [{ id: 1, name: 'Opponent', userId: 'secret', items: [
    { id: 8, modelId: 12, fakeModelId: 24, used: true, extra: 'secret' }
  ] }] }, users: [{ id: 'secret' }] });
  assert.equal(result.status, 'playing');
  assert.equal(result.players[0].items[0].modelId, 12);
  assert.equal(result.players[0].items[0].fakeModelId, 24);
  assert.equal(result.players[0].items[0].used, true);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('missing, redacted, empty and zero IDs stay distinguishable', () => {
  const { players } = normalizeRoom({ game: { players: [
    { items: [] }, {}, { items: [{ modelId: 0 }, {}, { modelId: '12' }, null] }
  ] } });
  assert.equal(players[0].itemsAvailable, true);
  assert.equal(players[1].itemsAvailable, false);
  assert.deepEqual(players[2].items.map(i => i.modelId), [0, null, null, null]);
});
test('does not mistake events or malformed room data for current hands', () => {
  assert.equal(normalizeRoom({ events: [{ items: [{ modelId: 12 }] }] }).status, 'unsupported');
  assert.equal(normalizeRoom({ game: {} }).status, 'unsupported');
  assert.equal(normalizeRoom({ game: null }).status, 'lobby');
  assert.equal(normalizeRoom({ users: [{id: 'test'}], entries: [] }).status, 'lobby');
  assert.equal(normalizeRoom({ game: { players: [], isOver: true } }).status, 'finished');
});
test('bounds strings and collections on the bridge', () => {
  const result = normalizeRoom({ game: { players: Array.from({length: 50}, () => ({ name: 'a'.repeat(200), items: Array(100).fill({}) })) } });
  assert.equal(result.players.length, 9);
  assert.equal(result.players[0].name.length, 120);
  assert.equal(result.players[0].items.length, 64);
});

test('retains only bounded public team and curse fields for matchup analysis', () => {
  const {players} = normalizeRoom({game:{players:[
    {team:2,curses:['flash','darkcloud','secret',null],userId:'private'},
    {team:0,curses:'flash'}, {team:99}, {}
  ]}});
  assert.equal(players[0].team,2);
  assert.deepEqual(players[0].curses,['flash','darkcloud']);
  assert.equal(players[1].team,0);
  assert.deepEqual(players[1].curses,[]);
  assert.equal(players[2].team,null);
  assert.equal(players[3].team,null);
  assert.ok(!JSON.stringify(players).includes('private'));
});

test('probability observations retain only explicit bounded gift models and public timing',()=>{
  const result=normalizeRoom({game:{players:[],updateCount:1,updatedAt:{seconds:100,nanoseconds:500000000},events:[
    {action:'startGame',userId:'secret'}, {action:'gift',item:{modelId:112,id:42,userId:'secret'}},
    {action:'trade',items:[{modelId:208}],name:'secret'}, {action:'gift',item:{modelId:0}}
  ]}});
  assert.deepEqual(result.observation,{eventsAvailable:true,truncated:false,startsGame:true,gifts:[112,0],stamp:100500});
  assert.ok(!JSON.stringify(result).includes('secret'));
  const huge=normalizeRoom({game:{players:[],events:Array(300).fill({action:'gift',item:{modelId:3}})}});
  assert.equal(huge.observation.gifts.length,256);assert.equal(huge.observation.truncated,true);
});
