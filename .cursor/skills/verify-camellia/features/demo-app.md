# Demo app

A developer runs a Vite + React page that lists the Camellia tokens from the generated CSS, and tries the proximity hex color picker. Colors, spacing, radius, typography, and the other token groups render with those custom properties. Typography renders in Geist and Geist Mono, which the page loads. A theme button sets `[data-theme="dark"]` on the document. The page is not part of the token pipeline roadmap.

## Sub-features

- `demo-dev` serves the page locally with hot reload.
- `demo-build` produces a production build in the root `dist/`.
- `demo-theme` switches the page between light and dark.
- `demo-picker` shows the proximity hex color picker at the top of the page.

## How to get to it (user POV)

- `npm run dev`, then open the URL Vite prints.
- `npm run build`.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Production build.** Run `npm run build`. Vite reports the built files. Exit code `0`.
- **Dev server.** Run `npm run dev`. Vite prints a local URL. Opening it shows the heading "Camellia Design System", a short line that one token file drives CSS and Figma, a "Color picker" section with the honeycomb, and a button labeled "Use dark theme" or "Use light theme". The token catalog is a closed "Token reference" disclosure under the picker. Activating the button switches the theme text between "Showing light theme." and "Showing dark theme." The picker starts on Blue 600. Arrow keys move to a neighboring cell and select it. Enter or Space on "Token reference" opens the catalog. Stop the server with Ctrl+C.

## Gotchas

- A successful build proves the app compiles, not that it renders correctly. There are no browser tests. The picker model tests do not move the pointer or run the idle timers.
- `prefers-reduced-motion: reduce` leaves the picker still: no proximity, no press dip, and no breath. The selected mark appears in its final state.
- `dist/` is generated and ignored by Git.
- The page reads names from `src/styles/tokens.css`. It does not edit that file.
- The page loads Geist and Geist Mono, so the typography samples use those families even when they are not installed on the machine.
