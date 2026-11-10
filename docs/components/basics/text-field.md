# TextField

A TextField collects one line of text. It is a native `<input>` in `src/components/text-field/TextField.jsx`, with a visible label tied to that input by `for` and `id`. The browser provides the text role, the caret, and the editing keys. The component does not set a role.

Help text and the error are optional. When they are present, `aria-describedby` points at them so a screen reader reads them with the field. The error is a polite live region. It is announced when it appears. It is not announced again on each keystroke while the same message stays up.

## Props

These names are the public contract.

| Prop | Default | What it accepts |
|---|---|---|
| `label` | | Required. The visible label. This is the accessible name |
| `hint` | | Optional help text. Tied with `aria-describedby` |
| `error` | | The message for the current value when that value breaks the screen's rule. Empty or omitted means the value is valid. The field decides when to show it |
| `size` | `md` | `sm`, `md`, `lg` |
| `disabled` | `false` | `true` sets the native `disabled` attribute |
| `required` | `false` | `true` sets the native `required` attribute |
| `type` | `text` | The native input type, such as `email` |
| `id` | generated | The input id. The label's `for` uses it |
| `value` | | Controlled value. Omit it to let the field hold the value |
| `defaultValue` | | Starting value for an uncontrolled field |
| `placeholder` | | Shown in `color/text/placeholder` |
| other `<input>` attributes | | Passed through, including `name`, `onChange`, `onBlur`, `autoComplete`, `inputMode`, `maxLength`, and `ref` |
| `className` | | Added on the field, not on the input |

`aria-invalid` and `aria-describedby` belong to the field. A passed value is not used.

A missing or blank `label` throws, so an unlabeled field does not render.

## Example

```jsx
<TextField
  label="Email"
  type="email"
  name="email"
  required
  placeholder="name@example.com"
  hint="We'll reply to this address."
  error={email.includes('@') ? '' : 'Enter an email address.'}
  value={email}
  onChange={(event) => setEmail(event.target.value)}
/>
```

The screen decides the rule. The example above treats a missing `@` as invalid. The field only decides when that message is visible.

## When the error shows

The message stays hidden while the person is typing, until the first blur or the first submit.

Leaving the field shows the message when the current value is invalid. Submitting the surrounding form does the same, and cancels that submit. A native `invalid` event, such as a required field left empty, does the same and suppresses the browser's tooltip so the message is not announced twice.

Once the message is visible, editing the value back to valid clears it immediately, including while the field still has focus. The next invalid value stays quiet until the next blur or submit.

Keep the message text stable while the value is still invalid. The live region speaks when that text changes. A message that includes the latest character would be read on every keystroke.

If `required` is set, the value is empty, and `error` is empty, the field shows "Fill in this field." A passed `error` replaces that sentence.

## Disabled

Use `disabled` in the usual case. The input leaves the tab order, and the field uses the disabled opacity. An error is not shown while the field is disabled.

## States

Rest, hover, keyboard focus, disabled, and error. A filled field is a field with a value. It does not get a separate color. There is no success state.

Hover applies only for a fine pointer that can hover. The focus ring uses the same outline as Button, on `:focus-visible`. A text input shows that ring after a click as well as after a keyboard arrival. That is how `:focus-visible` treats text fields. Focus does not also recolor the border. Disabled uses the disabled opacity. The field does not scale.

## Tokens

| Part | Token |
|---|---|
| Height | `size/control/sm`, `size/control/md`, `size/control/lg` |
| Horizontal padding | `control/padding-inline/sm`, `control/padding-inline/md`, `control/padding-inline/lg` |
| Vertical padding | `space/0` |
| Border | `border/width/1`, `border/style/solid`, `color/border/default`, `radius/md` |
| Fill and text | `color/surface/primary`, `color/text/primary`, `body/md` |
| Placeholder | `color/text/placeholder` |
| Label and hint | `label/sm`, `color/text/secondary` |
| Hover border | `color/border/strong` |
| Error border and error text | `feedback/error`, type `label/sm` |
| Disabled | `opacity/disabled` |
| Focus | `border/focus`, offset `border/width/2` |
| Coarse hit area | `size/touch-target` |
| Motion | `duration/fast`, `ease/standard`, on color, border, and shadow |

`feedback/error` is the same red in light and dark. Light and dark for the other colors come from the semantic tokens. The page's `data-theme="dark"` switches them.

The drawn height stays the control size. On a coarse pointer the hit area around the input is at least `size/touch-target`. `sm` is 32px and `md` is 40px, so that area is taller than the box. `lg` is already 48px.
