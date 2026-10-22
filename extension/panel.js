(() => {
  'use strict';
  const CHANNEL = 'godfield-room-inspector-v1';
  let state = { status: 'waiting-sdk', players: [] };
  let render = () => {};
  let gameLanguage = GodfieldLocalization.detectLanguage(location.search, navigator.languages);
  let languageChoice = 'auto';
  const language = () => languageChoice === 'auto' ? gameLanguage : languageChoice;
  const statuses = {
    'waiting-sdk': 'Waiting for the game…',
    ready: 'Ready · join a room to inspect its snapshot',
    'waiting-room': 'Connected · waiting for a room snapshot…',
    lobby: 'Room lobby · no game in progress',
    playing: 'Live room snapshot',
    finished: 'Game finished · final snapshot',
    left: 'Left room · inventory cleared',
    missing: 'Room no longer exists',
    unsupported: 'Room data format not recognized',
    error: 'Room stream failed · rejoin or reload'
  };
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin ||
        event.data?.channel !== CHANNEL) return;
    if (event.data.type === 'language') {
      if (GodfieldLocalization.supported.includes(event.data.language)) {
        gameLanguage = event.data.language;
        render();
      }
      return;
    }
    if (event.data.type !== 'state') return;
    const next = event.data.state;
    if (!next || !Object.hasOwn(statuses, next.status) || !Array.isArray(next.players)) return;
    // The page-to-extension bridge is untrusted. Keep rendering bounded and use
    // textContent exclusively; never treat page text as HTML or executable code.
    if (next.players.length > 9 || next.players.some(p => !p || typeof p.name !== 'string' ||
        p.name.length > 120 || !Array.isArray(p.items) || p.items.length > 64 ||
        p.items.some(i => !i || typeof i !== 'object'))) return;
    state = next;
    render();
  });
  window.postMessage({ channel: CHANNEL, type: 'ready' }, location.origin);
  function mount() {
    if (document.getElementById('godfield-room-inspector')) return;
    const host = document.createElement('div');
    host.id = 'godfield-room-inspector';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; position: fixed; z-index: 2147483647; right: 16px; bottom: 16px;
        color: #34564a; font: 13px/1.45 Meiryo, system-ui, sans-serif; color-scheme: light; }
      * { box-sizing: border-box; } button, select { font: inherit; cursor: pointer; }
      .panel.is-collapsed { width: 250px; }
      .is-collapsed header { border-bottom: 0; padding: 7px 10px; }
      .is-collapsed h2 { font-size: 16px; }
      .panel { width: min(460px, calc(100vw - 32px)); background: #ddffcc;
        border: 3px solid #008f6f; border-radius: 17px; box-shadow: 0 5px 0 #006a5140, 0 10px 32px #003b3b35; overflow: hidden; }
      header { padding: 10px 13px; display: flex; align-items: center; gap: 9px; background: #008f6f;
        color: #eeffee; border-bottom: 2px solid #eeffee; }
      .mark { color: #ddffcc; font-size: 26px; } h2 { font-size: 20px; margin: 0; font-weight: 800; letter-spacing: -.6px; }
      .eyebrow { color: #ddffcc; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
      .toggle { margin-left: auto; background: #eeffee; color: #008f6f; border: 2px solid #ddffcc;
        border-radius: 7px; width: 31px; height: 31px; font-size: 22px; line-height: 1; }
      .toolbar { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #bbedd5; border-bottom: 1px solid #55bb99; }
      .status { margin: 0; flex: 1; font-size: 11px; color: #17604e; }
      select { width: 138px; max-width: 45%; background: #eeffee; color: #00795e; border: 1px solid #008f6f;
        border-radius: 5px; padding: 5px 3px; font-size: 11px; }
      .body { max-height: min(65vh, 620px); overflow-y: auto; padding: 10px 9px 0;
        scrollbar-color: #55bb99 #ddffcc; scrollbar-width: thin; }
      .empty { padding: 23px 12px 30px; color: #487562; }
      details { background: #55bb99; border: 1px solid #008f6f; border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
      summary { cursor: pointer; padding: 8px 11px; color: #eeffee; background: #008f6f; }
      .name { font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
      .stats { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
      .stat { color: #008f6f; background: #eeffee; border-radius: 4px; padding: 1px 8px; font-size: 11px; font-weight: 700; }
      .count { float: right; color: #eeffee; border: 1px solid #95e3bb; border-radius: 12px; padding: 1px 7px; font-size: 10px; }
      ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; list-style: none; margin: 0; padding: 8px; }
      .card { position: relative; min-width: 0; background: #eeffee; border: 1px solid #008f6f; border-radius: 6px;
        box-shadow: 0 2px 0 #008f6f55; padding: 7px 6px 6px; text-align: center; }
      .art { position: relative; width: 64px; height: 64px; margin: 3px auto 4px; }
      .art img { display: block; width: 64px; height: 64px; object-fit: contain; position: relative; }
      .placeholder { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 6px;
        color: #55bb99; background: #ddffcc; font-size: 34px; font-weight: 800; }
      .item-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        font-size: 11px; line-height: 1.4; min-height: 31px; font-weight: 700; overflow-wrap: anywhere; color: #17604e; }
      .id { position: absolute; top: 3px; right: 5px; color: #5e9079; font-size: 9px; }
      .category { color: #658d79; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item-stats { display: flex; justify-content: center; gap: 3px; flex-wrap: wrap; min-height: 17px; margin-top: 2px; }
      .item-stat { font-size: 10px; font-weight: 800; color: #a74667; background: #fff0cf; border-radius: 3px; padding: 0 4px; }
      .unknown .item-name { color: #886b38; } .used .art { opacity: .5; }
      .used-label { position: absolute; top: 4px; left: 4px; color: #886b38; background: #fff0cf; font-size: 9px; padding: 0 3px; border-radius: 3px; }
      .fake { color: #886b38; background: #fff0cf; border-radius: 3px; font-size: 9px; margin-top: 5px; padding: 3px; overflow-wrap: anywhere; }
      .empty-items { grid-column: 1 / -1; padding: 12px; color: #eeffee; font-size: 12px; }
      footer { padding: 8px 12px; background: #008f6f; color: #eeffee; display: flex; gap: 10px; align-items: center; border-top: 2px solid #eeffee; }
      .note { color: #ddffcc; font-size: 10px; flex: 1; } .export { background: #eeffee; color: #008f6f;
        border: 1px solid #ddffcc; border-radius: 5px; padding: 4px 9px; font-size: 11px; font-weight: 700; white-space: nowrap; }
      button:disabled { opacity: .5; cursor: default; } [hidden] { display: none !important; }
      button:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid #ffd567; outline-offset: -3px; }
      .hover-preview { position: fixed; width: min(420px, calc(100vw - 16px)); background: #ddffcc;
        border: 2px solid #008f6f; border-radius: 12px; box-shadow: 0 6px 28px #003b3b55; overflow: hidden; }
      .hover-preview.single-item { width: min(310px, calc(100vw - 16px)); }
      .hover-header { display: flex; gap: 6px; align-items: center; padding: 8px 10px; background: #008f6f; color: #eeffee; }
      .hover-title { flex: 1; overflow-wrap: anywhere; font-size: 13px; }
      .hover-button { border: 1px solid #ddffcc; border-radius: 5px; color: #008f6f; background: #eeffee; padding: 3px 7px; font-size: 11px; }
      .hover-content { overflow-y: auto; max-height: min(65vh, calc(100dvh - 115px)); scrollbar-width: thin; scrollbar-color: #008f6f #ddffcc; }
      .hover-stats { padding: 8px 10px 0; font-size: 11px; color: #008f6f; }
      .hover-hint { padding: 7px 9px; font-size: 9px; color: #17604e; background: #bbedd5; }
      .hover-stale { padding: 6px 10px; color: #886b38; background: #fff0cf; font-size: 11px; }
      .hover-preview .item-name { display: block; -webkit-line-clamp: unset; overflow: visible; }
      .hover-preview .comparison { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); }
      .reveal-label { margin: -7px -6px 6px; padding: 5px 2px; background: #008f6f; color: #eeffee; font-size: 11px; font-weight: 700; }
      .reveal-label.apparent { background: #ddbb77; color: #4f4f4f; }
      .comparison .id { top: 33px; }
      .hover-preview .empty-items { color: #17604e; }
      .card:focus-visible { outline: 3px solid #ffd567; outline-offset: -3px; }
      @media (max-width: 380px) { ul { grid-template-columns: repeat(2, minmax(0, 1fr)); } h2 { font-size: 17px; } }
      @media (max-height: 500px) { .body { max-height: calc(100dvh - 190px); } }
    `;
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const panel = el('section', 'panel is-collapsed');
    panel.setAttribute('aria-label', 'God Field Room Inspector');
    const header = el('header');
    const heading = el('div');
    heading.append(el('div', 'eyebrow', 'Hover names & cards'), el('h2', '', 'Room Inspector'));
    const toggle = el('button', 'toggle', '+');
    toggle.setAttribute('aria-label', 'Expand inspector');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.title = 'Toggle inventory panel (Alt+I)';
    header.append(el('span', 'mark', '◈'), heading, toggle);
    const status = el('p', 'status');
    status.setAttribute('role', 'status');
    const toolbar = el('div', 'toolbar');
    const languageSelect = el('select');
    languageSelect.setAttribute('aria-label', 'Item language');
    const autoOption = el('option', '', 'Auto · game language');
    autoOption.value = 'auto';
    languageSelect.append(autoOption);
    for (const code of GodfieldLocalization.supported) {
      const option = el('option', '', GODFIELD_CATALOG.languages[code].label);
      option.value = code;
      languageSelect.append(option);
    }
    languageSelect.onchange = () => { languageChoice = languageSelect.value; render(); };
    toolbar.append(status, languageSelect);
    const body = el('div', 'body');
    const footer = el('footer');
    const note = el('span', 'note', 'Only data received by this tab.');
    const exportButton = el('button', 'export', 'Save JSON');
    footer.append(note, exportButton);
    panel.append(header, toolbar, body, footer);
    shadow.append(style, panel);
    document.documentElement.append(host);
    let collapsed = true;
    body.hidden = footer.hidden = toolbar.hidden = true;
    const expanded = new Map();
    toggle.onclick = () => {
      collapsed = !collapsed;
      panel.classList.toggle('is-collapsed', collapsed);
      body.hidden = footer.hidden = toolbar.hidden = collapsed;
      toggle.textContent = collapsed ? '+' : '−';
      toggle.setAttribute('aria-label', collapsed ? 'Expand inspector' : 'Collapse inspector');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    };
    document.addEventListener('keydown', event => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyI' && !event.repeat) {
        event.preventDefault();
        toggle.click();
      }
    });
    exportButton.onclick = () => {
      // Explicit, local download. No account identifiers or private room codes.
      const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
      const link = el('a');
      link.href = url;
      link.download = 'godfield-inventory.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const model = id => GodfieldLocalization.item(id, language());
    const renderItem = item => {
      const info = model(item.modelId);
      const validId = Number.isSafeInteger(item.modelId) && item.modelId > 0;
      const name = info?.name ?? (validId ? `Unmapped item #${item.modelId}` : 'Unknown / concealed item');
      const row = el('li', `card${item.used ? ' used' : ''}${info ? '' : ' unknown'}`);
      row.setAttribute('aria-label', name);
      row.append(el('span', 'id', validId ? `#${item.modelId}` : '—'));
      if (item.used) row.append(el('span', 'used-label', 'used'));
      const art = el('div', 'art');
      const placeholder = el('span', 'placeholder', '?');
      placeholder.setAttribute('aria-hidden', 'true');
      art.append(placeholder);
      if (info) {
        const img = el('img');
        img.alt = ''; // The visible name immediately below labels the card.
        img.width = img.height = 64;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.onload = () => { placeholder.hidden = true; };
        img.onerror = () => { img.hidden = true; placeholder.hidden = false; };
        img.src = info.image;
        art.append(img);
      }
      row.append(art, el('span', 'item-name', name));
      if (info) {
        row.append(el('div', 'category', info.categoryLabel));
        const itemStats = el('div', 'item-stats');
        for (const stat of info.stats) itemStats.append(el('span', 'item-stat', stat));
        row.append(itemStats);
      }
      if (Number.isSafeInteger(item.fakeModelId) && item.fakeModelId > 0) {
        row.append(el('div', 'fake', `Displayed as: ${model(item.fakeModelId)?.name ?? `item #${item.fakeModelId}`}`));
      }
      return row;
    };
    const hover = GodfieldHover.create({shadow, renderItem, getState: () => state, language});
    render = () => {
      autoOption.textContent = `Auto · ${GODFIELD_CATALOG.languages[gameLanguage].label}`;
      body.lang = language();
      status.textContent = statuses[state.status] + (state.fromCache ? ' · cached, may be stale' : '');
      status.title = Number.isFinite(state.receivedAt) ? `Received ${new Date(state.receivedAt).toLocaleTimeString()}` : '';
      exportButton.disabled = !state.players.length;
      const scroll = body.scrollTop;
      const focused = shadow.activeElement;
      const focusedPlayer = focused?.dataset?.player;
      body.replaceChildren();
      if (!state.players.length) {
        expanded.clear();
        body.append(el('div', 'empty', state.status === 'unsupported'
          ? 'The site may have changed its room format. No inventory is inferred.'
          : 'Enter a game to see which item IDs the server provides. Missing or concealed IDs appear as unknown.'));
      }
      for (const player of state.players) {
        const key = String(player.id);
        const details = el('details');
        details.open = expanded.get(key) ?? true;
        details.addEventListener('toggle', () => { if (details.isConnected) expanded.set(key, details.open); });
        const summary = el('summary');
        summary.dataset.player = key;
        summary.append(el('span', 'name', player.name || `Player ${key}`),
          el('span', 'count', player.itemsAvailable ? `${player.items.length} ${player.items.length === 1 ? 'item' : 'items'}` : 'Unavailable'));
        const stats = el('div', 'stats');
        for (const key of ['hp', 'mp', 'cp']) if (Number.isSafeInteger(player[key])) {
          const label = key === 'cp' ? GODFIELD_CATALOG.languages[language()].stats.cp : key.toUpperCase();
          stats.append(el('span', 'stat', `${label} ${player[key]}`));
        }
        if (player.dead) stats.append(el('span', 'stat', 'Eliminated'));
        summary.append(stats);
        const list = el('ul');
        list.setAttribute('aria-label', `${player.name || 'Player'} items`);
        if (!player.items.length) list.append(el('li', 'empty-items', player.itemsAvailable ? 'No items.' : 'Inventory was not included in this snapshot.'));
        for (const item of player.items) {
          const row = renderItem(item);
          hover.bindCard(row, item);
          list.append(row);
        }
        details.append(summary, list);
        body.append(details);
      }
      body.scrollTop = scroll;
      hover.update();
      if (focusedPlayer !== undefined) {
        [...body.querySelectorAll('summary')].find(s => s.dataset.player === focusedPlayer)?.focus({ preventScroll: true });
      }
    };
    render();
    setTimeout(() => {
      if (state.status === 'waiting-sdk') {
        status.textContent = 'Game hook not ready · reload after enabling the inspector';
      }
    }, 15000);
  }
  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
