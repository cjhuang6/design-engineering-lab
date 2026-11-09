# Button

A Button runs one action. It is a native `<button>` in `src/components/button/Button.jsx`, so it already has the button role. The visible label is the accessible name. Enter activates it. Space activates it. The browser does both. The component does not set `role="button"`.

Primary is the main action. Secondary is a quieter action on a surface, with the control shadow. Ghost is text with no fill until hover or press.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `variant` | `primary` | `primary`, `secondary`, `ghost` |
| `size` | `md` | `sm`, `md`, `lg` |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `children` | | The visible label. This is the accessible name |
| `type` | `button` | The native button type. Use `submit` to submit a form |
| other `<button>` attributes | | Passed through, including `onClick`, `className`, and `aria-disabled` |

`aria-disabled` is not its own prop. Pass the attribute.

## Example

```jsx
<Button variant="primary" size="md" onClick={save}>
  Save
</Button>
```

## Disabled or aria-disabled

Use `disabled` in the usual case. The button leaves the tab order and does not activate. A screen reader skips it.

Use `aria-disabled="true"` when the person still needs to land on the button, for example to reach the reason it cannot run. The button stays in the tab order, shows the focus ring from the keyboard, and does not run its action on click, Enter, or Space.

If both are set, native `disabled` wins. The browser will not focus the button.

## States

Rest, hover, pressed, keyboard focus, and disabled. Hover applies only for a fine pointer that can hover. The focus ring shows on `:focus-visible` and stays off after a click. Disabled and `aria-disabled="true"` use the disabled opacity. The button does not scale on press.

Pressed fills: primary uses `color/action/primary-pressed`. Secondary and ghost use `color/surface/secondary`. The plan named a pressed color for primary only. Secondary and ghost use the next surface color so the press is visible. Secondary keeps `shadow/control` while it is pressed, and uses `shadow/control-hover` only for hover.

## Tokens

| Part | Token |
|---|---|
| Height | `size/control/sm`, `size/control/md`, `size/control/lg` |
| Horizontal padding | `control/padding-inline/sm`, `control/padding-inline/md`, `control/padding-inline/lg` |
| Vertical padding | `space/0` |
| Radius | `radius/md` |
| Label | `label/md` |
| Primary rest | `color/action/primary`, `color/action/primary-text` |
| Primary hover | `color/action/primary-hover` |
| Primary pressed | `color/action/primary-pressed` |
| Secondary rest | `color/surface/primary`, `color/text/secondary`, `shadow/control` |
| Secondary hover | `shadow/control-hover` |
| Secondary pressed | `color/surface/secondary`, `shadow/control` |
| Ghost rest | transparent, `color/text/primary`, `shadow/none` |
| Ghost hover | `color/surface/subtle` |
| Ghost pressed | `color/surface/secondary` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on background, text color, and shadow |

Light and dark come from the semantic tokens. The page's `data-theme="dark"` switches them.
