# Segmented control

A segmented control picks one option from a set and draws that choice as a row of segments. It does not switch a panel of content. A control that switches panels is Tabs, which is later. It may also start with nothing selected. It is a `<fieldset>` with a visible `<legend>` in `src/components/segmented-control/SegmentedControl.jsx`. Each option is a native `<input type="radio">` inside a visible `<label>`. The radios share a `name`. The browser provides the radio role, the arrow keys, and the checked state. The component does not set a role. That matches the [radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).

Tab moves into the group. It lands on the checked option, or on the first option when none is checked. Tab moves out to the next control. Arrow keys move the check to the next or previous option and wrap at the ends. A disabled option is skipped. Space checks the focused option when it is not already checked. Enter does not. The component does not handle those keys. The browser does.

The visible option label is the accessible name. The legend is the group's name. A passed group `aria-label` or `aria-labelledby` is not used. The component does not set `aria-checked` or `aria-label` on an option.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `legend` | | Required visible group name, rendered as the `<legend>`. `label` is the same text when `legend` is omitted |
| `name` | | Required. The shared `name` on every radio, so the browser treats them as one group |
| `options` | | Required. `{ value, label, disabled }` objects. One segment per object |
| `value` | | Controlled selection. An option value, or `null` for nothing selected. Omit it to let the control hold the selection |
| `defaultValue` | `null` | Starting selection when `value` is omitted. An option value, or `null`. Ignored when `value` is set |
| `onValueChange` | | Called with the next option value after a selection |
| `disabled` | `false` | `true` disables the fieldset and every option |
| other `<fieldset>` attributes | | Passed through, including `id` and `className` |

`className` is added on the fieldset.

`role`, `aria-label`, and `aria-labelledby` belong to the group. A passed value is not used. The legend is the name.

`disabled: true` on an option sets the native `disabled` attribute on that segment.

A missing or blank legend throws, so a control with no name does not render. A missing or blank `name` throws. A missing or blank option label throws. An empty option value throws. Duplicate values throw. A missing `options` array, or an empty one, throws. A `value` or `defaultValue` other than a non-empty string or `null` throws.

Nothing is selected unless `value` or `defaultValue` is a string. `null` means nothing selected.

There is no size prop. Every segment is `size/control/md`. There is no hint prop. The segmented control plan does not include help text.

## Example

```jsx
<SegmentedControl
  legend="View"
  name="view"
  value={range}
  onValueChange={setRange}
  options={[
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year", disabled: true },
  ]}
/>
```

`range` can start as `null`. Nothing is checked until a person chooses one. The same control can hold its own selection:

```jsx
<SegmentedControl
  label="View"
  name="view"
  defaultValue="week"
  options={[
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ]}
/>
```

## Disabled

Use `disabled` on the control in the usual case. Every segment leaves the tab order and cannot be selected. A screen reader skips those options.

Use `disabled: true` on one option when the other choices stay available. Arrow keys skip that option.

## States

Per segment: unselected, selected, hover, keyboard focus, and disabled. The group has a visible name.

Unselected is a label on the track. Selected keeps that label, draws it semibold, and paints a surface fill with an action-colored edge and the control shadow. The label words do not change. Choosing a segment does not show a panel.

Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled uses the disabled opacity. The segment does not scale on press. The selected fill does not slide.

## Tokens

| Part | Token |
|---|---|
| Track fill | `color/surface/subtle` |
| Track padding | `space/1` |
| Track edge | `border/width/1`, `color/icon/secondary`, `radius/lg` |
| Segment height | `size/control/md` |
| Segment padding | `control/padding-inline/md` |
| Segment radius | `radius/md` |
| Unselected label | `label/md`, `color/text/secondary` |
| Unselected hover | `color/text/primary` |
| Selected fill | `color/surface/primary` |
| Selected label | `color/text/primary`, `font-weight/semibold` |
| Selected edge | `color/action/primary` |
| Selected shadow | `shadow/control` |
| Selected hover | `color/action/primary-hover` on the edge, `shadow/control-hover` |
| Group name | `heading/sm`, `color/text/primary`, gap `space/3` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, border, and shadow |

The segment radius is `radius/md` so the segment sits inside the track's `space/1` padding and `radius/lg` corner. The track radius in the plan was a proposal of `radius/lg`, with `radius/md` still an open question. This component uses `radius/lg`. It does not add a token.

The plan named `color/surface/primary` on `color/surface/subtle`, plus `shadow/control`, as the selected indicator. That fill is 1.09:1 on the track in light and 1:1 in dark, because the dark track and the dark surface are the same color. The shadow hairline is about 1.18:1 in light and 1.24:1 in dark. The track on the page canvas is 1.09:1 in light and 1.11:1 in dark. `color/surface/selected` on the track is 1.02:1 in light and 1.19:1 in dark. `color/border/default` on the surface is 1.45:1 in light and 1.86:1 in dark. None of those mark the row or the selection at 3:1. The row edge uses the icon color. The selected edge uses the action color. The selected label is also semibold, so the selection is not color alone.

Contrast, enabled colors:

| Pair | Light | Dark |
|---|---|---|
| Group name, `color/text/primary` on the page canvas | 17.49:1 | 20.43:1 |
| Selected label, `color/text/primary` on `color/surface/primary` | 17.49:1 | 18.40:1 |
| Unselected label, `color/text/secondary` on `color/surface/subtle` | 6.40:1 | 13.02:1 |
| Unselected hover, `color/text/primary` on `color/surface/subtle` | 15.99:1 | 18.40:1 |
| Track edge, `color/icon/secondary` on `color/surface/subtle` | 6.40:1 | 13.02:1 |
| Track edge, `color/icon/secondary` on the page canvas | 7.00:1 | 14.46:1 |
| Selected edge, `color/action/primary` on `color/surface/primary` | 4.52:1 | 8.82:1 |
| Selected edge, `color/action/primary` on `color/surface/subtle` | 4.14:1 | 8.82:1 |
| Selected hover edge, `color/action/primary-hover` on `color/surface/primary` | 6.68:1 | 11.42:1 |
| Selected hover edge, `color/action/primary-hover` on `color/surface/subtle` | 6.11:1 | 11.42:1 |

The labels clear 4.5:1. The track edge and the selected edge clear 3:1 against the colors they sit on. The selected fill against the track does not, and the shadow hairline does not. Those two stay, and the edge carries the contrast.

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The drawn segment stays `size/control/md`. On a coarse pointer the hit area is at least `size/touch-target`.
