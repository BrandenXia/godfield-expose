(() => {
  'use strict';
  // The current Dart client stores a view behind each interop event callback.
  // Read only own data fields: never invoke a callback, getter, or game command.
  const own = (object, key) => object && Object.getOwnPropertyDescriptor(object, key)?.value;
  const element = value => value instanceof Element;
  function decode(view) {
    const node = own(view, 'a');
    const id = own(view, 'c');
    if (!element(node) || !Number.isSafeInteger(id)) return null;
    if (node.style.width === '390px' && node.style.height === '40px' &&
        typeof own(view, 'e') === 'string' && element(own(own(view, 'Q'), 'a'))) {
      return { kind: 'player', playerId: id, name: own(view, 'e').slice(0, 120) };
    }
    const modelId = own(own(view, 'e'), 'a');
    const fakeModelId = own(own(view, 'f'), 'a') ?? 0;
    if (node.style.width === '80px' && node.style.height === '100px' &&
        Number.isSafeInteger(modelId) && modelId > 0 && Number.isSafeInteger(fakeModelId)) {
      return { kind: 'item', item: { id, modelId, fakeModelId, used: Boolean(own(view, 'w')) } };
    }
    return null;
  }
  function findView(callback) {
    if (typeof callback !== 'function') return null;
    const key = Object.getOwnPropertyNames(callback).find(name => name.includes('_$dart_dartClosure_dartJSInterop'));
    let value = key && own(callback, key);
    const seen = new Set();
    for (let depth = 0; value && depth < 8 && !seen.has(value); depth++) {
      seen.add(value);
      if (decode(value)) return value;
      value = own(value, 'a');
    }
    return null;
  }
  const views = new WeakMap();
  let nextId = 0;
  const original = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, callback, ...options) {
    const result = Reflect.apply(original, this, [type, callback, ...options]);
    if ((type === 'mouseover' || type === 'click') && this instanceof Element) {
      try {
        const view = findView(callback);
        if (view) {
          const node = own(view, 'a');
          if (!views.has(node)) {
            node.setAttribute('data-gfi-target', String(++nextId));
            if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
          }
          views.set(node, view);
        }
      } catch { /* Unsupported client layouts keep the full inventory panel. */ }
    }
    return result;
  };
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin ||
        data?.channel !== 'godfield-room-inspector-v1' || data.type !== 'inspect-target' ||
        !Number.isSafeInteger(data.request) || !/^\d{1,9}$/.test(data.target)) return;
    const node = document.querySelector(`[data-gfi-target="${data.target}"]`);
    const view = node && views.get(node);
    const target = view && node.closest('#main') ? decode(view) : null;
    window.postMessage({ channel: data.channel, type: 'target', request: data.request, target }, location.origin);
  });
})();
