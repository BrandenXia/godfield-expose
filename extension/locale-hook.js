(() => {
  'use strict';
  // Observe the catalog the game actually loads, including when it removes
  // ?lang from the URL. Do not read bodies or issue any extra requests.
  const CHANNEL = 'godfield-room-inspector-v1';
  const original = window.fetch;
  let language = null;
  let latestRequest = 0;
  function announce() {
    if (language) window.postMessage({ channel: CHANNEL, type: 'language', language }, location.origin);
  }
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin &&
        event.data?.channel === CHANNEL && event.data.type === 'ready') announce();
  });
  if (typeof original !== 'function') return;
  window.fetch = function (...args) {
    const result = Reflect.apply(original, this, args);
    try {
      const input = args[0];
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      const match = url.origin === location.origin && /^\/i18n\/(en|fr|ja|ko|pt|ru|zh-hans|zh-hant)\.json$/.exec(url.pathname);
      if (match) {
        const request = ++latestRequest;
        result.then(response => {
          if (response.ok && request === latestRequest) { language = match[1]; announce(); }
        }, () => {}).catch(() => {});
      }
    } catch { /* Observation must never disrupt the game's request. */ }
    return result;
  };
})();
