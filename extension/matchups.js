(() => {
  'use strict';
  const model = item => Number.isSafeInteger(item?.modelId) && item.modelId > 0
    ? GODFIELD_CATALOG.models[item.modelId - 1] : null;
  const specials = new Set(['bounceWeapon', 'reflectWeapon', 'blockWeapon', 'bounceMiracle', 'reflectMiracle', 'blockMiracle', 'reflectAnything']);
  const counters = new Set(['counterAtk', 'counter2xAtk', 'counterCurse', 'counterBoost2xMP', 'counterTakeCP']);
  const cursed = (player, curse) => Array.isArray(player?.curses) && player.curses.includes(curse);
  function attack(item, player) {
    const m = model(item);
    if (!m) return null;
    const support = !['weapons', 'miracles'].includes(m.category) && m.isPlusAtk || ['doubleAtk', 'attackEveryEnemy', 'setElement'].includes(m.ability) && !m.atk;
    if (!support && !(m.category === 'weapons' || m.category === 'miracles' && (m.atk > 0 || m.ability === 'addCurse'))) return null;
    const atk = m.ability === 'atkBy2xMP' ? (Number.isSafeInteger(player?.mp) ? Math.max(0, player.mp) * 2 : null) : m.atk || 0;
    const notes = [];
    if (support) notes.push('Attack add-on; needs a base weapon');
    else if (m.isPlusAtk) notes.push('Can also add to a weapon attack');
    if (m.hitRate) notes.push(`${m.hitRate}% base hit rate`);
    if (m.ability === 'attackTwice') notes.push('Attacks twice; comparison is per hit');
    if (m.ability === 'attackDyingly') notes.push('Ascension changes ATK and hit rate');
    if (m.ability === 'danger') notes.push('Random target; Dangerous Mortar changes damage');
    if (m.ability === 'atkBy2xMP') notes.push('Consumes all MP; ATK uses current MP');
    if (m.ability === 'addCurse') notes.push('Status attack; DEF alone does not stop it');
    return { model: m, atk, support: Boolean(support), notes };
  }
  function protection(item) {
    const m = model(item);
    return m && (m.def > 0 || specials.has(m.ability) || counters.has(m.ability) || m.ability === 'filterAtkElement') ? m : null;
  }
  function availability(item, player, defending = false) {
    const m = model(item);
    if (!m?.cost) return { ready: true, text: '' };
    if (!Number.isSafeInteger(player?.mp)) return { ready: null, text: `Needs ${m.cost} MP; MP unknown` };
    if (player.mp >= m.cost) return { ready: true, text: `Costs ${m.cost} MP` };
    const waiver = player.items.some(i => model(i)?.ability === 'cutCost');
    if (waiver && !(defending && cursed(player, 'flash'))) return { ready: null, text: 'Needs a cost-waiver item' };
    return { ready: false, text: `Needs ${m.cost} MP; has ${player.mp}` };
  }
  function compatible(element, defense) {
    if (element === 'light') return false;
    const opposite = { fire: 'water', water: 'fire', wood: 'stone', stone: 'wood' }[element];
    return !opposite || defense === opposite || defense === 'light';
  }
  function compare(atkItem, defItem, attacker, defender) {
    const a = attack(atkItem, attacker), d = protection(defItem);
    if (!a || !d) return null;
    const result = (kind, text, def = 0) => ({ kind, text, def });
    if (a.support) return result('conditional', 'Combination dependent');
    const ability = d.ability || '';
    const applies = ability === 'reflectAnything' ||
      a.model.category === 'weapons' && !a.model.element && /^(bounce|reflect|block)Weapon$/.test(ability) ||
      a.model.category === 'miracles' && /^(bounce|reflect|block)Miracle$/.test(ability);
    if (applies) return result('full', ability.startsWith('reflect') ? 'Reflects the attack' : ability.startsWith('bounce') ? 'Bounces to a random target' : 'Blocks the attack');
    if (!a.atk && a.model.ability !== 'atkBy2xMP') return result('bypass', 'Does not stop this status attack');
    if (ability === 'filterAtkElement') return result('filter', cursed(defender, 'flash')
      ? 'Removes element; Flash prevents adding defense' : 'Removes element; combine with another defense');
    if (!compatible(a.model.element, d.element)) return result('bypass', a.model.element === 'light' ? 'Light bypasses ordinary defense' : 'Incompatible defense element');
    if (counters.has(ability)) {
      const effect = {counterAtk: 'Counterattack for damage taken', counter2xAtk: 'Counterattack for 2× damage taken',
        counterCurse: `Counters with ${d.curse || 'a curse'}`, counterBoost2xMP: 'Gain 2× damage taken as MP',
        counterTakeCP: 'Take money equal to damage taken'}[ability];
      return result('counter', `${effect}; does not block`);
    }
    if (!d.def) return result('bypass', 'Special effect does not apply');
    if (a.atk === null) return result('conditional', `DEF ${d.def}; attack strength unknown`, d.def);
    const remaining = Math.max(0, a.atk - d.def);
    return result(remaining ? 'partial' : 'full', remaining
      ? a.model.element === 'darkness' ? `DEF ${d.def}; darkness gets through → HP 0` : `DEF ${d.def}; ${remaining} ATK gets through`
      : `DEF ${d.def}; covers ATK ${a.atk}`, d.def);
  }
  function analyze(item, owner, state) {
    const a = attack(item, owner), d = protection(item);
    if (!a && !d) return null;
    if (!owner) return { ambiguous: true, sections: [] };
    const others = state.players.filter(p => p.id !== owner.id && !p.dead &&
      !(owner.team > 0 && p.team === owner.team));
    const uncertainTeams = owner.team == null || others.some(p => p.team == null);
    const sections = [];
    for (const mode of [...(a ? ['defenses'] : []), ...(d ? ['attacks'] : [])]) {
      const groups = others.map(player => {
        const rows = player.items.flatMap(other => {
          const verdict = mode === 'defenses' ? compare(item, other, owner, player) : compare(other, item, player, owner);
          if (!verdict || mode === 'defenses' && verdict.kind === 'bypass') return [];
          return [{ item: other, verdict, availability: availability(other, player, mode === 'defenses'),
            attack: mode === 'attacks' ? attack(other, player) : null }];
        });
        // Performed miracles remain usable. `used` does not mean consumed.
        rows.sort((x, y) => (x.availability.ready === false) - (y.availability.ready === false) ||
          (mode === 'attacks' ? (y.attack?.atk || 0) - (x.attack?.atk || 0) : (y.verdict.kind === 'full') - (x.verdict.kind === 'full')));
        const unknown = player.items.filter(i => !model(i)).length;
        let summary = '';
        if (mode === 'defenses' && !a.support && a.atk !== null && a.atk > 0) {
          const ready = rows.filter(r => r.availability.ready === true);
          const defs = ready.map(r => r.verdict.def);
          const total = cursed(player, 'flash') ? Math.max(0, ...defs) : defs.reduce((sum, value) => sum + value, 0);
          summary = `${cursed(player, 'flash') ? 'Flash: best single' : 'Combined compatible'} DEF ${total} vs ATK ${a.atk}`;
          if (ready.some(r => r.verdict.kind === 'full' && !r.verdict.def)) summary += ' · special protection available';
        }
        return { player, rows, unknown, summary };
      });
      sections.push({ mode, groups });
    }
    return { owner, attack: a, defense: d, sections, uncertainTeams,
      availability: availability(item, owner, !a) };
  }
  globalThis.GodfieldMatchups = Object.freeze({ attack, protection, compare, analyze, availability });
})();
