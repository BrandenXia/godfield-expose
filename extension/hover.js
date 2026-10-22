(() => {
  'use strict';
  function create({ shadow, renderItem, getState, language }) {
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const popup = el('section', 'hover-preview');
    popup.hidden = true;
    popup.setAttribute('role', 'region');
    popup.setAttribute('aria-label', 'Item preview');
    const header = el('div', 'hover-header');
    const title = el('strong', 'hover-title');
    const pin = el('button', 'hover-button', 'Pin');
    pin.setAttribute('aria-label', 'Pin preview');
    const close = el('button', 'hover-button', '×');
    close.setAttribute('aria-label', 'Close preview');
    header.append(title, pin, close);
    const content = el('div', 'hover-content');
    const hint = el('div', 'hover-hint', 'Move here to inspect · Pin to keep open · Esc to close');
    popup.append(header, content, hint);
    shadow.append(popup);
    let active = null, anchor = null, pinned = false, request = 0, hideTimer, showTimer;
    let overPopup = false, frame = 0;
    function cancelHide() { clearTimeout(hideTimer); }
    function hide() {
      clearTimeout(showTimer);
      cancelHide();
      cancelAnimationFrame(frame);
      request++;
      active = anchor = null;
      pinned = false;
      pin.textContent = 'Pin';
      pin.setAttribute('aria-pressed', 'false');
      popup.hidden = true;
    }
    function deferHide() {
      if (!pinned) {
        clearTimeout(showTimer);
        cancelHide();
        hideTimer = setTimeout(() => { if (!overPopup && !popup.contains(shadow.activeElement)) hide(); }, 220);
      }
    }
    function position() {
      if (!anchor?.isConnected || popup.hidden) return;
      const rect = anchor.getBoundingClientRect();
      const box = popup.getBoundingClientRect();
      const gap = 10, margin = 8;
      let left, top;
      if (rect.right + gap + box.width <= innerWidth - margin) {
        left = rect.right + gap; top = rect.top;
      } else if (rect.left - gap - box.width >= margin) {
        left = rect.left - gap - box.width; top = rect.top;
      } else {
        left = rect.left;
        top = rect.bottom + gap + box.height <= innerHeight - margin ? rect.bottom + gap : rect.top - gap - box.height;
      }
      popup.style.left = `${Math.max(margin, Math.min(left, innerWidth - box.width - margin))}px`;
      popup.style.top = `${Math.max(margin, Math.min(top, innerHeight - box.height - margin))}px`;
    }
    function track() {
      if (popup.hidden) return;
      if (!anchor?.isConnected) { hide(); return; }
      position();
      frame = requestAnimationFrame(track);
    }
    function resolve(target) {
      const state = getState();
      if (!['playing', 'finished'].includes(state.status)) return null;
      if (target?.kind === 'player') {
        const player = state.players.find(p => p.id === target.playerId && p.name === target.name);
        return player && { player };
      }
      if (target?.kind === 'item') {
        const item = target.item;
        if (!item || !Number.isSafeInteger(item.id) || !Number.isSafeInteger(item.modelId)) return null;
        // Validate against received data. Identical disguise images never identify
        // a card: its native view supplies the real model and instance ID.
        const owners = state.players.filter(p => p.items.some(i => i.id === item.id &&
          i.modelId === item.modelId && (i.fakeModelId || 0) === (item.fakeModelId || 0)));
        const owner = target.playerId !== undefined ? owners.find(p => p.id === target.playerId) : owners.length === 1 ? owners[0] : null;
        if (target.playerId !== undefined && !owner) return null;
        const match = (owner || owners[0])?.items.find(i => i.id === item.id && i.modelId === item.modelId && (i.fakeModelId || 0) === (item.fakeModelId || 0));
        return match && { item: match, owner, owners };
      }
      return null;
    }
    function paintAnalysis(resolved) {
      const analysis = GodfieldMatchups.analyze(resolved.item, resolved.owner, getState());
      popup.classList.toggle('has-analysis', Boolean(analysis));
      if (!analysis) return;
      const section = el('section', 'matchups');
      section.setAttribute('aria-label', 'Combat matchups');
      content.append(section);
      if (analysis.ambiguous) {
        section.append(el('p', 'matchup-note', 'This card matches more than one hand. Choose its owner to compare opponents.'));
        const select = el('select', 'owner-select');
        select.setAttribute('aria-label', 'Item owner');
        const blank = el('option', '', 'Choose owner…');
        blank.value = ''; select.append(blank);
        for (const p of resolved.owners) {
          const option = el('option', '', `${p.name} · Player ${p.id}`);
          option.value = String(p.id); select.append(option);
        }
        select.onchange = () => { if (select.value !== '') { active = {...active, playerId:Number(select.value)}; paint(); } };
        section.append(select);
        return;
      }
      section.append(el('p', 'matchup-perspective', `Item owner: ${analysis.owner.name || 'Player'}`));
      const focus = GodfieldLocalization.item(resolved.item.modelId, language());
      section.append(el('p', 'matchup-note', [focus.elementLabel, ...(analysis.attack?.notes || []), analysis.availability.text].filter(Boolean).join(' · ')));
      if (analysis.uncertainTeams) section.append(el('p', 'matchup-note', 'Team data unavailable: comparing other players.'));
      for (const {mode, groups} of analysis.sections) {
        const heading = mode === 'defenses' ? 'Possible enemy protection' : 'Enemy attacks to prepare for';
        section.append(el('h3', '', analysis.uncertainTeams ? heading.replace('enemy', 'other players’').replace('Enemy', 'Other players’') : heading));
        if (!groups.length) section.append(el('p', 'matchup-note', 'No active opponents.'));
        for (const {player, rows, unknown, summary} of groups) {
          const group = el('section', 'matchup-group');
          group.append(el('h4', '', player.name || `Player ${player.id}`));
          if (summary) group.append(el('p', 'matchup-summary', summary));
          if (!player.itemsAvailable) group.append(el('p', 'matchup-note', 'Inventory unavailable; threats cannot be ruled out.'));
          else if (!rows.length) group.append(el('p', 'matchup-note', mode === 'defenses' ? 'No compatible protection among revealed items.' : 'No attack items revealed.'));
          const list = el('ul', 'matchup-list');
          for (const row of rows) {
            const info = GodfieldLocalization.item(row.item.modelId, language());
            const li = el('li', `matchup-row ${row.verdict.kind}${row.availability.ready === false ? ' unavailable' : ''}`);
            const img = el('img', 'matchup-art');
            img.alt = ''; img.width = img.height = 32; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
            img.src = info.image; img.onerror = () => { img.hidden = true; };
            const text = el('div', 'matchup-text');
            text.append(el('strong', 'matchup-name', info.name));
            const stats = [info.elementLabel, ...info.stats, row.attack?.support ? 'Attack add-on' : '', info.hitRate ? `${info.hitRate}% base hit rate` : ''].filter(Boolean);
            text.append(el('div', 'matchup-meta', stats.join(' · ')));
            text.append(el('div', 'matchup-verdict', row.verdict.text));
            if (row.availability.text) text.append(el('div', 'matchup-meta', row.availability.text));
            if (mode === 'attacks' && Array.isArray(analysis.owner.curses) && analysis.owner.curses.includes('darkcloud') && info.hitRate) text.append(el('div', 'matchup-verdict', 'Dark Cloud: this attack hits certainly'));
            li.append(img, text); list.append(li);
          }
          group.append(list);
          if (unknown) group.append(el('p', 'matchup-note', `${unknown} concealed or unmapped ${unknown === 1 ? 'item' : 'items'}; more options may exist.`));
          section.append(group);
        }
      }
      section.append(el('p', 'matchup-note matchup-limit', 'Base item comparisons, not a damage forecast. Attack combinations, curses, guardians, and random effects can change the outcome.'));
    }
    function paint() {
      const resolved = resolve(active);
      if (!resolved || !anchor?.isConnected) { hide(); return; }
      const scroll = content.scrollTop;
      content.replaceChildren();
      content.lang = language();
      popup.classList.toggle('single-item', Boolean(resolved.item));
      popup.classList.remove('has-analysis');
      if (resolved.player) {
        const p = resolved.player;
        title.textContent = `${p.name || 'Player'} · ${p.items.length} ${p.items.length === 1 ? 'item' : 'items'}`;
        const stats = el('div', 'hover-stats', ['hp','mp','cp'].filter(k => Number.isSafeInteger(p[k])).map(k => `${k.toUpperCase()} ${p[k]}`).join(' · '));
        content.append(stats);
        const list = el('ul', 'hover-items');
        for (const item of p.items) list.append(renderItem(item));
        if (!p.items.length) list.append(el('li', 'empty-items', p.itemsAvailable ? 'No items.' : 'Inventory was not included in this snapshot.'));
        content.append(list);
      } else {
        const item = resolved.item;
        const disguised = item.fakeModelId > 0;
        title.textContent = disguised ? 'Dream · real item' : 'Item details';
        const list = el('ul', 'hover-items comparison');
        const real = renderItem(item);
        real.querySelector('.fake')?.remove();
        if (disguised) real.prepend(el('div', 'reveal-label', 'Real item'));
        list.append(real);
        if (disguised) {
          const fake = renderItem({modelId:item.fakeModelId});
          fake.prepend(el('div', 'reveal-label apparent', 'Dream appearance'));
          list.append(fake);
        }
        content.append(list);
        paintAnalysis(resolved);
      }
      if (getState().fromCache) content.prepend(el('div', 'hover-stale', 'Cached snapshot · may be stale'));
      popup.hidden = false;
      content.scrollTop = scroll;
      position();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(track);
    }
    function show(target, node) {
      if (pinned) return;
      cancelHide();
      clearTimeout(showTimer);
      active = target;
      anchor = node;
      paint();
    }
    function inspect(node) {
      if (pinned) return;
      cancelHide();
      clearTimeout(showTimer);
      if (anchor === node && active && !popup.hidden) return;
      const token = ++request;
      active = null;
      popup.hidden = true;
      cancelAnimationFrame(frame);
      anchor = node;
      showTimer = setTimeout(() => {
        window.postMessage({channel:'godfield-room-inspector-v1', type:'inspect-target', target:node.dataset.gfiTarget, request:token}, location.origin);
      }, 120);
    }
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin ||
          data?.channel !== 'godfield-room-inspector-v1' || data.type !== 'target' || data.request !== request) return;
      if (!data.target) { hide(); return; }
      show(data.target, anchor);
    });
    const target = node => node instanceof Element ? node.closest('#main [data-gfi-target]') : null;
    document.addEventListener('pointerover', event => {
      const node = target(event.target);
      if (node && !node.contains(event.relatedTarget)) inspect(node);
    }, true);
    document.addEventListener('pointerout', event => {
      const node = target(event.target);
      if (node && !node.contains(event.relatedTarget)) deferHide();
    }, true);
    document.addEventListener('focusin', event => { const node = target(event.target); if (node) inspect(node); }, true);
    document.addEventListener('focusout', event => { if (target(event.target)) deferHide(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, true);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    popup.addEventListener('pointerenter', () => { overPopup = true; cancelHide(); });
    popup.addEventListener('pointerleave', () => { overPopup = false; deferHide(); });
    popup.addEventListener('focusin', cancelHide);
    popup.addEventListener('focusout', deferHide);
    pin.onclick = () => {
      pinned = !pinned;
      pin.textContent = pinned ? 'Pinned' : 'Pin';
      pin.setAttribute('aria-pressed', String(pinned));
      if (pinned) cancelHide();
    };
    close.onclick = hide;
    function bindCard(node, item, playerId) {
      node.tabIndex = 0;
      if (active?.panel && active.playerId === playerId && active.item.id === item.id &&
          active.item.modelId === item.modelId && !anchor?.isConnected) anchor = node;
      const enter = () => {
        if (pinned) return;
        request++;
        clearTimeout(showTimer);
        cancelHide();
        showTimer = setTimeout(() => show({kind:'item',item,playerId,panel:true}, node), 160);
      };
      node.addEventListener('pointerenter', enter);
      node.addEventListener('pointerleave', deferHide);
      node.addEventListener('focusin', enter);
      node.addEventListener('focusout', deferHide);
    }
    return {
      bindCard,
      update() { if (active) paint(); },
      hide
    };
  }
  globalThis.GodfieldHover = Object.freeze({ create });
})();
