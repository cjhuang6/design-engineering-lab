# Checkbox

A Checkbox selects one option, or shows that only some of a group are selected. It is a native `<input type="checkbox">` in `src/components/checkbox/Checkbox.jsx`, inside a visible `<label>`. The browser provides the checkbox role, Space to toggle, and the checked state. The component does not set a role. Enter does not toggle it. That matches the [checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/).

The visible label is the accessible name. A passed `aria-label` or `aria-labelledby` is not used.

Mixed means some of the children are selected. The component sets the input's `indeterminate` property through a ref. That property cannot be set with an HTML attribute. The browser exposes the mixed state to assistive technology. The component does not set `aria-checked`.

Activating a mixed checkbox moves it to checked. A click or Space does that. The component does not move a checkbox into mixed. The screen that owns the group sets mixed.

A group with a visible name is a `<fieldset>` and a `<legend>` in the screen that renders the checkboxes. The component is one checkbox.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `checked` | | Controlled state. `true`, `false`, or `'mixed'`. Omit it to let the checkbox hold the state |
| `defaultChecked` | `false` | Starting state when `checked` is omitted. `true`, `false`, or `'mixed'`. Ignored when `checked` is set |
| `onCheckedChange` | | Called with the next boolean after an activation. Mixed reports `true` |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `children` | | Required. The visible label. This is the accessible name |
| other `<input>` attributes | | Passed through, including `name`, `value`, `id`, `onChange`, and `className` |

`className` is added on the label.

`type`, `indeterminate`, and `aria-checked` belong to the checkbox. A passed value is not used.

A missing or blank label throws, so a checkbox with no accessible name does not render. A `checked` or `defaultChecked` value other than `true`, `false`, or `'mixed'` throws.

There is no hint prop. The checkbox plan does not include help text.

## Example

```jsx
<fieldset>
  <legend>Notifications</legend>
  <Checkbox checked={email} onCheckedChange={setEmail}>
    Email
  </Checkbox>
  <Checkbox checked={devices} onCheckedChange={setDevices}>
    Some devices
  </Checkbox>
  <Checkbox defaultChecked={false}>Push</Checkbox>
</fieldset>
```

`devices` can be `'mixed'`. The next activation calls `setDevices(true)`.

## Disabled

Use `disabled` in the usual case. The checkbox leaves the tab order and does not toggle. A screen reader skips it.

## States

Unchecked, checked, mixed, hover, keyboard focus, and disabled.

Unchecked is a surface fill and an icon-colored border. Checked is the primary fill with a check in the primary text color. Mixed uses that same fill with a dash. The label words do not change.

Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled uses the disabled opacity. The checkbox does not scale on press. The check and the dash are not drawn in.

## Tokens

| Part | Token |
|---|---|
| Drawn box | `size/icon/md` |
| Unchecked fill | `color/surface/primary` |
| Unchecked border | `color/icon/secondary`, `border/width/1`, `radius/sm` |
| Unchecked hover | `color/icon/primary` |
| Checked and mixed fill | `color/action/primary` |
| Check and dash | `color/action/primary-text` |
| Checked and mixed hover | `color/action/primary-hover` |
| Label | `label/md`, `color/text/primary`, gap `space/2` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, border, and shadow |

The plan named `color/border/default` for the resting edge and `color/border/strong` for hover. Those miss 3:1 for the box edge in light. `color/border/default` on the surface is 1.45:1 in light and 1.86:1 in dark. `color/border/strong` is 2.39:1 in light and 3.05:1 in dark. The box uses the icon colors instead. This component does not add a token.

Contrast, enabled colors, against the adjacent surface or fill:

| Pair | Light | Dark |
|---|---|---|
| Label, `color/text/primary` on `color/surface/primary` | 17.49:1 | 18.40:1 |
| Unchecked border, `color/icon/secondary` on `color/surface/primary` | 7.00:1 | 13.02:1 |
| Unchecked hover border, `color/icon/primary` on `color/surface/primary` | 14.51:1 | 17.30:1 |
| Checked and mixed fill, `color/action/primary` on `color/surface/primary` | 4.52:1 | 8.82:1 |
| Check and dash, `color/action/primary-text` on `color/action/primary` | 4.52:1 | 8.82:1 |
| Hover fill, `color/action/primary-hover` on `color/surface/primary` | 6.68:1 | 11.42:1 |
| Check and dash on the hover fill | 6.68:1 | 11.42:1 |

The label clears 4.5:1. The border, the fill, and the glyph clear 3:1 against the color they sit on. `color/action/primary-text` is the same color as the surface, so the glyph against the page surface is 1:1. The glyph is painted on the fill, not on the surface.

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The drawn box stays `size/icon/md`. On a coarse pointer the hit area is at least `size/touch-target`.
