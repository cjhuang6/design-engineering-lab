# Figma plugin build

A developer type-checks the Camellia Figma Sync plugin, runs its tests, and bundles it into the single JavaScript file that Figma runs. The token JSON is bundled in at build time, so Figma only sees JSON changes after a rebuild. If the type check or any test fails, nothing is bundled.

## Sub-features

- `plugin-typecheck` type-checks the plugin against the Figma typings.
- `plugin-tests` runs 27 tests: the primitives plan built from the real JSON, and the sync against a fake Figma.
- `plugin-bundle` writes `figma-plugin/dist/code.js` with the token JSON included.
- `plugin-gate` skips bundling when the type check or a test fails.

## How to get to it (user POV)

- `npm run figma:build` runs the type check, the tests and the bundle, in that order.
- `npm test` runs the tests only.
- `npm run figma:typecheck` runs the type check only.

## Driving it with the terminal

Preconditions:

- Dependencies are installed.

- **Full build.** Run `npm run figma:build`. The output includes `ℹ tests 27`, `ℹ pass 27` and `ℹ fail 0`, then `figma-plugin/dist/code.js` at about 76 KB. Exit code `0`.
- **Tests only.** Run `npm test`. `ℹ pass 27`, `ℹ fail 0`. Exit code `0`.
- **Gate holds.** Only when proving the gate: temporarily break one expected value in a test, run `npm run figma:build`, and confirm it fails without printing the `code.js` line. Revert the test and rebuild.

## Gotchas

- `figma-plugin/dist/` is ignored by Git. A fresh checkout must build before Figma can run the plugin.
- Passing tests prove the plugin's logic against a hand-written fake of the Figma API, not Figma's real behavior.
- The tests import `.ts` files directly, which needs Node 24 or later.
