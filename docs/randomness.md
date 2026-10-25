# Random generation and seed recovery

Investigated October 25, 2026. Objective: recover the generator's seed/state and predict an outcome before the server delivers it.

**No seed was recovered and no next-result predictor was established.** We identified the published gift distribution, traced the client/server boundary, and tested a bounded family of weak timestamp-seeded generators. The evidence does not establish that God Field's server RNG is cryptographically secure or fundamentally unpredictable.

## Evidence and source pins

Primary sources are the current [compiled client](https://godfield.net/main.dart.js), [English catalog](https://godfield.net/i18n/en.json), and four fresh, isolated Training starts. No human room was joined and no combat command was submitted. Temporary experiment identities were deleted afterward.

The client and catalog still match the earlier investigation:

- Client SHA-256: `764a50524e4b6b3f510415da7128abd8ad99dcb87b45b8572d98ddd96889cabd`.
- English catalog SHA-256: `bb1b433ba6d336765589aec940cca0bac8b7c0bdcee33969c207a17365509188`.

Recorded evidence:

- [Preliminary two-deal probe](research/randomness-probe-initial-2026-10-25.json).
- [Two-deal probe with request, server-update, and receipt timestamps](research/randomness-probe-2026-10-25.json).
- [Offline audit and seed-search results](research/randomness-audit-2026-10-25.json).

These records retain item model IDs, event order, field names, timestamps, and request endpoint/field names. They omit authentication tokens, account IDs, room IDs, and player names. Field names such as `users[].id` describe the schema; their values are not recorded. The recorded hands are snapshots, not an inferred sequence of random draws. A zero model ID is not treated as a known gift.

## Where random outcomes are decided

There are two literal `Math.random()` sites in the inspected game bundle:

| Client location | Observed purpose | Relevance to predicting outcomes |
| --- | --- | --- |
| `A.e2`, line 429 | Dart object identity hash codes | Not a dealt item or hit roll. |
| `A.mM.lr`, lines 8265–8267 | Bounded integer helper | The sole located `.lr(...)` call, line 9525, selects an initial opponent when an attack card is selected and no valid enemy target is selected. |

The second site runs in the selection path (`ip`). It is not the gift generator and is not evidence that fog, bounce, or dangerous-weapon outcomes are rolled locally. The ordinary command path can submit the selected target, but the server's resolution is a separate step.

The Training start handler calls `start-game` through `A.H.lA`/`A.cS` (lines 14899–14909 and 4322–4341). It sends `mode`, `roomId`, `lang`, `playerCount`, and `gf`; no seed field was observed. Ordinary actions use `submit-command` (lines 9575–9645), with selected item IDs and optional target/resource choices. The client receives room state over Firestore, deserializes already-created items and events (`tk`/`tl`), and animates `gift`, `hit`, and `miss` events (lines 10501, 10930, and 10956).

No seed, RNG state, raw random number stream, deck order, or future-gift queue was identified in the inspected code paths or the observed Training room schemas. This statement covers the fields and game states examined, not every possible server response. The seed could still depend on hidden server state, time, identifiers, or another source. Server source code and RNG initialization were not available for this audit.

### Controlled browser RNG experiment

The probe fixes direct calls from `main.dart.js` to `Math.random()` at `0.125` while leaving Firebase and other SDK calls unchanged. It observes the game's existing subscription without adding a database listener. Each trial uses a fresh browser context and starts one two-player Training battle through the normal UI.

All four trials produced different received gift sequences. In the final two trials, 385 and 380 controlled calls were recorded, all at the identity-hash site on line 429. The two initial gift-event sequences were:

```text
21, 191, 195, 30, 191, 50, 165, 32, 10
191, 26, 200, 57, 70, 29, 192, 118, 123
```

This demonstrates that those received gifts are not determined solely by the controlled browser `Math.random()` outputs. It does not eliminate browser time, account-specific inputs, server seeds, or unobserved RNG mechanisms. Together with the command/event paths, it points the seed-recovery investigation toward the server.

## Timestamp-seed recovery attempt

We tested five explicit generator/output variants: Numerical Recipes 32-bit LCG, ANSI 31-bit LCG, ANSI high-15-bit output, MSVC high-15-bit output, and Java Random's 48-bit LCG with next-32-bit output. These were candidate models, not identified server implementations.

For each of the final two Training starts, the search:

1. Uses every integer epoch-millisecond seed between the earliest observed start/update/receipt timestamp minus five seconds and the latest timestamp plus five seconds; also tries integer epoch-second seeds over that interval.
2. Advances 0–32 outputs before the first observed gift.
3. Maps one generator output to a ticket in `[0, 500)` using either floor scaling or modulo, then assigns a model using catalog-order cumulative gift weights.
4. Fits the first six ordered `gift` events and reserves the final three as a within-deal holdout.

| Trial | Seed/generator/mapping/skip combinations checked | First-six matches | Holdout matches |
| --- | ---: | ---: | ---: |
| 1 | 3,481,500 | 0 | 0 |
| 2 | 3,437,610 | 0 | 0 |
| Total | 6,919,110 | 0 | 0 |

The last three outcomes were never used to fit a seed, but with no first-six match there was no candidate to validate. This is not a successful prediction test.

These results reject only the exact models and bounds searched. They do **not** reject timestamp seeding in general. Examples outside the search include earlier process/account/room seeding, different time resolution or mixing, V8's default RNG, Mersenne Twister, different item interval ordering, rejection sampling, multiple outputs per gift, and extra calls interleaved between gifts. The event sequence is not proof of contiguous underlying RNG calls; initial deals for other players and other randomized effects can consume hidden outputs. Different Cloud Function invocations may also use different process-local generators.

The search implementation is checked against synthetic sequences with known seeds and skipped outputs for all five variants. It recovers the known candidates and rejects a deliberately changed holdout. That verifies the experiment code, not its applicability to God Field.

## Known probability structure

The catalog has 296 models, of which 237 have positive `giftRate`. The weights sum to **500**. The client accumulates the weights in `ty` and displays each as `weight / 500` in `A.im.ji` (lines 3963–3970 and 14857–14865).

| Gift category | Total weight | Published-pool share |
| --- | ---: | ---: |
| Weapons | 181 | 36.2% |
| Armor | 147 | 29.4% |
| Sundries | 82 | 16.4% |
| Trade | 60 | 12.0% |
| Miracles | 30 | 6.0% |

Exchange, Sell, and Buy each have weight 20 (4%); God Sword, Torch, and each ordinary miracle have weight 1 (0.2%). These are distribution weights, not a 500-card deck or proof of independent draws. Initial deals, special gift mechanisms, and state-dependent restrictions require separate verification.

If ordinary gifts were independent draws from exactly this distribution, consecutive equal models would occur with probability **1.2696%**, and a batch of nine would contain at least one duplicate with probability **36.13%**. Those are exact calculations under an explicitly hypothetical IID model, not observed rates. Repeats alone would therefore be weak evidence of a broken seed. The same model yields about 7.10 bits of information per revealed item; an item ID is a coarse category, not a raw 32-bit RNG output.

The official reference also publishes state-dependent chances: disease progression, guardian activation/departure, Dream disguises, and post-Apocalypse devil appearances. Pooling those events with gifts or treating guaranteed Dark Cloud hits as ordinary chance trials would invalidate a generic randomness test.

## What would establish next-result prediction

Seed recovery needs a justified generator/output model plus a known mapping from observed events to RNG calls. We currently have neither for the server. More isolated screenshots or unordered hands cannot supply the missing call order.

A useful next dataset would passively retain contiguous room versions, ordered causal events, game boundaries, timestamps, and relevant game state during ordinary play, while explicitly marking cached/repeated/missed updates. Initial gifts, later gifts, conditional hit rolls, guardians, and redirected targets must remain separate. The extension's current JSON export is a single normalized snapshot and omits the event history; it is not sufficient for this analysis.

Any recovered candidate must commit to predictions **before** later server updates arrive. Measure those on a fresh held-out sequence against the published-weight baseline, including every failure and discontinuity. Fitting an old sequence, or repeatedly changing the generator until it fits, is not evidence of predictive capability. No predictor was added to the extension on the basis of this investigation.

## Reproduce

Download the public sources, then run the offline checks and replay the recorded seed search:

```sh
curl -fsSL https://godfield.net/main.dart.js -o /tmp/godfield-random-main.dart.js
curl -fsSL https://godfield.net/i18n/en.json -o /tmp/godfield-random-en.json
python3 tests/randomness_audit_test.py
python3 scripts/randomness-audit.py /tmp/godfield-random-en.json \
  --client /tmp/godfield-random-main.dart.js \
  --probe docs/research/randomness-probe-2026-10-25.json
```

The first two commands download public sources. Compare the printed fingerprints before interpreting a rerun; source changes may invalidate the model and current captures. The checker rejects a client/probe fingerprint mismatch.

The following separate opt-in command creates exactly two fresh Training sessions, observes their initial snapshots, and deletes its temporary authentication identities. It does not run in CI or ordinary tests:

```sh
node scripts/randomness-probe.cjs --live-training
```

It writes sanitized local observations to `test-results/randomness-probe.json`. The published captures above were manually reviewed for absence of identity/room/token values before inclusion.
