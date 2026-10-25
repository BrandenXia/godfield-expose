const {test} = require('node:test');
const assert = require('node:assert/strict');
const important = require('../extension/important.js');

test('defaults to the Ascension Bow and exposes a set of item IDs', () => {
  assert.deepEqual([...important.parse('112')], [112]);
  assert.ok(important.DEFAULT_ITEM_IDS.includes(112));
  assert.ok(important.owners([{modelId: 112}, {modelId: 12}], new Set([112])).has(112));
});

test('parses configurable IDs defensively and preserves only valid unique IDs', () => {
  assert.deepEqual([...important.parse('112, 56 112 nope -1 0')], [56, 112]);
  assert.equal(important.serialize(new Set([112, 56])), '56, 112');
});
