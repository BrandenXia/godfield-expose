const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const messages = [], calls = [];
  let listener;
  const window = {
    fetch(...args) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      calls.push({args, receiver: this, promise, resolve, reject});
      return promise;
    },
    postMessage(message) { messages.push(message); },
    addEventListener(type, callback) { listener = callback; }
  };
  const location = {origin: 'https://godfield.net', href: 'https://godfield.net/?lang=en'};
  vm.runInNewContext(fs.readFileSync('extension/locale-hook.js', 'utf8'), {window, location, URL});
  return {window, messages, calls, ready: () => listener({source:window, origin:location.origin, data:{channel:'godfield-room-inspector-v1',type:'ready'}})};
}
test('observes successful same-origin locale requests without replacing promises or consuming bodies', async () => {
  const h = harness();
  const promise = h.window.fetch('/i18n/ja.json', {cache:'reload'});
  assert.equal(promise, h.calls[0].promise);
  assert.equal(h.calls[0].receiver, h.window);
  const response = {ok:true, json() {throw Error('body must not be read');}};
  h.calls[0].resolve(response);
  assert.equal(await promise, response);
  assert.equal(h.messages[0].language, 'ja');
  h.ready();
  assert.equal(h.messages[1].language, 'ja');
});
test('failed, unrelated and foreign requests never change the language', async () => {
  const h = harness();
  for (const url of ['/i18n/en.json','https://example.com/i18n/ja.json','/other','/i18n/invalid.json']) {
    const promise = h.window.fetch(url);
    h.calls.at(-1).resolve({ok:url !== '/i18n/en.json'});
    await promise;
  }
  const rejected = h.window.fetch('/i18n/fr.json');
  h.calls.at(-1).reject(Error('offline'));
  await assert.rejects(rejected);
  assert.equal(h.messages.length, 0);
});
test('late previous-language response cannot override the newest requested language', async () => {
  const h = harness();
  const older = h.window.fetch(new URL('https://godfield.net/i18n/en.json'));
  const newer = h.window.fetch({url:'https://godfield.net/i18n/zh-hant.json'});
  h.calls[1].resolve({ok:true});
  await newer;
  h.calls[0].resolve({ok:true});
  await older;
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].language, 'zh-hant');
});
