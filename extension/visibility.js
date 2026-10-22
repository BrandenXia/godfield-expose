(() => {
  'use strict';
  // This adapter changes the current client's view objects only. Room snapshots,
  // curse records, item instance IDs, and command submission remain untouched.
  const own = (object, key) => object && Object.getOwnPropertyDescriptor(object, key)?.value;
  const node = value => value instanceof Element;
  const itemPrototypes = new WeakSet(), playerPrototypes = new WeakSet();
  function methods(prototype, names) {
    return prototype && names.every(name => typeof own(prototype, name) === 'function');
  }
  function replace(prototype, name, wrapper) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, {...descriptor, value:wrapper(descriptor.value)});
  }
  function revealItem(view) {
    const real = own(view, 'e'), fake = own(view, 'f'), root = own(view, 'a');
    const disguise = own(own(view, 'r'), 'a');
    const category = own(own(real, 'd'), 'c'), imageName = own(real, 'c');
    if (!fake || !node(root) || !node(disguise) || !root.contains(disguise) ||
        !Number.isSafeInteger(own(real, 'a')) || own(real, 'a') <= 0 ||
        !['trade','weapons','armor','sundries','miracles','devils','guardians','phenomena'].includes(category) ||
        typeof imageName !== 'string' || !/^[a-z0-9-]+$/.test(imageName)) return;
    const art = document.createElement('div');
    art.dataset.gfiRealArt = String(real.a);
    Object.assign(art.style, {position:'absolute',left:'0',top:'0',width:'80px',height:'80px',pointerEvents:'none'});
    const fallback = document.createElement('span');
    fallback.textContent = typeof own(real, 'b') === 'string' ? real.b : `Item #${real.a}`;
    Object.assign(fallback.style, {display:'grid',placeItems:'center',width:'80px',height:'80px',fontSize:'12px',textAlign:'center',overflowWrap:'anywhere',color:'#17604e',background:'#eeffee'});
    const image = document.createElement('img');
    image.alt = fallback.textContent;
    image.width = image.height = 80;
    image.referrerPolicy = 'no-referrer';
    Object.assign(image.style, {position:'absolute',left:'0',top:'0',width:'80px',height:'80px'});
    image.onload = () => { fallback.style.display = 'none'; };
    image.onerror = () => { image.hidden = true; fallback.style.display = 'grid'; };
    image.src = `https://godfield.net/images/items/${category}/${encodeURIComponent(imageName)}.webp`;
    art.append(fallback, image);
    root.querySelectorAll('[data-gfi-real-art]').forEach(old => old.remove());
    root.insertBefore(art, root.firstChild);
    disguise.remove();
    // gL() now uses the real model for native stats, details and item selection.
    // Clearing r also prevents the game from animating a removed disguise later.
    view.f = view.r = null;
    root.dataset.gfiRevealed = 'true';
    try { view.bH(); } catch { /* Native initialization will refresh stats again. */ }
  }
  function revealPlayer(view, original) {
    const button = own(own(view, 'dy'), 'a');
    const hadTarget = node(button) && button.parentNode !== null;
    const result = Reflect.apply(original, view, [false]);
    const plate = own(own(view, 'Q'), 'a');
    if (hadTarget && node(plate) && !own(view, 'a').contains(button)) plate.append(button);
    own(view, 'a').dataset.gfiFogVisible = 'true';
    return result;
  }
  function observe(view, kind) {
    try {
      const prototype = Object.getPrototypeOf(view);
      if (kind === 'item' && methods(prototype, ['hn','gL','bH','dk'])) {
        if (!itemPrototypes.has(prototype)) {
          replace(prototype, 'hn', original => function (...args) {
            const result = Reflect.apply(original, this, args);
            try { revealItem(this); } catch { /* Preserve native initialization. */ }
            return result;
          });
          itemPrototypes.add(prototype);
        }
        // The first registration occurs partway through hn(); finish it first.
        queueMicrotask(() => { try { revealItem(view); } catch {} });
      }
      if (kind === 'player' && methods(prototype, ['em','aI','si2','fs','iT']) &&
          node(own(own(view, 'y'), 'a')) && node(own(own(view, 'z'), 'a'))) {
        if (!playerPrototypes.has(prototype)) {
          replace(prototype, 'em', original => function () { return revealPlayer(this, original); });
          // Keep the native Dart Future and animation lifecycle, always revealing.
          replace(prototype, 'aI', original => function () { return Reflect.apply(original, this, [false]); });
          playerPrototypes.add(prototype);
        }
        queueMicrotask(() => { try { if (own(view, 'CW')) view.em(false); } catch {} });
      }
    } catch { /* Unknown client shapes leave the native UI intact. */ }
  }
  function style() {
    const sheet = document.createElement('style');
    sheet.id = 'godfield-visibility-style';
    sheet.textContent = '#main img[src$="images/screens/fog.webp"] { visibility: hidden !important; pointer-events: none !important; }';
    document.documentElement.append(sheet);
  }
  if (document.documentElement) style();
  else document.addEventListener('DOMContentLoaded', style, {once:true});
  globalThis.GodfieldVisibility = Object.freeze({observe});
})();
