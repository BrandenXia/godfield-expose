(() => {
  'use strict';
  const CHANNEL = 'godfield-room-inspector-v1';
  const normalize = window.__godfieldInspectorSchema.normalizeRoom;
  const wrapped = new WeakSet();
  let current = null;
  let connection = 0;
  let last = { status: 'waiting-sdk', players: [] };
  function emit(state) {
    last = { ...state, connectionId: current?.id ?? 0, receivedAt: Date.now() };
    try { window.postMessage({ channel: CHANNEL, type: 'state', state: last }, location.origin); } catch {}
  }
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin &&
        event.data?.channel === CHANNEL && event.data.type === 'ready') {
      emit(last);
    }
  });
  function install(firebase) {
    if (!firebase || typeof firebase.onSnapshot !== 'function' || wrapped.has(firebase)) return;
    const original = firebase.onSnapshot;
    firebase.onSnapshot = function (...args) {
      // Ignore chat, rankings, and every other document. Never make a new read.
      if (!/^modes\/[^/]+\/rooms\/[^/]+$/.test(args[0]?.path ?? '')) {
        return Reflect.apply(original, this, args);
      }
      const subscription = {id:++connection};
      const previous = current;
      current = subscription;
      let nextIndex = args.findIndex((arg, index) => index > 0 && typeof arg === 'function');
      const observerIndex = args.findIndex((arg, index) => index > 0 && arg &&
        typeof arg === 'object' && typeof arg.next === 'function');
      function inspect(snapshot) {
        if (current !== subscription) return;
        try {
          if (snapshot.exists && !snapshot.exists()) emit({ status: 'missing', players: [] });
          else emit({ ...normalize(snapshot.data()), fromCache: snapshot.metadata?.fromCache === true, pendingWrites:snapshot.metadata?.hasPendingWrites === true });
        } catch { emit({ status: 'unsupported', players: [] }); }
      }
      function onError() {
        if (current === subscription) emit({ status: 'error', players: [] });
      }
      if (observerIndex >= 0) {
        const observer = args[observerIndex];
        args[observerIndex] = {
          next(snapshot) { inspect(snapshot); return observer.next.call(observer, snapshot); },
          error(error) { onError(); return observer.error?.call(observer, error); },
          complete() { return observer.complete?.call(observer); }
        };
      } else if (nextIndex >= 0) {
        const next = args[nextIndex];
        const error = args[nextIndex + 1];
        args[nextIndex] = function (snapshot) { inspect(snapshot); return Reflect.apply(next, this, arguments); };
        args[nextIndex + 1] = function (reason) {
          onError();
          if (typeof error === 'function') return Reflect.apply(error, this, arguments);
        };
      } else {
        current = previous;
        return Reflect.apply(original, this, args);
      }
      emit({ status: 'waiting-room', players: [] });
      let unsubscribe;
      try { unsubscribe = Reflect.apply(original, this, args); }
      catch (error) {
        current = previous;
        emit({ status: 'error', players: [] });
        throw error;
      }
      return function () {
        try { return Reflect.apply(unsubscribe, this, arguments); }
        finally {
          if (current === subscription) {
            current = null;
            emit({ status: 'left', players: [] });
          }
        }
      };
    };
    wrapped.add(firebase);
    emit({ status: 'ready', players: [] });
  }
  // The site's module assigns window.firebase before the Dart client starts.
  // A setter catches that assignment synchronously; polling would race startup.
  const descriptor = Object.getOwnPropertyDescriptor(window, 'firebase');
  if (!descriptor || (descriptor.configurable && Object.hasOwn(descriptor, 'value'))) {
    let value = descriptor?.value;
    Object.defineProperty(window, 'firebase', {
      configurable: true, enumerable: descriptor?.enumerable ?? true,
      get() { return value; },
      set(next) { value = next; install(next); }
    });
    install(value);
  } else {
    install(window.firebase);
  }
})();
