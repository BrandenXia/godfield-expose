# Player name rules

Open the inspector with **+** or **Alt+I**, then select **Name labels**. Edit the text, check the current-room preview, and select **Apply rules**. The switch, rules, and colors are saved in this browser for future games. A draft changes only the preview. Invalid rules show line numbers and leave applied rules intact. **Load presets** fills the editor; select **Apply rules** to save that replacement.

Rules apply to all players, including yourself. Native nameplates get a colored name and compact badges beside it; the inspector shows all matching badges. Name colors and badges follow the current received snapshot and chosen item language. Eliminated players have no labels. The native name is shortened when necessary to leave room for badges; its full text remains available in the player hover preview and inspector. Native badges show up to three rows, with `+N more` when necessary. The full inspector and rule preview show all matches. Badges do not intercept clicks on the game's target buttons.

## One rule per line

```text
// The first matching rule chooses the name color.
has("升天弓") => #b13978 "{item}"
has("太阳守护") => #986200 "{item}"
def == 0 => #b53535 "DEF 0"
```

The left side is a condition. After `=>`, write a hex color and a label in double quotes. Blank lines and lines beginning with `//` are ignored. An empty rule set disables all labels. Reorder rules to change color priority. Every matching rule can add a badge, with duplicate label text removed.

This example labels either item separately. To require both together:

```text
has("升天弓") and has("太阳守护") => #b13978 "{item}"
```

`{item}` expands to matching item names in the selected display language. The condition accepts the exact official name from **any** of the eight bundled languages, independently of the current display language. Name matching ignores case and surrounding whitespace. Ambiguous names must use a numeric item ID instead. For example, `has(112)` means Ascension Bow and `has(208)` means Sun Amulet. Conditions use real received model IDs, including Dream items.

## Conditions

| Syntax | Meaning |
| --- | --- |
| `has("Sun Amulet")` | Owns at least one known instance of that item. |
| `has(208)` | Same check using a stable catalog model ID. |
| `def == 0` | Sum of printed DEF on all known owned items equals zero. |
| `hp <= 10` | Current received HP is at most 10. |
| `mp >= 5` | Current received MP is at least 5. |
| `cp > 20` | Current received CP exceeds 20. |
| `items < 3` | Received inventory has fewer than three entries. |
| `not has(208)` | Complete known inventory does not contain Sun Amulet. |
| `A and B`, `A or B`, `(A or B) and C` | Combine conditions; `not` binds before `and`, then `or`. |

Numeric comparisons support `==`, `!=`, `<`, `<=`, `>`, and `>=`, with nonnegative integer constants up to 99,999. There is no JavaScript execution, regular-expression matching, or network access in the rule language.

**DEF is a printed-stat sum, not a damage forecast.** It includes DEF on dual-purpose items; it does not model elemental compatibility, Flash's single-defense restriction, reflection, blocking, counters, or available MP. A player with Super Mirror can have `def == 0` while still having powerful protection. The preset calls this **DEF 0**, not “unprotected.”

If the inventory is unavailable or contains any concealed/unmapped model, `def` is unknown and cannot satisfy a comparison. Absence checks such as `not has(...)` are also unknown unless the whole inventory is known. A positive `has(...)` can still match a known item alongside concealed items. Unknown HP/MP/CP does not count as zero. Cached snapshot limitations are shown in the inspector status.

## Labels and colors

Colors accept `#RGB` or `#RRGGBB`. Labels support these placeholders:

| Placeholder | Substitution |
| --- | --- |
| `{item}` | Names of the positive `has(...)` conditions that matched, joined with ` / `. |
| `{def}` | Known printed DEF sum, or `?` if unknown. |
| `{hp}`, `{mp}`, `{cp}` | Current stat, or `?` if unknown. |
| `{items}` | Number of received inventory entries, or `?` if unavailable. |

Use a literal label for rules without a positive item condition. A label that expands to empty text is omitted. Labels are displayed as text, never interpreted as HTML. Within quoted strings, JSON escapes such as `\"` and `\\` are supported; labels cannot contain newlines or tabs.

```text
// Move this above general item rules to give it color priority.
has(112) and hp <= 10 => #b53535 "Bow · HP {hp}"

// Missing-item checks require a fully known inventory.
not has(208) and def < 5 => #a34e22 "Low DEF {def}"

// Show current numeric defense on everyone whose DEF is known.
def >= 0 => #16669a "DEF {def}"
```

The shipped presets highlight Ascension Bow, Sun Amulet, Super Mirror, God Shield, zero printed DEF, and HP at or below 10. Limits: 32 rules, 12,000 source characters, 600 characters per line, and 80 characters per label template.

Settings are local to the God Field browser origin, shared between the extension and userscript on that origin. They are not synced to an account. If browser storage is unavailable, applying still works for the current tab and the editor reports that it could not save. Previously invalid saved rules fall back to presets with a notice. Other already-open tabs load new settings when reloaded.

## Implementation and checks

`name-rules.js` parses conditions into a restricted expression tree and evaluates unknown values explicitly. `name-labels.js` owns the editor, persistence, preview, and decoration. The native adapter supplies player ID/name associations and the native name-text node (`Q.c.a` in the inspected client); labels are never assigned by visible name alone or screen order. Unsupported native layouts retain inspector labels. Removing a match or disabling rules removes the extension style overrides and restores the game's current styling.

Unit checks cover translated names, numeric IDs, logical precedence, unknown inventories, dual-purpose DEF, template expansion, errors, and limits. Browser fixtures run in both MV3 and userscript mode and cover same-name players, native target clicks, player hover, editor validation, persistence across reload, language changes, unknown data, node replacement, disable/reset, room exit, and a narrow viewport. A live Training check additionally confirmed that both native nameplates displayed a custom DEF label and color without page errors; no combat command was submitted.
