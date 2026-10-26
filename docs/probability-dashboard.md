# Bayesian probability dashboard

Click the **chart icon on the right edge** of God Field, or open the inspector with **+** / **Alt+I** and select **Odds**. The dashboard docks inside the game tab. Both the extension and userscript include it.

Use its icon tabs for **Gift odds**, **Event chance**, and **Settings**. Gift odds include original item artwork and translated names; missing artwork shows a question mark beside the name. Settings contains the pool, prior strength, horizon, clear/export buttons, and detailed observation-quality counters. Close with **×** or **Esc** to return to the small edge icon. Arrow Up/Down and Home/End navigate the tabs when a tab has keyboard focus. The game remains clickable outside the sidebar; on narrow screens the drawer uses most of the viewport.

## What it predicts

- Ranked next-gift probabilities for the 237 models with positive published gift weights.
- A tracked item's next-gift probability, 95% credible range for its rate, expected count, and probability of at least one occurrence in the next 1–100 gifts.
- Next-gift category probabilities.
- A separate, manually entered yes/no event estimate for comparable hit, activation, or other trials.

Item names follow the inspector's language. Search accepts names in any of the eight bundled languages or a model ID. Dashboard controls remain in English.

These are probability forecasts under an explicit statistical model. No seed has been recovered, and the dashboard does not identify a deterministic next card. See the [seed-recovery investigation](randomness.md).

## Gift model

The official catalog assigns positive `giftRate` weights to 237 of 296 items, totaling 500. Let `w_i` be an item's weight, `S` the chosen prior strength, `c_i` its observed count, and `n` the sum of counts in the selected pool:

```text
Prior parameter:          α_i = S × w_i / 500
Posterior parameter:      a_i = α_i + c_i
Total posterior strength: A = S + n
Next-gift probability:    a_i / A
```

The default `S = 500` makes each prior parameter equal to its published weight. This is a modeling choice, not 500 observed server draws. Lower strength lets observations move estimates faster; higher strength keeps them closer to the published distribution. The editor accepts 10–10,000 equivalent gifts. With no observations, the table shows the published distribution for every strength.

The marginal rate for item `i` has a `Beta(a_i, A − a_i)` posterior. The credible range uses its 2.5th and 97.5th percentiles. This describes uncertainty about the rate under the model; it does not mean the next draw has a 95% chance of being that item.

For a horizon of `N` gifts and `b_i = A − a_i`:

```text
P(at least one) = 1 − ∏[k=0…N−1] (b_i + k) / (A + k)
Expected count = N × a_i / A
```

This integrates uncertainty about the rate, rather than treating the posterior mean as a known fixed rate. Categories sum the item posterior probabilities.

The model assumes exchangeable draws with stable probabilities within the selected pool. Observations cannot establish independence, and a sparse or selectively visible sample can bias estimates. Published weights alone do not establish every server selection mechanism. Zero-weight and unmapped models are excluded rather than assigned invented probabilities.

## Which observations count

The collector reads explicit `gift` events from the existing room listener. It adds no game subscription, request, or command and never reconstructs draws from inventory changes or trades.

**Opening gifts** are gift events in version 1 with a `startGame` event. **Later gifts** are accepted gift events in subsequent updates. The pools stay separate. Later gifts can mix state-dependent mechanisms; the estimate is for that observed mixture, not a particular action's guaranteed distribution. Even opening events may cover only part of a deal: the live Training check supplied nine gift events despite exposing two players' hands.

Only uncached, committed snapshots count. An initial mid-game snapshot establishes a baseline without counting its events. Subsequent versions must be consecutive; a gap's batch is skipped and becomes the new baseline. Old versions cannot rewind the cursor. Repeated versions do not add observations, and conflicting repeated versions are reported. Missing or oversized event batches and invalid item models are excluded. The dashboard exposes skipped baselines, gaps, conflicts, and invalid observations alongside the counted sample size.

A version-1 opening with an advancing server timestamp identifies a new game on the same subscription. Without comparable timestamps, the collector requires a room/game transition before accepting a reset. Counts can accumulate over games on the same subscription; a new subscription resets them. The displayed game count means observed opening batches, not every game entered.

## Manual event calculator

Enter a prior chance, its equivalent trial count, successes, and failures. For prior probability `p`, strength `T`, successes `s`, and failures `f`:

```text
a = p × T + s
b = (1 − p) × T + f
Next-trial estimate = a / (a + b)
```

For example, a 50% prior with strength 20 and eight successes/two failures gives 60%, with a Beta credible range. It does not give the raw sample's 80%, because the prior contributes evidence.

These trials are **not automatically collected**. Keep trials with different base hit rates or conditions separate; guaranteed hits and conditional abilities should not be pooled indiscriminately. Editing these inputs changes only the manual estimate, not gift counts.

## Storage and export

Observation counts stay in memory in the game tab. Reloading or accepting a new room subscription resets them. **Clear observations** clears both gift pools and quality counters while preserving the deduplication cursor, so replaying the current snapshot does not count it again. Closing and reopening the sidebar retains the tab's counts and manual inputs. Collection continues while it is closed. Reloading the game removes the old sidebar and starts a fresh collector; saved preferences remain.

The selected pool, prior strength, tracked item, and horizon persist in local browser storage. Manual trials are kept only in memory. **Export estimates** downloads JSON containing settings, aggregate model-ID counts, quality counters, subscription/version cursors, manual inputs, and estimated probabilities. It contains no player names, account IDs, room IDs, authentication tokens, or raw room snapshots. There is no automatic upload.

## Verification and source pins

Rechecked October 26, 2026 against the [official client](https://godfield.net/main.dart.js) and [English catalog](https://godfield.net/i18n/en.json), with all eight official catalogs refreshed:

- Client SHA-256: `764a50524e4b6b3f510415da7128abd8ad99dcb87b45b8572d98ddd96889cabd`.
- English catalog SHA-256: `bb1b433ba6d336765589aec940cca0bac8b7c0bdcee33969c207a17365509188`.
- The client's `A.ft.fs` update handler (line 12329 onward in this build) ignores old versions and processes event batches on consecutive updates, reconstructing state after gaps. The collector follows a similarly conservative version boundary.

Unit tests cover posterior normalization and shrinkage, analytic Beta quantiles, posterior-predictive horizons, manual conjugate updates, cache/pending-write exclusion, deduplication, version regression, gaps, resets, and sanitized event extraction. Browser fixtures cover both builds, translated search, controls, export, icon tabs and keyboard navigation, artwork/fallback, game click passthrough, collection while closed, saved settings, and portrait/landscape layouts. A fresh live Training opening counted nine gifts, one opening, and no update gaps; no combat commands were submitted. This is an integration check, not evidence that forecasts are calibrated or that a seed was recovered.
