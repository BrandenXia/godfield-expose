const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const messages = [], subscriptions = [], listeners = {};
  const window = { addEventListener(type, fn) { listeners[type] = fn; }, postMessage(data) { messages.push(data); } };
  const context = vm.createContext({ window, location: { origin: 'https://godfield.net' } });
  for (const file of ['snapshot.js', 'hook.js']) vm.runInContext(fs.readFileSync(`extension/${file}`, 'utf8'), context);
  const firebase = { onSnapshot(...args) {
    const record = { args, stopped: false, receiver: this };
    subscriptions.push(record);
    return () => { record.stopped = true; return 'unsubscribed'; };
  } };
  window.firebase = firebase;
  const snapshot = { data: () => ({ game: { players: [{ name: 'A', items: [{modelId: 15}] }] } }) };
  return { window, firebase, messages, subscriptions, listeners, snapshot, state: () => messages.at(-1).state };
}
const ref = { path: 'modes/private/rooms/test' };
test('catches Firebase assignment synchronously, observes without changing callback data', () => {
  const h = harness();
  let delivered;
  const stop = h.firebase.onSnapshot(ref, data => { delivered = data; });
  h.subscriptions[0].args[1](h.snapshot);
  assert.equal(delivered, h.snapshot);
  assert.equal(h.state().players[0].items[0].modelId, 15);
  assert.equal(h.subscriptions[0].receiver, h.firebase);
  assert.equal(stop(), 'unsubscribed');
  assert.equal(h.state().status, 'left');
  assert.ok(h.subscriptions[0].stopped);
});
test('ignores chat and other paths and adds no subscriptions', () => {
  const h = harness();
  const callback = () => {};
  h.firebase.onSnapshot({ path: 'modes/private/rooms/test/messages/1' }, callback);
  assert.equal(h.subscriptions.length, 1);
  assert.equal(h.subscriptions[0].args[1], callback);
  assert.equal(h.state().status, 'ready');
});
test('supports options and observer objects, preserving observer receiver and errors', () => {
  const h = harness();
  let receiver, receivedError;
  const observer = { next() { receiver = this; }, error(e) { receivedError = e; } };
  h.firebase.onSnapshot(ref, { includeMetadataChanges: true }, observer);
  h.subscriptions[0].args[2].next(h.snapshot);
  assert.equal(receiver, observer);
  const error = new Error('denied');
  h.subscriptions[0].args[2].error(error);
  assert.equal(receivedError, error);
  assert.equal(h.state().status, 'error');
  assert.equal(h.state().players.length, 0);
});
test('old room callbacks and unsubscribe cannot replace the current room', () => {
  const h = harness();
  const stopOld = h.firebase.onSnapshot(ref, () => {});
  h.firebase.onSnapshot({path: 'modes/private/rooms/new'}, () => {});
  h.subscriptions[1].args[1](h.snapshot);
  stopOld();
  h.subscriptions[0].args[1]({data: () => ({game: null})});
  assert.equal(h.state().status, 'playing');
});
test('late panel handshake replays state; cache and missing data are represented', () => {
  const h = harness();
  h.firebase.onSnapshot(ref, () => {});
  h.subscriptions[0].args[1]({...h.snapshot, metadata: {fromCache: true}});
  assert.equal(h.state().fromCache, true);
  const count = h.messages.length;
  h.listeners.message({ source: h.window, origin: 'https://godfield.net', data: {channel: 'godfield-room-inspector-v1', type: 'ready'} });
  assert.equal(h.messages.length, count + 1);
  assert.equal(h.state().status, 'playing');
  h.subscriptions[0].args[1]({exists: () => false});
  assert.equal(h.state().status, 'missing');
});
test('inspection failure does not prevent the game callback', () => {
  const h = harness();
  let called = false;
  h.firebase.onSnapshot(ref, () => { called = true; });
  h.subscriptions[0].args[1]({data() {throw Error('bad snapshot');}});
  assert.ok(called);
  assert.equal(h.state().status, 'unsupported');
});
test('callback errors reach the caller and do not retain stale inventory', () => {
  const h = harness();
  let forwarded;
  h.firebase.onSnapshot(ref, () => {}, error => { forwarded = error; });
  h.subscriptions[0].args[1](h.snapshot);
  const error = new Error('offline');
  h.subscriptions[0].args[2](error);
  assert.equal(forwarded, error);
  assert.equal(h.state().status, 'error');
  assert.equal(h.state().players.length, 0);
});
test('reassigning the same bridge does not stack wrappers', () => {
  const h = harness();
  const wrapped = h.firebase.onSnapshot;
  h.window.firebase = h.firebase;
  assert.equal(h.firebase.onSnapshot, wrapped);
});
