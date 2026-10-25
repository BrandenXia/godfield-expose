(() => {
  'use strict';
  const STORAGE_KEY = 'godfield-room-inspector-important-items';
  const DEFAULT_ITEM_IDS = Object.freeze([56, 91, 112, 180, 181, 189, 204, 233]);
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const normalize = values => new Set(values.filter(validId).sort((a, b) => a - b));
  const parse = value => normalize(String(value ?? '').split(/[,\s]+/).map(Number));
  const serialize = ids => [...ids].sort((a, b) => a - b).join(', ');

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? normalize([...DEFAULT_ITEM_IDS]) : parse(stored);
    } catch {
      return normalize([...DEFAULT_ITEM_IDS]);
    }
  }

  function save(ids) {
    const normalized = normalize([...ids]);
    try { localStorage.setItem(STORAGE_KEY, serialize(normalized)); } catch { /* Storage may be unavailable. */ }
    return normalized;
  }

  function owners(items, ids) {
    const important = ids instanceof Set ? ids : normalize([...ids]);
    return new Set(items.filter(item => important.has(item?.modelId)).map(item => item.modelId));
  }

  const api = Object.freeze({DEFAULT_ITEM_IDS, load, save, parse, serialize, owners});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GodfieldImportantItems = api;
})();
