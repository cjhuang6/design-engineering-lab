# Radio group

A radio group picks one option from a set. It may also start with nothing selected. It is a `<fieldset>` with a visible `<legend>` in `src/components/radio-group/RadioGroup.jsx`. Each option is a native `<input type="radio">` inside a visible `<label>`. The radios share a `name`. The browser provides the radio role, the arrow keys, and the checked state. The component does not set a role. That matches the [radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).

Tab moves into the group. It lands on the checked option, or on the first option when none is checked. Tab moves out to the next control. Arrow keys move the check to the next or previous option and wrap at the ends. A disabled option is skipped. Space checks the focused option when it is not already checked. Enter does not. The component does not handle those keys. The browser does.

The visible option label is the accessible name. A passed `aria-label` or `aria-labelledby` is not used. The legend is the group's name. A passed group `aria-label` or `aria-labelledby` is not used.

## Props

These names are the public contract.

### RadioGroup

| Prop | Default | What it accepts |
|---|---|---|
| `legend` | | Required visible group name, rendered as the `<legend>`. `label` is the same text when `legend` is omitted |
| `name` | | Required. The shared `name` on every radio, so the browser treats them as one group |
| `options` | | `{ value, label, disabled }` objects. Omit this to pass `Radio` children instead |
| `children` | | `Radio` elements. Omit them when `options` is set |
| `value` | | Controlled selection. An option value, or `null` for nothing selected. Omit it to let the group hold the selection |
| `defaultValue` | `null` | Starting selection when `value` is omitted. An option value, or `null`. Ignored when `value` is set |
| `onValueChange` | | Called with the next option value after a selection |
| `disabled` | `false` | `true` disables the fieldset and every option |
| other `<fieldset>` attributes | | Passed through, including `id` and `className` |

`className` is added on the fieldset.

`role`, `aria-label`, and `aria-labelledby` belong to the group. A passed value is not used. The legend is the name.

### Radio

| Prop | Default | What it accepts |
|---|---|---|
| `value` | | Required. The option value |
| `disabled` | `false` | `true` sets the native `disabled` attribute on that option |
| `children` | | Required. The visible label. This is the accessible name |
| other `<input>` attributes | | Passed through, including `id`, `onChange`, and `className` |

`className` is added on the label.

`type`, `name`, `checked`, `aria-checked`, `aria-label`, and `aria-labelledby` belong to the radio. A passed value is not used. The group sets `type`, `name`, and `checked`.

A missing or blank legend throws, so a group with no name does not render. A missing or blank `name` throws. A missing or blank option label throws. An empty option value throws. Duplicate values throw. Passing both `options` and `Radio` children throws. Passing neither throws. A `value` or `defaultValue` other than a non-empty string or `null` throws. A `Radio` outside a `RadioGroup` throws.

Nothing is selected unless `value` or `defaultValue` is a string. `null` means nothing selected.

There is no hint prop. The radio plan does not include help text.

## Example

```jsx
<RadioGroup legend="Shipping" name="shipping" value={method} onValueChange={setMethod}>
  <Radio value="standard">Standard</Radio>
  <Radio value="express">Express</Radio>
  <Radio value="pickup" disabled>
    Pickup
  </Radio>
</RadioGroup>
```

`method` starts as `null`. Nothing is checked until a person chooses one. The same group can be built from `options`:

```jsx
<RadioGroup
  label="Shipping"
  name="shipping"
  defaultValue="express"
  options={[
    { value: "standard", label: "Standard" },
    { value: "express", label: "Express" },
    { value: "pickup", label: "Pickup", disabled: true },
  ]}
/>
```

## Disabled

Use `disabled` on the group in the usual case. Every option leaves the tab order and cannot be selected. A screen reader skips those options.

Use `disabled` on one `Radio`, or `disabled: true` on one option, when the other choices stay available. Arrow keys skip that option.

## States

Per option: unchecked, checked, hover, keyboard focus, and disabled. The group has a visible name.

Unchecked is a surface fill and an icon-colored ring. Checked keeps that surface fill, turns the ring to the action color, and draws a dot in the same action color. The label words do not change.

Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled uses the disabled opacity. The option does not scale on press. The dot is not drawn in.

## Tokens

| Part | Token |
|---|---|
| Drawn circle | `size/icon/md` |
| Circle fill | `color/surface/primary` |
| Circle edge | `border/width/1`, `radius/full` |
| Unchecked ring | `color/icon/secondary` |
| Unchecked hover | `color/icon/primary` |
| Checked ring | `color/action/primary` |
| Checked dot | `color/action/primary`, `space/2` |
| Checked hover | `color/action/primary-hover` on the ring and the dot |
| Option label | `label/md`, `color/text/primary`, gap `space/2` |
| Group name | `heading/sm`, `color/text/primary`, gap `space/3` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, border, and shadow |

The circle is the same size as Checkbox. The dot uses `space/2`, the same length ToggleChip uses for its dot. `size/icon/sm` would fill almost the whole circle. This component does not add a token.

The plan named `color/border/default` for the outer ring. That misses 3:1 in light. `color/border/default` on the surface is 1.45:1 in light and 1.86:1 in dark. The ring uses the icon colors instead, matching Checkbox.

Contrast, enabled colors, against the adjacent surface:

| Pair | Light | Dark |
|---|---|---|
| Label, `color/text/primary` on `color/surface/primary` | 17.49:1 | 18.40:1 |
| Unchecked ring, `color/icon/secondary` on `color/surface/primary` | 7.00:1 | 13.02:1 |
| Unchecked hover ring, `color/icon/primary` on `color/surface/primary` | 14.51:1 | 17.30:1 |
| Checked ring and dot, `color/action/primary` on `color/surface/primary` | 4.52:1 | 8.82:1 |
| Checked hover, `color/action/primary-hover` on `color/surface/primary` | 6.68:1 | 11.42:1 |

The label clears 4.5:1. The ring and the dot clear 3:1 against the surface they sit on. The circle fill stays the surface color, so the dot is measured against that surface, not against a filled action color.

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The drawn circle stays `size/icon/md`. On a coarse pointer the hit area is at least `size/touch-target`.
