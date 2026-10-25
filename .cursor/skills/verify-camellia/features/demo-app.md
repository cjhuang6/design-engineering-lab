# Demo app

A developer runs a Vite + React page that lists the Camellia tokens from the generated CSS. Colors, spacing, radius, typography, and the other token groups render with those custom properties. Typography renders in Geist and Geist Mono, which the page loads. A theme button sets `[data-theme="dark"]` on the document. The page is not part of the token pipeline roadmap.

## Sub-features

- `demo-dev` serves the page locally with hot reload.
- `demo-build` produces a production build in the root `dist/`.
- `demo-theme` switches the page between light and dark.

## How to get to it (user POV)

- `npm run dev`, then open the URL Vite prints.
- `npm run build`.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Production build.** Run `npm run build`. Vite reports the built files. Exit code `0`.
- **Dev server.** Run `npm run dev`. Vite prints a local URL. Opening it shows one heading, "Camellia tokens", grouped token samples, and a button labeled "Use dark theme" or "Use light theme". Activating the button switches the theme text between "Showing light theme." and "Showing dark theme." Stop the server with Ctrl+C.

## Gotchas

- A successful build proves the app compiles, not that it renders correctly. There are no browser tests.
- `dist/` is generated and ignored by Git.
- The page reads names from `src/styles/tokens.css`. It does not edit that file.
- The page loads Geist and Geist Mono, so the typography samples use those families even when they are not installed on the machine.
