const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({ URLSearchParams });
for (const file of ['catalog.js', 'localization.js']) vm.runInContext(fs.readFileSync(`extension/${file}`, 'utf8'), context);
const localization = context.GodfieldLocalization;

test('resolves official item names, translated stats and original artwork by stable ID', () => {
  const ja = localization.item(12, 'ja');
  assert.equal(ja.name, 'クロスボウ');
  assert.equal(ja.categoryLabel, '武器');
  assert.equal(ja.stats[0], '+攻2');
  assert.equal(ja.image, 'https://godfield.net/images/items/weapons/crossbow.webp');
  assert.equal(localization.item(12, 'zh-hans').name, '弩箭');
  assert.equal(localization.item(12, 'zh-hant').name, '十字弓');
  assert.equal(localization.item(12, 'fr').name, 'Arbalète');
  for (const lang of localization.supported) {
    for (let id = 1; id <= 296; id++) {
      const item = localization.item(id, lang);
      assert.ok(item.name);
      assert.ok(item.categoryLabel);
      assert.ok(item.image.startsWith('https://godfield.net/images/items/'));
    }
  }
});
test('matches the game URL, exact-browser and prefix-language precedence', () => {
  assert.equal(localization.detectLanguage('?lang=zh-hant', ['en-US']), 'zh-hant');
  assert.equal(localization.detectLanguage('', ['fr-CA', 'ja']), 'fr');
  assert.equal(localization.detectLanguage('', ['zh-hant']), 'zh-hant');
  assert.equal(localization.detectLanguage('', ['zh-TW']), 'zh-hans'); // Matches the game's prefix fallback.
  assert.equal(localization.detectLanguage('?lang=invalid', ['xx', 'ko-KR']), 'ko');
  assert.equal(localization.detectLanguage('', ['xx']), 'en');
});
test('does not invent images or names for concealed or invalid IDs', () => {
  for (const id of [0, -1, null, undefined, '12', 9999, 1.5]) assert.equal(localization.item(id, 'ja'), null);
  assert.equal(localization.item(12, 'invalid').name, 'Crossbow');
});
