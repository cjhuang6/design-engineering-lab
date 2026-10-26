# Demo app

A developer runs a Vite + React page for the Camellia showcase. Text links at the top switch among Blocks, Tokens, and Pipeline. Blocks is a masonry of components. Each card is the component at its resting size. Hovering or focusing a card shows the component name and a button that opens its details. The details view is a dialog: the card moves to one shared size in the center, and a panel beside it (or below it on a narrow screen) shows the name, a short description, and that component's controls. The hex color picker is the component on the page. Tokens lists the generated custom properties and switches light and dark. Pipeline holds a short placeholder. Typography renders in Geist and Geist Mono, which the page loads. The page is not part of the token pipeline roadmap.

## Sub-features

- `demo-dev` serves the page locally with hot reload.
- `demo-build` produces a production build in the root `dist/`.
- `demo-nav` switches among Blocks, Tokens, and Pipeline from text links.
- `demo-masonry` lays the cards out in equal-width columns. A card's height is its resting size, and opening one does not reflow the grid.
- `demo-details` opens a component's details from its icon button, traps focus, and closes from Escape, the scrim, or the Close button, returning focus to the button that opened it.
- `demo-theme` switches the Tokens page between light and dark.
- `demo-picker` shows the proximity hex color picker inside its card. Its details panel has Radius, Scale, and Darken controls. Darken starts at 0.

## How to get to it (user POV)

- `npm run dev`, then open the URL Vite prints.
- `npm run build`.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Production build.** Run `npm run build`. Vite reports the built files. Exit code `0`. The same build with a base path, `npm run build -- --base=/design-engineering-lab/`, also exits `0`.
- **Dev server.** Run `npm run dev`. Vite prints a local URL. Opening it shows a navigation with the text links "Blocks", "Tokens", and "Pipeline", and no logo. Blocks is current. The page has one card, the hex color picker, starting on Blue 600. The card's name "Hex color picker" is not a link or a button. A button labeled "Open Hex color picker details" opens a dialog titled "Hex color picker". The dialog's controls read Radius 80px, Scale 1.15×, and Darken 0.00, and a Reset button restores those values. Escape, a click on the dimmed page, or the button labeled "Close" dismisses the dialog and returns focus to "Open Hex color picker details". The card's background does not fade while it moves. On a narrow viewport the panel stacks under the card. Arrow keys inside the picker move to a neighboring cell and select it. The Tokens link shows the heading "Camellia Design System", a short line that one token file drives CSS and Figma, and a button labeled "Use dark theme" or "Use light theme". Activating it switches the theme text between "Showing light theme." and "Showing dark theme." The Pipeline link shows the heading "Pipeline" and the sentence "A write-up of the token pipeline will live on this page." Stop the server with Ctrl+C.

## Gotchas

- A successful build proves the app compiles, not that it renders correctly. The showcase behavior tests run against a DOM stand-in, not a browser. The picker model tests do not move the pointer or run the idle timers.
- The picker's card width follows the honeycomb. Readout text that does not fit ends in an ellipsis. The full string stays in the element and in its title.
- Darken starts at 0, so cells near the pointer grow and do not get a brightness filter. Raising Darken sets `--hex-picker-darken`. Radius and Scale set `--hex-picker-radius` and `--hex-picker-scale-hover`. Changing a control while the pointer is over the honeycomb updates the effect without remounting the picker.
- Opening a card reserves the grid slot at the card's resting height, so the other cards stay put. Every open card uses one shared size derived from the viewport. The component inside scales evenly and stays centered.
- The name on the card is plain text with `aria-hidden`. The open button's label includes the name. The name and the button appear on hover or focus, and they stay visible when the device has no hover.
- `prefers-reduced-motion: reduce` leaves the picker still: no proximity, no press dip, and no breath. If a breath is in progress when reduced motion turns on, the mark eases back to rest over 200ms and then stays still. Otherwise the selected mark is already in its final state. In the showcase, reduced motion snaps the card into place and only fades the scrim and the panel.
- The theme control lives on the Tokens page. The navigation does not include it. The page still starts from the system's light or dark preference.
- `dist/` is generated and ignored by Git.
- The page reads names from `src/styles/tokens.css`. It does not edit that file.
- The page loads Geist and Geist Mono, so the typography samples use those families even when they are not installed on the machine.
