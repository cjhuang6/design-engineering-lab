# Demo app

A developer runs a Vite + React page that lists the Camellia tokens from the generated CSS, and tries the proximity hex color picker. The picker is shown in a detail layout: a dark stage with the honeycomb centered, and a panel with the component name, a short description, and Radius, Scale, and Darken controls. Colors, spacing, radius, typography, and the other token groups render with those custom properties. Typography renders in Geist and Geist Mono, which the page loads. A theme button sets `[data-theme="dark"]` on the document. The page is not part of the token pipeline roadmap.

## Sub-features

- `demo-dev` serves the page locally with hot reload.
- `demo-build` produces a production build in the root `dist/`.
- `demo-theme` switches the page between light and dark.
- `demo-picker` shows the proximity hex color picker at the top of the page, in a stage beside Radius, Scale, and Darken controls. Darken starts at 0.

## How to get to it (user POV)

- `npm run dev`, then open the URL Vite prints.
- `npm run build`.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Production build.** Run `npm run build`. Vite reports the built files. Exit code `0`.
- **Dev server.** Run `npm run dev`. Vite prints a local URL. Opening it shows the heading "Camellia Design System", a short line that one token file drives CSS and Figma, a "Color picker" section, and a button labeled "Use dark theme" or "Use light theme". The section has a stage with the honeycomb and a panel titled "Hex color picker". The panel's controls read Radius 80px, Scale 1.15×, and Darken 0.00, and a Reset button restores those values. The picker starts on Blue 600. The card stays the same width when the selected label changes. On a narrow viewport the panel stacks under the stage. Arrow keys move to a neighboring cell and select it. Enter or Space on "Token reference" opens the catalog. Activating the theme button switches the theme text between "Showing light theme." and "Showing dark theme." Stop the server with Ctrl+C.

## Gotchas

- A successful build proves the app compiles, not that it renders correctly. There are no browser tests. The picker model tests do not move the pointer or run the idle timers.
- The picker's card width follows the honeycomb. Readout text that does not fit ends in an ellipsis. The full string stays in the element and in its title.
- Darken starts at 0, so cells near the pointer grow and do not get a brightness filter. Raising Darken sets `--hex-picker-darken`. Radius and Scale set `--hex-picker-radius` and `--hex-picker-scale-hover`. Changing a control while the pointer is over the honeycomb updates the effect without remounting the picker.
- On a narrow viewport the panel stacks under the stage.
- `prefers-reduced-motion: reduce` leaves the picker still: no proximity, no press dip, and no breath. If a breath is in progress when reduced motion turns on, the mark eases back to rest over 200ms and then stays still. Otherwise the selected mark is already in its final state.
- `dist/` is generated and ignored by Git.
- The page reads names from `src/styles/tokens.css`. It does not edit that file.
- The page loads Geist and Geist Mono, so the typography samples use those families even when they are not installed on the machine.
