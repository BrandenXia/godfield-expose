(() => {
  'use strict';
  const CHANNEL = 'godfield-room-inspector-v1', STORAGE = 'godfield-inspector-name-rules-v1';
  function create({getState, language, onChange}) {
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    let source = GodfieldNameRules.defaults, enabled = true, storageIssue = '';
    try {
      const stored = localStorage.getItem(STORAGE) || 'null';
      if (stored.length > 80000) throw Error('Oversized saved rules');
      const saved = JSON.parse(stored);
      if (saved && typeof saved.source === 'string') {
        const parsed = GodfieldNameRules.compile(saved.source);
        if (!parsed.errors.length) { source = saved.source; enabled = saved.enabled !== false; }
        else storageIssue = 'Saved rules are invalid. Presets are active; edit and apply to replace them.';
      }
    } catch { storageIssue = 'Saved rules could not be loaded. Presets are active.'; }
    let rules = GodfieldNameRules.compile(source).rules;
    const editor = el('section', 'rules-editor');
    editor.setAttribute('aria-label', 'Name label rules');
    editor.append(el('h3', '', 'Name labels'));
    const enabledLabel = el('label', 'rules-enabled', ' Enable name labels');
    const checkbox = el('input', ''); checkbox.type = 'checkbox'; checkbox.checked = enabled;
    enabledLabel.prepend(checkbox); editor.append(enabledLabel);
    editor.append(el('p', 'rules-help', 'One rule per line. First match colors the name; all matches add badges. Item names work in all eight languages.'));
    const input = el('textarea', 'rules-source');
    input.setAttribute('aria-label', 'Rule text'); input.spellcheck = false; input.value = source; input.maxLength = 12000;
    editor.append(input);
    const actions = el('div', 'rules-actions');
    const apply = el('button', 'export', 'Apply rules');
    const reset = el('button', 'export', 'Load presets');
    actions.append(apply, reset); editor.append(actions);
    const message = el('p', 'rules-message', storageIssue || 'Changes take effect when you apply them.');
    message.setAttribute('role', 'status');
    const errors = el('p', 'rules-errors'); errors.setAttribute('role', 'alert');
    editor.append(message, errors);
    const help = el('details', 'rules-guide');
    help.append(el('summary', '', 'Rule syntax & examples'));
    help.append(el('pre', '', 'has("升天弓") => #b13978 "{item}"\nhas("太阳守护") => #986200 "{item}"\ndef == 0 => #b53535 "DEF 0"\nhas(112) and hp <= 10 => #b53535 "Bow · HP {hp}"\nnot has(208) and def < 5 => #a34e22 "Low DEF {def}"'));
    help.append(el('p', '', 'Conditions: has("item name") or has(ID); def, hp, mp, cp, items with == != < <= > >=. Combine with and, or, not, and parentheses. Start comment lines with //. Colors: #RGB or #RRGGBB. Labels support {item}, {def}, {hp}, {mp}, {cp}, {items}. Empty text disables all rules.'));
    help.append(el('p', '', 'DEF is the sum of printed DEF on owned known items, including dual-purpose cards. It does not include reflection, blocking, elemental compatibility, or MP costs. Unknown inventories cannot match DEF or absent-item rules. Eliminated players have no labels. Presets load into the editor; Apply saves them.'));
    editor.append(help, el('h4', '', 'Preview · current room'));
    const preview = el('div', 'rules-preview'); editor.append(preview);
    function matches(player, selected = rules) { return enabled ? GodfieldNameRules.evaluate(selected, player, language()) : []; }
    function badgeNode(match) {
      const badge = el('span', 'name-rule-badge', match.text);
      badge.style.color = match.color;
      return badge;
    }
    function decorate(name, container, player) {
      const labels = matches(player);
      if (labels.length) {
        name.style.color = labels[0].color;
        name.style.background = '#eeffee'; name.style.padding = '0 4px'; name.style.borderRadius = '3px';
      }
      for (const label of labels) container.append(badgeNode(label));
    }
    function previewDraft() {
      const parsed = GodfieldNameRules.compile(input.value);
      errors.textContent = parsed.errors.join('\n');
      input.setAttribute('aria-invalid', String(Boolean(parsed.errors.length)));
      apply.disabled = parsed.errors.length > 0;
      preview.replaceChildren();
      if (parsed.errors.length) { preview.append(el('p', '', 'Fix the errors to preview. Your applied rules are unchanged.')); return; }
      const state = getState();
      if (!state.players.length) preview.append(el('p', '', 'Join a game to preview player labels.'));
      for (const player of state.players) {
        const row = el('div', 'rules-preview-row'), name = el('strong', '', player.name);
        row.append(name);
        const labels = checkbox.checked ? GodfieldNameRules.evaluate(parsed.rules, player, language()) : [];
        if (labels.length) name.style.color = labels[0].color;
        for (const label of labels) row.append(badgeNode(label));
        if (!labels.length) row.append(el('span', 'rules-help', 'No matching labels'));
        preview.append(row);
      }
    }
    input.oninput = checkbox.onchange = () => { message.textContent = 'Unsaved changes · preview only'; previewDraft(); };
    reset.onclick = () => { input.value = GodfieldNameRules.defaults; checkbox.checked = true; input.oninput(); };
    apply.onclick = () => {
      const parsed = GodfieldNameRules.compile(input.value);
      if (parsed.errors.length) { previewDraft(); return; }
      source = input.value; enabled = checkbox.checked; rules = parsed.rules;
      try { localStorage.setItem(STORAGE, JSON.stringify({source, enabled})); message.textContent = 'Applied and saved in this browser.'; }
      catch { message.textContent = 'Applied for this tab. Browser storage is unavailable; changes will not survive reload.'; }
      onChange();
    };
    // Scope styling to validated native name text nodes. Removing the attribute
    // restores the game's own inline styles; status values and target buttons stay intact.
    const style = document.createElement('style');
    style.textContent = '#main [data-gfi-name-labeled] { color:var(--gfi-name-color) !important; max-width:60px !important; font-size:16px !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }';
    document.documentElement.append(style);
    const decorated = new Map();
    function remove(name, entry) {
      name.removeAttribute('data-gfi-name-labeled'); name.style.removeProperty('--gfi-name-color'); entry.host.remove();
      decorated.delete(name);
    }
    function clear() { for (const [name, entry] of decorated) remove(name, entry); }
    let frame = 0, request = 0;
    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const state = getState();
        if (!enabled || !['playing','finished'].includes(state.status) || !rules.length) { request++; clear(); return; }
        window.postMessage({channel:CHANNEL, type:'list-player-targets', request:++request}, location.origin);
      });
    }
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin || data?.channel !== CHANNEL ||
          data.type !== 'player-targets' || data.request !== request || !Array.isArray(data.targets) || data.targets.length > 18) return;
      const seen = new Set(), state = getState();
      if (!enabled || !['playing','finished'].includes(state.status)) { clear(); return; }
      for (const target of data.targets) {
        if (!target || !/^\d{1,9}$/.test(target.target) || !Number.isSafeInteger(target.playerId)) continue;
        const player = state.players.find(p => p.id === target.playerId && p.name === target.name);
        const name = document.querySelector(`#main [data-gfi-name-target="${target.target}"]`);
        const root = document.querySelector(`#main [data-gfi-target="${target.target}"]`);
        if (!player || !name || !root?.contains(name) || !name.parentElement) continue;
        const labels = matches(player);
        if (!labels.length) continue;
        seen.add(name);
        let entry = decorated.get(name);
        if (!entry) {
          const host = document.createElement('span'); host.dataset.gfiNameBadges = target.target;
          host.setAttribute('role', 'note');
          const shadow = host.attachShadow({mode:'open'}), css = el('style', '');
          css.textContent = ':host { position:absolute; top:0; width:57px; height:40px; display:flex; flex-direction:column; justify-content:center; pointer-events:none; z-index:1; font:10px/12px Meiryo,system-ui,sans-serif; } span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:#eeffee; border-radius:2px; padding:0 2px; }';
          shadow.append(css);
          const list = el('div', ''); shadow.append(list);
          entry = {host, list}; decorated.set(name, entry);
        }
        const left = parseFloat(name.style.left);
        if (!Number.isFinite(left)) { seen.delete(name); continue; }
        entry.host.style.left = `${left + 63}px`;
        if (entry.host.parentElement !== name.parentElement) name.parentElement.append(entry.host);
        entry.list.replaceChildren();
        const shown = labels.length > 3 ? 2 : 3;
        for (const label of labels.slice(0, shown)) entry.list.append(badgeNode(label));
        if (labels.length > 3) entry.list.append(el('span', '', `+${labels.length - shown} more`));
        entry.host.setAttribute('aria-label', labels.map(l => l.text).join(' · '));
        name.setAttribute('data-gfi-name-labeled', '');
        name.style.setProperty('--gfi-name-color', labels[0].color);
      }
      for (const [name, entry] of decorated) if (!seen.has(name)) remove(name, entry);
    });
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['data-gfi-target']});
    previewDraft();
    return {editor, decorate, update() { previewDraft(); schedule(); }};
  }
  globalThis.GodfieldNameLabels = Object.freeze({create});
})();
