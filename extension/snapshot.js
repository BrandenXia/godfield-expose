(() => {
  'use strict';
  const integer = value => Number.isSafeInteger(value) ? value : null;
  const label = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 120) : fallback;
  // This is intentionally an exact schema adapter, not a recursive search for
  // anything named "items" (events also contain items, and aren't inventories).
  function normalizeRoom(data) {
    if (!data || typeof data !== 'object') {
      return { status: 'unsupported', players: [] };
    }
    // Empty live lobbies omit `game`; users identifies the room document.
    if (data.game === null || (data.game === undefined && Array.isArray(data.users))) {
      return { status: 'lobby', players: [] };
    }
    if (!Array.isArray(data.game?.players)) return { status: 'unsupported', players: [] };
    const players = data.game.players.slice(0, 9).map((player, index) => {
      player = player && typeof player === 'object' ? player : {};
      return {
        id: integer(player.id) ?? index,
        name: label(player.name, `Player ${index + 1}`),
        alias: label(player.alias),
        team: Number.isSafeInteger(player.team) && player.team >= 0 && player.team <= 4 ? player.team : null,
        curses: Array.isArray(player.curses) ? player.curses.filter(curse =>
          ['cold', 'fever', 'hell', 'heaven', 'fog', 'flash', 'dream', 'darkcloud'].includes(curse)).slice(0, 8) : [],
        hp: integer(player.hp), mp: integer(player.mp), cp: integer(player.cp),
        dead: player.dead === true,
        itemsAvailable: Array.isArray(player.items),
        items: Array.isArray(player.items) ? player.items.slice(0, 64).map(item => ({
          id: integer(item?.id),
          modelId: integer(item?.modelId),
          fakeModelId: integer(item?.fakeModelId),
          used: item?.used === true
        })) : []
      };
    });
    return {
      status: data.game.isOver === true ? 'finished' : 'playing',
      updateCount: integer(data.game.updateCount),
      observation: {
        eventsAvailable: Array.isArray(data.game.events),
        truncated: Array.isArray(data.game.events) && data.game.events.length > 256,
        startsGame: Array.isArray(data.game.events) && data.game.events.slice(0, 256).some(e => e?.action === 'startGame'),
        gifts: Array.isArray(data.game.events) ? data.game.events.slice(0, 256).filter(e => e?.action === 'gift').map(e => integer(e.item?.modelId)) : [],
        // A public update timestamp helps distinguish a new version-1 game from
        // a replay of the previous opening. No room or account ID crosses here.
        stamp: Number.isSafeInteger(data.game.updatedAt?.seconds) && Number.isSafeInteger(data.game.updatedAt?.nanoseconds)
          ? data.game.updatedAt.seconds * 1000 + data.game.updatedAt.nanoseconds / 1e6 : null
      },
      players
    };
  }
  const api = Object.freeze({ normalizeRoom });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.defineProperty(window, '__godfieldInspectorSchema', { value: api, configurable: true });
})();
