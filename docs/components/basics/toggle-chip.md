# ToggleChip

A ToggleChip turns one choice on or off, and stays that way until the next press. It is a native `<button type="button">` in `src/components/toggle-chip/ToggleChip.jsx`, so it already has the button role. The component sets `aria-pressed` to `true` or `false`. Enter toggles it. Space toggles it. The browser does both. The component does not set `role="button"`.

The visible label stays the same when the state changes. A screen reader can then announce "pressed" or "not pressed" against a stable name. The label text is that name. A passed `aria-label` or `aria-labelledby` is not used.

Several chips can be on at once. That is a group of toggle buttons, not a radio group. The component is one chip. The screen that shows several of them gives the group `role="group"` and a visible label, and points `aria-labelledby` at that label.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `pressed` | | Controlled selected state. `true` or `false`. Omit it to let the chip hold the state |
| `defaultPressed` | `false` | Starting state when `pressed` is omitted. Ignored when `pressed` is set |
| `onPressedChange` | | Called with the next boolean after a toggle |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `icon` | | Optional element before the label. Wrapped in `aria-hidden`. Pass an svg that uses `currentColor` |
| `children` | | Required. The visible label. This is the accessible name |
| `type` | `button` | The native button type |
| other `<button>` attributes | | Passed through, including `onClick`, `className`, and `aria-disabled` |

`aria-pressed` belongs to the chip. A passed value is not used.

`aria-disabled` is not its own prop. Pass the attribute.

A missing or blank label throws, so a chip with no accessible name does not render.

There is no icon package. The state mark is drawn by the chip: a dot when it is off, a check when it is on. Both are `aria-hidden`. The optional `icon` is a second graphic, also `aria-hidden`, for a chip that needs its own symbol.

## Example

```jsx
<div role="group" aria-labelledby="reasons-label">
  <h2 id="reasons-label">Reasons</h2>
  <ToggleChip pressed={clear} onPressedChange={setClear}>
    Clear
  </ToggleChip>
  <ToggleChip defaultPressed={false} onPressedChange={setUseful} icon={<TagIcon />}>
    Useful
  </ToggleChip>
</div>
```

`TagIcon` is an svg you define. The showcase demo defines one inline. The component does not import an icon set.

## Disabled or aria-disabled

Use `disabled` in the usual case. The chip leaves the tab order and does not toggle. A screen reader skips it.

Use `aria-disabled="true"` when the person still needs to land on the chip. The chip stays in the tab order, shows the focus ring from the keyboard, and does not toggle on click, Enter, or Space.

If both are set, native `disabled` wins. The browser will not focus the chip.

## States

Rest, hover, pressed (the momentary `:active` press), selected (`aria-pressed="true"`), keyboard focus, and disabled.

Off and on differ by more than color. Off is a neutral fill, a soft control shadow, gray text, and a dot. On is the selected fill, a solid primary ring, link-blue text, and a check in that same slot. The label words do not change.

Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled and `aria-disabled="true"` use the disabled opacity. The chip does not scale on press.

The momentary press is not a lighter fill than hover. Off goes from `color/surface/secondary` on hover to `color/surface/subtle` while pressed. In dark, `color/surface/subtle` is the same hex as the resting surface and darker than the hover surface, so the press stays on `color/surface/secondary`. On keeps `color/surface/selected` and `color/action/link` for rest, hover, and press. Hover and press thicken the ring from `border/width/1` to `border/width/2`.

## Tokens

| Part | Token |
|---|---|
| Height | `size/control/sm` |
| Type | `label/sm` |
| Padding | `space/2` at the start, `space/3` at the end, `space/0` on the block axis |
| Gap inside the chip | `space/1` |
| Gap between chips | `space/2`, on the row that groups them |
| Radius | `radius/full` |
| Mark and icon | `size/icon/sm`. The off dot is `space/2` |
| Off fill, label, edge | `color/surface/primary`, `color/text/secondary`, `shadow/control` |
| Off hover | `color/surface/secondary`, `shadow/control-hover` |
| Off pressed | `color/surface/subtle` in light, `color/surface/secondary` in dark, `shadow/control` |
| On fill and label | `color/surface/selected`, `color/action/link` |
| On ring | `border/width/1` and `color/action/primary` at rest. `border/width/2` on hover and press |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, border, and shadow |

`color/action/primary` on `color/surface/selected` is 4.22:1 in light. `label/sm` is 12px, so the label needs at least 4.5:1. `color/action/link` on that fill is 6.23:1 in light and 9.59:1 in dark, so the on label uses the link blue. The ring stays `color/action/primary`.

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The drawn height stays `size/control/sm`. On a coarse pointer the hit area is at least `size/touch-target`.
