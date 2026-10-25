# Interaction brief: proximity hex color picker

**Approved (CJ, 2026-10-23).** Direction B is the first Phase 3 component. The rest of Phase 3 still waits until Phase 2D and Phase 2E are merged and desktop-verified ([entry criteria](../components-roadmap.md#entry-criteria)).

**In progress (CJ, 2026-10-24).** CJ approved building the picker now, in parallel with Phase 2D. The component is in the demo. Values that are not tokens yet are component-local placeholders. The decisions from 2026-10-23 are unchanged. A later decision about the surface behind the cells is recorded under [Palette](#palette) and is not applied yet.

**Decided (CJ, 2026-10-23).** The interaction below comes from a throwaway prototype: a standalone HTML file outside this repo. That file is not part of the repository.

Hover numbers are still tunable. They are listed under [Candidate component tokens](#candidate-component-tokens) and are not tokens yet. Where those tokens live is [question 2](../components-roadmap.md#open-questions).

## Concept

A flat-top honeycomb of 37 pointy-top color hexagons. Cells near the cursor grow and darken a little, more so when they are closer. Picking a cell shows that token's name and hex. Every cell is a Camellia color token.

From Gabriel (@gabriell_lab): use proximity, not just hover. [His note](https://x.com/gabriell_lab/status/2060336070059864461).

## Directions

**Approved (CJ, 2026-10-23):** B.

- **A — rejected.** A full-spectrum grid of generated colors. Those colors are not tokens.
- **B — chosen.** A honeycomb of Camellia color tokens. Picking a cell shows its token name and value. The decided layout uses 37 of the 44 solid color tokens.
- **C — rejected for now.** B plus a label lens of token names near the cursor. Busier: a second effect to tune. Possible later.

## Palette

**Observed** in [`tokens/camellia.tokens.json`](../../tokens/camellia.tokens.json) on `main` at `995ce87` (2026-10-23). The file has **44** solid color tokens: ice 11 (`50`–`950`), blue 11 (`50`–`950`), green 10 (`50`–`900`), pink 10 (`50`–`900`), plus `color.base.white` and `color.base.black`. Green and pink have no `950`.

**Decided (CJ, 2026-10-23):** the picker uses **37** of those 44. Tradeoff: it does not show every color token.

Dropped (7):

- `color.primitive.ice.50`
- `color.primitive.blue.50`
- `color.primitive.green.50`
- `color.primitive.pink.50`
- `color.primitive.ice.950`
- `color.primitive.blue.950`
- `color.base.black`

Also left out of the picker: alpha primitives, theme colors, frost, expression fields, and the feedback colors (`feedback.success`, `feedback.warning`, `feedback.error`, `feedback.info`).

`color.base.white` is the center cell. The cell fill is always the token. The hover darken is a brightness filter on top of that fill, not a new swatch.

**Decided (CJ, 2026-10-25).** Tint the surface behind the honeycomb so the white center reads as a cell, not a hole. Resting cells still have no border and no outline. The tint has to be an existing semantic surface or background token. Do not invent a token and do not hard-code a color. The proximity darken that turns white gray stays as it is.

**Observed (2026-10-25).** None of the current semantic surfaces does both jobs, so the picker is unchanged. The card still uses `--color-surface-primary` (white in light, ice 950 in dark). Difference below is CIE76 ΔE in the light theme. About 2 is just noticeable. A clear edge is higher than that. Ice 100 is `#f1f5fc`.

| Token | Light | ΔE vs white | ΔE vs ice 100 | Dark |
|---|---|---|---|---|
| `--color-surface-secondary` | ice 50 `#fafcff` | 2.0 | 3.3 | ice 900 |
| `--color-surface-subtle` | ice 100 `#f1f5fc` | 5.2 | 0 | ice 950, the same as `surface-primary` |
| `--color-surface-selected` | blue 50 `#f0f8ff` | 5.3 | 1.6 | blue 950 |
| `--color-functional-surface` | green 50 `#ecfdf6` | 7.3 | 8.7 | 12% green, not a neutral |

`--color-surface-secondary` is the only neutral that keeps ice 100 distinct, and the white edge is not clear. `--color-surface-subtle` gives white a clear edge and erases ice 100. `--color-surface-selected` is a selection color and nearly erases ice 100. `--color-functional-surface` is a green status surface. There is no sunken surface token. Applying the tint needs a neutral surface between ice 50 and ice 100, which is a token change and waits for CJ.

## Layout

**Decided (CJ, 2026-10-23).** One big hexagon. Pointy-top cells. The big shape is flat-top. Row lengths, top to bottom: 4, 5, 6, 7, 6, 5, 4 (37). Rows alternate by half a cell and overlap vertically, so the points nest.

Four hue wedges. Steps `100` through `900` run from the inner ring outward: lightest beside white, darkest on the outer edge. The inner ring has 6 cells, and 6 does not divide into 4 wedges, so the wedges are uneven.

| Wedge | Place | Cells per ring, inner → outer | Steps on those rings |
|---|---|---|---|
| ice | top | 2, 3, 4 | 100, 200 / 300, 400, 500 / 600, 700, 800, 900 |
| blue | right | 1, 3, 5 | 100 / 200, 300, 400 / 500, 600, 700, 800, 900 |
| green | bottom | 2, 3, 4 | 100, 200 / 300, 400, 500 / 600, 700, 800, 900 |
| pink | left | 1, 3, 5 | 100 / 200, 300, 400 / 500, 600, 700, 800, 900 |

Center plus three rings: 1 + 6 + 12 + 18 = 37. Each wedge has 9 cells, one per step from `100` to `900`.

**Proposal:** draw each cell with a CSS `clip-path` polygon or an inline SVG. `clip-path` also clips outlines and `box-shadow`s. Rest has no border. Selection is an inner mark, not an outline. The focus ring still needs a separate element or an SVG stroke.

## States

Disabled is out of scope.

- **Rest.** Token fill at scale 1. No border and no outline, pale cells included. The surface behind the cells is still `--color-surface-primary`. The 2026-10-25 tint is not applied; see [Palette](#palette).
- **Near / hover.** Pointer only. See Pointer. Radius 80px, scale up to 1.15, darken 0.12, smoothstep falloff. Still tunable.
- **Press.** Scale 0.94 on pointerdown, or on Enter/Space keydown. `--duration-fast` and `--ease-standard`.
- **Focus.** A focus ring, separate from the selection mark, using `--color-focus`.
- **Selected.** No outline ring. An inner hexagon mark, 35% of the cell, grows from the center over 200ms. Ease: overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)`. Mark color is white or `color.primitive.ice.900`, whichever has the higher WCAG contrast with the cell. The token name and hex are shown.
- **Idle (selected).** The mark breathes: scale 1 → 1.12 → 1 over 2.4s. Each half uses sine ease-in-out `cubic-bezier(0.37, 0, 0.63, 1)`. Starts about 600ms after the grow-in finishes. About 11s after the last interaction it finishes the current breath and stops at rest. Hovering the picker starts it again. The auto-stop is how this meets WCAG 2.2.2 Pause, Stop, Hide.

CJ compared the breath with cubic ease-in-out `cubic-bezier(0.65, 0, 0.35, 1)` and rejected it. It felt out of breath.

## Keyboard

**Decided (CJ, 2026-10-23):** A. Arrow keys move and select.

The picker is one Tab stop (roving tabindex): only the focused cell has `tabindex="0"`. The others are `tabindex="-1"`. Arrow keys move to a neighboring hexagon and select it, the same as a native radio. Up and Down keep the column. Enter or Space selects and plays the press dip.

The focus ring stays separate from the selection mark and uses `--color-focus`. Proximity does not run from the keyboard.

## Pointer

On each animation frame while the pointer is tracking (`requestAnimationFrame`), measure the distance from the cursor to each cell center. Inside 80px, smoothstep falls off from full effect at the cursor to 0 at the radius. Full effect is scale 1.15 and darken 0.12. Past the radius, the cell stays at rest. On leave, cells settle with `--duration-fast` and `--ease-standard`.

Click selects. Pointerdown plays the press dip.

Touch: a tap selects. No hover scaling. A finger also fires pointer events, so the radius effect ignores touch.

Known prototype rough edge: the brightness-filter darken turns white gray.

## Motion

| Moment | What moves | Timing |
|---|---|---|
| Tracking | Scale and darken follow the pointer | One frame via `requestAnimationFrame`. No added duration |
| Leave | Back to rest | `--duration-fast`, `--ease-standard` |
| Press | Scale to 0.94 and back | `--duration-fast`, `--ease-standard` |
| Select | Inner mark grows from the center | 200ms, overshoot ease above |
| Idle | Mark breathes, then stops | 2.4s per breath, sine ease each half. Delay about 600ms. Stop about 11s after the last interaction |

`--duration-fast` is 100ms and `--ease-standard` is the generated `ease/standard` curve. Both already exist.

**Observed:** `--duration-normal` is 200ms (`duration/normal`). The 200ms grow-in may map to that token. The mapping is not decided. Until it is, 200ms stays on the candidate list.

`prefers-reduced-motion`: the selection mark stays static. No press dip. No idle breath.

## Accessibility

A `radiogroup` of `radio` cells. One choice is selected. Each cell's accessible name is the ramp and step in words, such as "blue 600" or "white".

The focus ring (`--color-focus`) and the inner mark are separate cues, so focus and selection do not rely on the cell color alone. The mark picks white or `color.primitive.ice.900` by WCAG contrast with that cell.

Arrow keys move and select. Touch selects on tap and does not scale neighbors. Reduced motion is under Motion. The idle breath stops on its own (WCAG 2.2.2).

Target size is **Unknown**. Use a size token that already exists when the component is built.

## Candidate component tokens

Not created. Question 2 still decides where component tokens live. Hover values are still tunable.

| Candidate | Value | Used for |
|---|---|---|
| Grow-in duration | 200ms | Selection mark. May map to `duration/normal` |
| Idle duration | 2400ms | One breath |
| Idle delay | 600ms | After grow-in, before the first breath |
| Auto-stop | 11000ms | Idle ends after the last interaction |
| Ease overshoot | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Grow-in |
| Ease in-out sine | `cubic-bezier(0.37, 0, 0.63, 1)` | Each half of a breath |
| Press scale | 0.94 | Press dip |
| Hover max scale | 1.15 | Proximity |
| Hover darken | 0.12 | Proximity. Brightness filter; white goes gray |
| Hover radius | 80px | Proximity |
| Mark size | 35% | Inner hexagon, relative to the cell |
| Idle scale | 1.12 | Peak of the breath |

## Out of scope

- A custom hex input.
- An opacity slider.
- The gradient square.
- A Figma component, for now. Figma component sync is still **Unknown** on the [project roadmap](../roadmap.md).
- A disabled state.
- Direction C's label lens, in this version.
- Generated colors, or a darkened hex stored as a token.
- The seven dropped tokens, in this layout.
- Adding the throwaway HTML prototype to this repo.
