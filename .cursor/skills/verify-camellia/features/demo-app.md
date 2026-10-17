# Demo app

A developer runs a Vite + React page that renders the Profile Card using the generated token CSS. It isn't part of the token pipeline roadmap. Ignore it for foundation work unless CJ asks.

## Sub-features

- `demo-dev` serves the page locally with hot reload.
- `demo-build` produces a production build in the root `dist/`.

## How to get to it (user POV)

- `npm run dev`, then open the URL Vite prints.
- `npm run build`.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Production build.** Run `npm run build`. Vite reports the built files. Exit code `0`.
- **Dev server.** Run `npm run dev`. Vite prints a local URL, and opening it shows the Profile Card. Stop the server with Ctrl+C.

## Gotchas

- A successful build proves the app compiles, not that it renders correctly. There are no behavioral tests.
- `dist/` is generated and ignored by Git.
