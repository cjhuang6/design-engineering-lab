# Switch

A switch turns one thing on or off. The label stays the same in both states. A screen reader says "on" or "off" against that stable name. It is a native `<input type="checkbox" role="switch">` in `src/components/switch/Switch.jsx`, inside a visible `<label>`. The browser provides Space to toggle and the checked state. The component sets `role="switch"` because a plain checkbox would be announced as checked or unchecked. Enter does not toggle it. That matches the [switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/).

The visible label is the accessible name. A passed `aria-label` or `aria-labelledby` is not used. The component does not set `aria-checked`. On this element the checked state is the `checked` attribute, which is what the pattern uses instead.

There is no mixed state. A switch is only on or off. Choose a switch when the meaning is on/off. Choose a checkbox when the meaning is checked/unchecked.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `checked` | | Controlled state. `true` or `false`. Omit it to let the switch hold the state |
| `defaultChecked` | `false` | Starting state when `checked` is omitted. `true` or `false`. Ignored when `checked` is set |
| `onCheckedChange` | | Called with the next boolean after an activation |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `children` | | Required. The visible label. This is the accessible name |
| other `<input>` attributes | | Passed through, including `name`, `value`, `id`, `onChange`, and `className` |

`className` is added on the label.

`type`, `role`, `indeterminate`, and `aria-checked` belong to the switch. A passed value is not used. The input stays `type="checkbox"` and `role="switch"`.

A missing or blank label throws, so a switch with no accessible name does not render. A `checked` or `defaultChecked` value other than `true` or `false` throws. `'mixed'` throws.

There is no hint prop. The switch plan does not include help text.

## Example

```jsx
<Switch checked={wifi} onCheckedChange={setWifi}>
  Wi-Fi
</Switch>
<Switch defaultChecked={false}>Bluetooth</Switch>
<Switch disabled>Airplane mode</Switch>
```

The label stays "Wi-Fi" when the switch is on and when it is off.

## Disabled

Use `disabled` in the usual case. The switch leaves the tab order and does not toggle. A screen reader skips it.

## States

Off, on, hover, keyboard focus, and disabled.

Off is a pill track in the secondary icon color with the thumb at the start. On is the primary action color with the thumb at the end. The label words do not change. The control is a pill and a round thumb. It is not a checkbox.

Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled uses the disabled opacity. The switch does not scale on press. The thumb does not stretch.

## Tokens

| Part | Token |
|---|---|
| Track | Height `size/control/sm`, width `size/control/lg`, `radius/full` |
| Off track | `color/icon/secondary` |
| Off hover | `color/icon/primary` |
| On track | `color/action/primary` |
| On hover | `color/action/primary-hover` |
| Thumb | `color/surface/primary`, `size/icon/lg`, `radius/full`, inset `space/1` |
| Label | `label/md`, `color/text/primary`, gap `space/2` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, border, shadow, and the thumb's transform |

The thumb is `size/icon/lg` (24px). The track is 32px tall, so a `space/1` (4px) inset puts that circle in the middle of each rounded end. `size/icon/md` would need a 6px inset, and the space scale has no 6px step. The thumb slides with `translateX` only. Under reduced motion that move takes no time.

The plan named `color/border/strong` for the off track. That misses 3:1 in light. `color/border/default` on the surface is 1.45:1 in light and 1.86:1 in dark. `color/border/strong` is 2.39:1 in light and 3.05:1 in dark. The off track uses the icon colors instead, matching Checkbox and Radio. The thumb is the surface color, so its contrast against the track is the same ratio as the track against the page. This component does not add a token.

Contrast, enabled colors:

| Pair | Light | Dark |
|---|---|---|
| Label, `color/text/primary` on `color/surface/primary` | 17.49:1 | 18.40:1 |
| Off track, `color/icon/secondary` on `color/surface/primary` | 7.00:1 | 13.02:1 |
| Off thumb, `color/surface/primary` on `color/icon/secondary` | 7.00:1 | 13.02:1 |
| Off hover track, `color/icon/primary` on `color/surface/primary` | 14.51:1 | 17.30:1 |
| Off hover thumb, `color/surface/primary` on `color/icon/primary` | 14.51:1 | 17.30:1 |
| On track, `color/action/primary` on `color/surface/primary` | 4.52:1 | 8.82:1 |
| On thumb, `color/surface/primary` on `color/action/primary` | 4.52:1 | 8.82:1 |
| On hover track, `color/action/primary-hover` on `color/surface/primary` | 6.68:1 | 11.42:1 |
| On hover thumb, `color/surface/primary` on `color/action/primary-hover` | 6.68:1 | 11.42:1 |

The label clears 4.5:1. The track clears 3:1 against the surface. The thumb clears 3:1 against the track in both states, including hover. The thumb and the surface are the same color, so each thumb row matches the track row above it.

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The drawn track stays `size/control/sm` by `size/control/lg`. On a coarse pointer the hit area is at least `size/touch-target`.
