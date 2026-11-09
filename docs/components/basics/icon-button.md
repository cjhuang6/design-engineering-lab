# IconButton

An IconButton runs one action and shows an icon instead of words. It is the same native `<button>` as [Button](button.md), in `src/components/icon-button/IconButton.jsx`, so it already has the button role. Enter activates it. Space activates it. The browser does both. The component does not set `role="button"`.

There is no visible label. The accessible name is the `label` prop, rendered as `aria-label`. An accessible name is the text a screen reader reads for the control. Without one, the control is announced as a blank button. The icon sits in an element marked `aria-hidden`, so the screen reader reads the name and skips the graphic.

Primary is the main action. Secondary is a quieter action on a surface. Ghost is an icon with no fill until hover or press. The control is square: width and height are the same `size/control` token.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `label` | | Required. The accessible name. Rendered as `aria-label` |
| `variant` | `primary` | `primary`, `secondary`, `ghost` |
| `size` | `md` | `sm`, `md`, `lg` |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `children` | | The icon element. Pass an svg that uses `currentColor` |
| `type` | `button` | The native button type. Use `submit` to submit a form |
| other `<button>` attributes | | Passed through, including `onClick`, `className`, and `aria-disabled` |

`label` is the accessible name. A passed `aria-label` or `aria-labelledby` is not used.

`aria-disabled` is not its own prop. Pass the attribute.

There is no icon package. The caller passes the icon in. A missing or blank `label` throws, so a blank button does not render.

## Example

```jsx
<IconButton label="Add" variant="primary" size="md" onClick={add}>
  <PlusIcon />
</IconButton>
```

`PlusIcon` is an svg you define. The showcase demo defines one inline. The component does not import an icon set.

## Disabled or aria-disabled

Use `disabled` in the usual case. The button leaves the tab order and does not activate. A screen reader skips it.

Use `aria-disabled="true"` when the person still needs to land on the button, for example to reach the reason it cannot run. The button stays in the tab order, shows the focus ring from the keyboard, and does not run its action on click, Enter, or Space.

If both are set, native `disabled` wins. The browser will not focus the button.

## States

Rest, hover, pressed, keyboard focus, and disabled. These match [Button](button.md), including the pressed fills. Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled and `aria-disabled="true"` use the disabled opacity. The button does not scale on press.

The icon color is `color/action/primary-text` on primary, and `color/icon/primary` on secondary and ghost. Paint the svg with `currentColor` so it uses that color.

## Tokens

| Part | Token |
|---|---|
| Width and height | `size/control/sm`, `size/control/md`, `size/control/lg` |
| Inline padding | `space/0` |
| Icon | `size/icon/sm` inside sm, `size/icon/md` inside md, `size/icon/lg` inside lg |
| Radius | `radius/md` |
| Primary icon | `color/action/primary-text` |
| Secondary and ghost icon | `color/icon/primary` |
| Fills, shadows, focus, disabled, coarse hit area, motion | Same as [Button](button.md) |

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them. The icon is centered in the square. The leftover space is not a padding token: sm has 8px a side, md has 10px, and lg has 12px. `space` has no 10px step, which is the same reason Button uses a fixed height.
