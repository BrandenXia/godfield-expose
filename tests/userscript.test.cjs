const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('userscript/godfield-room-inspector.user.js', 'utf8');

test('installable userscript declares early page access and the extension version/scope', () => {
  assert.ok(source.startsWith('// ==UserScript==\n'));
  const header = source.slice(0, source.indexOf('// ==/UserScript=='));
  const values = key => [...header.matchAll(new RegExp(`^// @${key}\\s+(.+)$`, 'gm'))].map(match => match[1].trim());
  const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  assert.deepEqual(values('version'), [manifest.version]);
  assert.deepEqual(values('match'), ['https://godfield.net/*']);
  assert.deepEqual(values('run-at'), ['document-start']);
  assert.deepEqual(values('sandbox'), ['raw']);
  assert.deepEqual(values('grant'), ['none']);
  assert.match(header, /^\/\/ @noframes$/m);
  assert.doesNotMatch(header, /^\/\/ @(require|resource|include|connect)\b/m);
  assert.deepEqual(values('downloadURL'), ['https://raw.githubusercontent.com/BrandenXia/godfield-expose/main/userscript/godfield-room-inspector.user.js']);
  assert.deepEqual(values('updateURL'), values('downloadURL'));
  // Concatenation must remain valid as a single script, including shared consts.
  assert.doesNotThrow(() => new vm.Script(source));
});
