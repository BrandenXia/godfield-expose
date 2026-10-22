# Room inventory investigation

Investigated October 20, 2026. Opponent inventories were confirmed in Training and a controlled two-player private room. Ranked duels and larger rooms were not tested.

## Client data path

Sources: [page and Firebase bridge](https://godfield.net/), [compiled client](https://godfield.net/main.dart.js), and [English item catalog](https://godfield.net/i18n/en.json).

The page exposes modular Firebase functions through `window.firebase`. The Dart client registers an `onSnapshot` listener on `modes/{mode}/rooms/{roomId}` and deserializes:

```text
room.game.players[]
  id, name, alias, hp, mp, cp, dead
  items[]
    id, modelId, fakeModelId, used
room.game.updateCount
room.game.isOver
```

Relevant symbols in the inspected build:

| Symbol | Role |
| --- | --- |
| `pl` | Registers the Firestore listener. |
| `H.iX` | Constructs the shared room document path. |
| `u4`, `tk`, `tL` | Deserialize the room, game, and players. |
| `kY` | Reads item instance, real model, fake model, and used state. |
| `ty` | Assigns model IDs from one-based catalog positions. |
| `ba.gL` | Uses a positive `fakeModelId` for presentation instead of `modelId`. |

Build fingerprints (SHA-256):

- `main.dart.js`: `764a50524e4b6b3f510415da7128abd8ad99dcb87b45b8572d98ddd96889cabd`
- `i18n/en.json`: `bb1b433ba6d336765589aec940cca0bac8b7c0bdcee33969c207a17365509188`

## Controlled observations

In Training, a test player and the opposing bot each had nine positive real model IDs in a non-cached initial room snapshot.

In a private room, two independent browser profiles signed in as test identities, selected Solo, and started a battle. Each client received a non-cached snapshot at update 1 containing the same two players and nine real item IDs per player. The test compared both normalized player arrays for deep equality and checked that all real model IDs were positive. The extension displayed both hands.

Raw room captures, browser profiles, account identifiers, and room passwords are excluded from this repository. Reusable automated tests use deterministic local fixtures and do not join live games.

## Extension behavior and limits

The extension observes the game's existing room subscription and passes the original snapshot object to the original callback. It makes no additional database reads or writes. It copies the fields needed for the display while omitting account IDs, room codes, chat, and unrelated documents. Leaving a room clears the display; JSON export occurs only when explicitly requested.

The panel receives a normalized snapshot through a same-window message. The page can forge that message, so the panel is a convenience display rather than an authenticated evidence channel. Text rendering uses `textContent` and bounded collections.

Version 0.2.0 bundles 296 official item names in eight languages. It observes the catalog URL requested by the game to follow the selected language. Item artwork loads from God Field's public image URLs. Missing or zero IDs stay unknown, and IDs outside the bundled catalog are labeled unmapped. Cached snapshots carry a stale-data label.

The implementation depends on the current `window.firebase` bridge and room schema. Site updates may break it. The source data model alone is insufficient to prove exposure in an untested mode; the server could omit or replace IDs before delivery.

## Native hover verification (October 22, 2026)

Version 0.3.0 associates native player tags and item cards with the Dart view objects retained by their event callbacks. The adapter reads own data fields without invoking the callbacks or getters. Listener registration still receives its original arguments. Player views supply the game-local player ID and name; item views supply the item instance ID, real model ID, and apparent model ID. The isolated UI validates these fields against the current normalized room snapshot before displaying a preview.

In a live Training game, hovering the opposing bot’s native name tag displayed its nine-item hand. Hovering a native card displayed its matching real item. No human room was joined for this check. A natural dream event was not observed in that live game.

Deterministic browser fixtures use the observed Dart callback/view structure to test dream previews: two native cards have the same apparent model but different real models, and each preview shows the correct real item. The tests also cover duplicate player names, reordered cards, item updates, absent/stale items, node removal, room exit, keyboard navigation, pinning, and unchanged game click handling. These fixtures establish adapter/UI behavior rather than exposure in additional game modes.

Native hover support depends on the current compiled client’s field layout. If that layout changes, the full inventory panel remains the fallback. Browser profiles and diagnostic traces from the live check are not published.

## Confidentiality implication

In the tested private mode, both clients receive the same stored player array, including opponents' real model IDs. Keeping those items secret requires omitting them from shared participant-readable data; hiding them in the UI does not remove data already delivered to a client.
