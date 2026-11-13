# Card

A card is a surface other components sit on. It is a `div` in `src/components/card/Card.jsx`. It is not a control. A card that is also a link or a button is a different component. Choose Card when the job is a box. Choose Button, Switch, or Checkbox when the job is an action or a choice.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `children` | | What sits on the card |
| `className` | | Added on the `div`, after `camellia-card` |
| other `<div>` attributes | | Passed through, including `id` |

`ref` reaches the `div`. This repo uses React 19, so `ref` is a normal prop and Card passes it through.

Card sets no `role`.

## Example

```jsx
<Card>
  <p>Notifications</p>
  <Switch defaultChecked>Email</Switch>
  <Switch>Push</Switch>
  <Button type="button" variant="primary" size="md">Save</Button>
</Card>
```

Email starts on. Push starts off. Save is a primary Button at `md`. The click handler belongs on the Button. The demo stacks those pieces. Card does not set gap, width, or flex.

## States

Rest only, in light and dark.

The card has no hover, focus, pressed, or disabled style. It has no motion.

## Tokens

| Part | Token |
|---|---|
| Fill | `color/surface/primary` |
| Text | `color/text/primary` |
| Padding | `space/4` |
| Radius | `radius/lg` |
| Shadow | `shadow/raised` |

There is no border. `shadow/raised` already includes a 1px ring, so a border would draw a second edge. The page canvas is `color/background/canvas`.

Measured contrast for these pairs.

| Pair | Light | Dark |
|---|---|---|
| `color/text/primary` on `color/surface/primary` | 17.49:1 | 18.40:1 |
| `color/surface/primary` on `color/background/canvas` | 1:1 | 1.11:1 |
| `shadow/raised` hairline on `color/background/canvas` | 1.13:1 | 1.17:1 |

The light hairline is the first shadow layer `rgba(8, 17, 31, 0.06)` composited on white. The dark hairline is `rgba(255, 255, 255, 0.09)` composited on black. Text clears 4.5:1. The fill and the ring sit under 3:1 against the canvas. In light both the fill and the canvas are white, so the shadow is the edge. This component does not edit the token file.
