# Interaction brief: proximity hex color picker

**Approved (CJ, 2026-10-23).** Direction B is the first Phase 3 component. This brief is the interaction brief, written before any component code.

Building still waits until Phase 2D and Phase 2E are merged and desktop-verified. Those [entry criteria](../components-roadmap.md#entry-criteria) are unchanged. Whether a throwaway exploration prototype happens earlier is **Unknown**.

## Concept

A honeycomb of color hexagons that reacts to how close the cursor is, not only to which cell the cursor is over. Cells near the pointer grow a little and darken a little, and a closer cell changes more. The person should feel the palette lean toward the cursor, then pick one cell and see that color's token name and its value. Every cell is a Camellia color token.

The idea comes from Gabriel (@gabriell_lab): use proximity, not just hover. [His note](https://x.com/gabriell_lab/status/2060336070059864461).

## Palette

**Observed** on `main` at `995ce87`, counted from [`tokens/camellia.tokens.json`](../../tokens/camellia.tokens.json) on 2026-10-23. The four ramps are 42 tokens (11 + 11 + 10 + 10). White and black bring the honeycomb to **44** cells.

| Token path | Steps | Count |
|---|---|---|
| `color.primitive.ice` | 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 | 11 |
| `color.primitive.blue` | 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 | 11 |
| `color.primitive.green` | 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 | 10 |
| `color.primitive.pink` | 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 | 10 |
| `color.base.white`, `color.base.black` | white, then black | 2 |

Green and pink stop at 900. The file has no `color.primitive.green.950` and no `color.primitive.pink.950`.

Left out of this picker: the alpha primitives (`color.primitive.alpha`), theme colors, frost, and expression fields. The four feedback colors (`feedback.success`, `feedback.warning`, `feedback.error`, `feedback.info`) are solid tokens too, and they are also left out. This palette is the four ramps plus white and black.

When a cell is selected, the picker shows that token's name (the path, such as `color.primitive.blue.600`) and the hex stored on the token. The fill of the cell is that token. The slight darken near the cursor is a temporary effect on top of the fill. It does not add a new swatch.

## Layout

One row per ramp, in the order in the table above: ice, then blue, then green, then pink. White and black come at the end, after the pink row.

The layout is a true honeycomb. Alternate rows are offset by half a cell, and the rows overlap vertically. The next row shifts sideways by half a cell, and it sits high enough that the points of one row nest into the gaps of the row above. That shared zigzag edge is the vertical overlap.

**Proposal:** draw each cell as a hexagon, either with a CSS `clip-path` polygon or with an inline SVG shape.

`clip-path` cuts an element down to a shape. A polygon clip can turn a rectangle into a hexagon. The cut applies to the whole element. An outline, a border, or a `box-shadow` painted on that same element is cut off too, including the usual CSS focus outline. The focus ring and the selected ring need their own shape: a separate element that is not clipped, or a stroke on the SVG hexagon. An SVG stroke is drawn along the hexagon path, so it can follow the cell without being clipped away.

## Directions

Three directions were considered. **Approved (CJ, 2026-10-23):** B.

**A — rejected.** A full-spectrum grid of generated colors. Rejected because those colors are not tokens. This picker shows only colors that already exist in the token file.

**B — chosen.** A honeycomb of the solid color tokens in the palette above. Picking a cell shows its token name and its value.

**C — rejected for now.** B, plus a label lens that shows token names for the cells near the cursor. Rejected for now because it is busier: a second effect to tune, on top of the proximity scale and darken. It can come back later.

## States

Disabled is out of scope. This version has no unavailable state.

- **Rest.** The cell shows its token color at its normal size.
- **Near (proximity).** The pointer is inside the effect radius. The cell scales up and darkens a little. A closer cell changes more. This state is pointer-only.
- **Hovered.** The pointer is on this cell. It is the strongest step of the same near effect, because the distance is smallest. A click here selects this cell.
- **Focused.** Keyboard focus is on this cell. A focus ring is visible. Focus does not scale or darken the neighbors. The proximity effect stays pointer-only.
- **Selected.** This cell is the chosen color. A ring stays on it, and the token name and value are shown. The ring remains after the pointer leaves. Focus and selection can be on different cells: arrow keys move focus, and Enter or Space is what selects. When those two cells differ, both rings are visible, and they need to look different from each other.

## Keyboard

The honeycomb is one Tab stop. Tab moves into the picker, and the next Tab leaves it. Inside the picker, arrow keys move focus to a neighboring hexagon. Enter or Space selects the focused cell. The focus ring is visible.

That single Tab stop is a roving tabindex. Only the cell that holds focus is in the page's tab order (`tabindex="0"`). The other cells are taken out of that order (`tabindex="-1"`) until an arrow key moves focus onto one of them. Then that cell becomes the one Tab stop. A screen reader user does not have to Tab through all 44 cells to get past the picker.

Left and Right move along the row. Up and Down move to the neighboring row. The rows are offset by half a cell, so Up and Down land on a hexagon that shares an edge. Which of the two upper neighbors Up prefers is a **Proposal** detail for the prototype.

The proximity effect does not run from the keyboard. Arrow keys move focus and do not scale or darken the surrounding cells.

## Pointer

On each pointer move, measure the distance from the cursor to the center of each cell. Inside a radius of about 80px, the cell scales up, to about 1.15 (15% larger), and darkens slightly. The effect is strongest at the cursor and falls off smoothly to 0 at the edge of the radius. Past the radius, the cell stays at rest.

A click selects the cell under the pointer. Selection is the same outcome as Enter or Space on the focused cell.

**Proposal:** 80px and 15% are tuning values. They are not tokens yet. Once they feel right, they become component tokens. Where component tokens live is still open ([components roadmap, question 2](../components-roadmap.md#open-questions), which is also token pipeline [open question 7](../token-pipeline-roadmap.md#open-questions)).

Touch does not get the radius effect. A finger also fires pointer events, so the distance math has to ignore touch. Otherwise the honeycomb would scale under a finger. A tap selects. The same rule is under Accessibility.

## Motion

While the pointer is tracking, cells follow it directly. The scale and the darken match the pointer position on that move. There is no extra delay, and no new duration, on the way in.

When the pointer leaves, the cells settle back to rest with `--duration-fast` and `--ease-standard`. Those are the CSS custom properties generated from the tokens `duration/fast` and `ease/standard`. The brief names those tokens. It does not add a millisecond value or a cubic-bezier. No new motion values.

What `prefers-reduced-motion` does is specified under Accessibility: no scaling, only a highlight on the cell under the cursor.

## Accessibility

The picker is a radiogroup: a group of options where one choice is selected. Each cell is a radio inside that group. The visual is a hexagon. The role is what a screen reader uses.

Each cell has an accessible name in words, such as "blue 600", "ice 50", "white", or "black". That spoken name is the ramp and the step. The token path and the hex are what the picker shows after a selection. They can both be there. The short name is what gets announced.

The focus ring and the selected ring are visible shapes, so focus and selection have a cue besides the cell's own color. The rings, and the type that shows the token name and value, use semantic colors already in the system. The cell fill is the token being chosen, including the lightest and darkest steps, so the ring has to stay visible on those fills. The separate element or SVG stroke in Layout is what makes that ring possible.

`prefers-reduced-motion` means no scaling. The cells stay at their rest size. The only proximity response is a highlight on the cell under the cursor.

Touch has no proximity effect. A tap selects.

Target size is **Unknown**. Each cell needs to be a comfortable pointer and tap target, and the size should come from a size token that already exists. This brief does not invent a pixel size.

## Out of scope

- A custom hex input, where someone types any hex code.
- An opacity slider.
- The gradient square, the flat field of saturation and lightness in a typical color picker.
- A Figma component, for now. How far Figma component sync goes is still **Unknown** in the Components & interactions section of the [project roadmap](../roadmap.md).
- A disabled state.
- Direction C's label lens, in this version. It can come back later.
- Generated colors, including a darkened hex stored as if it were a token.
