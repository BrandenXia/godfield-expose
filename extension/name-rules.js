(() => {
  'use strict';
  const defaults = `// First matching rule sets the name color. All matches add badges.
has("升天弓") => #b13978 "{item}"
has("太阳守护") => #986200 "{item}"
has("Super Mirror") => #6554ad "{item}"
has("God Shield") => #16669a "{item}"
def == 0 => #b53535 "DEF 0"
hp <= 10 => #b53535 "HP {hp}"`;
  const names = new Map();
  const normalize = name => name.normalize('NFKC').trim().toLowerCase();
  for (const locale of Object.values(GODFIELD_CATALOG.languages)) locale.names.forEach((name, index) => {
    const key = normalize(name);
    if (!names.has(key)) names.set(key, new Set());
    names.get(key).add(index + 1);
  });
  const fields = ['def', 'hp', 'mp', 'cp', 'items'];
  function compile(source) {
    const rules = [], errors = [];
    if (typeof source !== 'string' || source.length > 12000) return {rules, errors:['Rules must be at most 12,000 characters.']};
    for (const [index, raw] of source.split(/\r?\n/).entries()) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      try {
        if (rules.length >= 32) throw Error('At most 32 rules are allowed.');
        if (line.length > 600) throw Error('Rule is longer than 600 characters.');
        const tokens = line.match(/"(?:[^"\\]|\\.)*"|=>|==|!=|<=|>=|[<>(),]|#[\da-fA-F]+|\d+|[a-zA-Z_]+|\S/g) || [];
        let pos = 0;
        const take = expected => {
          const token = tokens[pos++];
          if (expected && token !== expected) throw Error(`Expected ${expected}.`);
          return token;
        };
        function expression(depth = 0) {
          if (depth > 12) throw Error('Too many nested conditions.');
          let node = conjunction(depth + 1);
          while (tokens[pos] === 'or') { take(); node = {op:'or', left:node, right:conjunction(depth + 1)}; }
          return node;
        }
        function conjunction(depth) {
          let node = atom(depth);
          while (tokens[pos] === 'and') { take(); node = {op:'and', left:node, right:atom(depth)}; }
          return node;
        }
        function atom(depth) {
          if (depth > 12) throw Error('Too many nested conditions.');
          const token = take();
          if (token === 'not') return {op:'not', child:atom(depth + 1)};
          if (token === '(') { const node = expression(depth + 1); take(')'); return node; }
          if (token === 'has') {
            take('(');
            const value = take();
            let id;
            if (/^\d+$/.test(value || '')) id = Number(value);
            else {
              const name = JSON.parse(value);
              if (typeof name !== 'string') throw Error('Use an item name in double quotes or a numeric ID.');
              const matches = names.get(normalize(name));
              if (!matches?.size) throw Error(`Unknown item: ${name}.`);
              if (matches.size > 1) throw Error(`Ambiguous item name: ${name}. Use its numeric ID.`);
              id = [...matches][0];
            }
            if (!Number.isSafeInteger(id) || !GODFIELD_CATALOG.models[id - 1]) throw Error('Unknown item ID.');
            take(')');
            return {op:'has', id};
          }
          if (!fields.includes(token)) throw Error('Use has("item"), def, hp, mp, cp, or items.');
          const compare = take(), value = take();
          if (!['==','!=','<=','>=','<','>'].includes(compare) || !/^\d+$/.test(value || '') || Number(value) > 99999) {
            throw Error('Use a comparison such as def == 0 or hp <= 10.');
          }
          return {op:'compare', field:token, compare, value:Number(value)};
        }
        const condition = expression();
        take('=>');
        const color = take();
        if (!/^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(color || '')) throw Error('Use a hex color such as #b53535.');
        const label = JSON.parse(take());
        if (typeof label !== 'string' || !label.trim() || label.length > 80) throw Error('Use a quoted label of 1–80 characters.');
        if (tokens[pos] !== undefined) throw Error('Unexpected text after label.');
        if (/[\r\n\t]/.test(label)) throw Error('Labels must be on one line.');
        if (/\{(?!item\}|def\}|hp\}|mp\}|cp\}|items\})/.test(label)) throw Error('Unknown label placeholder.');
        rules.push({condition, color, label, line:index + 1});
      } catch (error) {
        errors.push(`Line ${index + 1}: ${error instanceof SyntaxError ? 'Invalid quoted text or incomplete rule.' : error.message}`);
      }
    }
    return {rules:errors.length ? [] : rules, errors};
  }
  function evaluate(rules, player, language) {
    if (player.dead) return [];
    const inventory = Array.isArray(player.items) ? player.items : [];
    const known = inventory.filter(i => Number.isSafeInteger(i.modelId) && GODFIELD_CATALOG.models[i.modelId - 1]);
    const complete = player.itemsAvailable === true && known.length === inventory.length;
    const values = {def:complete ? known.reduce((sum, i) => sum + (GODFIELD_CATALOG.models[i.modelId - 1].def || 0), 0) : null,
      items:player.itemsAvailable === true ? inventory.length : null};
    for (const field of ['hp','mp','cp']) values[field] = Number.isSafeInteger(player[field]) ? player[field] : null;
    function test(node) {
      if (node.op === 'has') {
        const found = player.itemsAvailable === true && known.some(i => i.modelId === node.id);
        return {value:found ? true : complete ? false : null, ids:found ? [node.id] : []};
      }
      if (node.op === 'compare') {
        const a = values[node.field], b = node.value;
        return {value:a === null ? null : ({'==':a===b,'!=':a!==b,'<':a<b,'<=':a<=b,'>':a>b,'>=':a>=b})[node.compare], ids:[]};
      }
      const a = test(node.child || node.left);
      if (node.op === 'not') return {value:a.value === null ? null : !a.value, ids:[]};
      const b = test(node.right);
      const value = node.op === 'and'
        ? a.value === false || b.value === false ? false : a.value === null || b.value === null ? null : true
        : a.value === true || b.value === true ? true : a.value === null || b.value === null ? null : false;
      return {value, ids:[...(a.value === true ? a.ids : []), ...(b.value === true ? b.ids : [])]};
    }
    const result = [], seen = new Set();
    for (const rule of rules) {
      const match = test(rule.condition);
      if (match.value !== true) continue;
      const item = [...new Set(match.ids)].map(id => GodfieldLocalization.item(id, language)?.name || `#${id}`).join(' / ');
      const text = rule.label.replace(/\{(item|def|hp|mp|cp|items)\}/g, (_, key) => key === 'item' ? item : values[key] ?? '?').slice(0, 180);
      if (!text.trim() || seen.has(text)) continue;
      seen.add(text);
      result.push({color:rule.color, text});
    }
    return result;
  }
  globalThis.GodfieldNameRules = Object.freeze({defaults, compile, evaluate});
})();
