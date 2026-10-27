# Camellia verification map

This directory is the maintained source for what Camellia can do today and how to prove it. Read this index before driving anything, then use the matching feature file as the recipe. Planned work is in the [project roadmap](../../../../docs/roadmap.md), not here.

**Last verified against revision:** `5a6653e`, on 2026-10-17 for the terminal checks and the demo page. **Observed** (CJ's report from Figma desktop on his real Camellia file, 2026-10-21): he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed. The same day, semantic permanent-id migration on that file reported 0 created and 41 updated for the dry run and the sync, a rerun reported 41 unchanged, and rectangle `61:117` stayed bound. **Observed** the same way on 2026-10-22: he ran the primitives desktop checklist and every check passed. Inventory showed 151 variables (110 in `Primitives` and 41 in `Semantic`). The dry run would create 0 and update 110, the sync created 0 and updated 110, a rerun created 0 and updated 0, and rectangle `61:117` stayed bound. All 151 variables are tagged with permanent ids. Primitive permanent ids are merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`). A connector test on a scratch Figma file, not CJ's file, also passed for that pull request on 2026-10-21: 0 created and 110 updated, a rerun 110 unchanged, and renaming `blue/600` renamed the same variable. That scratch run is not the desktop check of his file. The Text Style commands are in the plugin menu. [Figma Text Style sync](./figma-text-styles-sync.md) is the desktop checklist. It has not been run. **Observed** 2026-10-25 in headless Chrome, on a machine where Geist and Geist Mono are not installed: revision `994eeb7` loads the self-hosted files. `document.fonts` reports both faces loaded, the heading, the theme button, a body sample, and a code sample render in those families, and a production build with base `/design-engineering-lab/` requests both font files from that path with no failed requests. **Observed** the same day in headless Chrome: the picker card is the same width for White, Green 900, and no selection, and a longer readout ends in an ellipsis without widening the card. Darken starts at 0 and paints no brightness filter until the control is raised. Changing Scale, Darken, or Radius while the pointer is over the honeycomb updates the effect without remounting. `prefers-reduced-motion: reduce` still leaves the cells still. **Observed** 2026-10-26 in headless Chrome, revision `d84412e`: Blocks shows one hex color picker card. Its name is text, and the open button carries the name. Escape, the scrim, and Close return focus to that button. The card background stays the same through the move, the component scales evenly, and the grid slot keeps its height. At 390px the panel stacks under the card with no horizontal scroll. Reduced motion snaps the card and fades the panel. Tokens and Pipeline open from the text links. **Observed** 2026-10-27 in headless Chrome, revision `66890a3`: below 640px the feed is one column and the details panel is absent until a card opens. The open card pins to the top and the panel fills to the bottom inset. At 375×667 the Controls list scrolls while the card and panel stay put. Close returns focus to the open button and restores a saved page scroll offset. At 1280×800 the card and panel keep the side-by-side frame. Reset is quiet text on the Controls row; hovering it shows a pill whose right edge lines up with the slider values. From 640px to 960px the panel still stacks under the card. Real iOS Safari was not run. **Observed** 2026-10-27 in headless Chrome, revision `b95bf5e`: Blocks shows the hex color picker and the security code. At 1280×800, at 820×1180 with touch, and at 390×844, in light and dark, the reel frames stay put while the flaps turn and the page does not scroll sideways. The Copy code button's fill grows in steps for Retro and drains for Smooth. Countdown stays in the controls list and is disabled while Retro is selected. A coarse pointer's Fill style segments are 44px tall. Reduced motion does not rotate the flaps. Copy keeps the button width, the visible label becomes Copied, and the accessible name stays Copy code.

## Baseline preconditions

- Node.js 22.18 or later, with dependencies installed by `npm ci`.
- Commands run from the repository root, on the revision under test.
- For Figma: the Figma desktop app, the Camellia file `QT8VkiGlF7xo4Ky5TAliOh` open with edit access, and the plugin imported from `figma-plugin/manifest.json`.
- The bundled token JSON matches the checkout: run `npm run figma:build` after any JSON change.

## Driving conventions

- Start every recipe from a clean checkout of the revision under test unless its preconditions say otherwise.
- Treat every command, menu path and console string as literal.
- Agents run terminal recipes themselves. Figma recipes are run by CJ, who reports the console lines back.
- An agent never writes to Figma unless the task explicitly authorizes it.
- Restore any temporary token change after a mutation test.

## Proof and skip reporting

- Terminal proof: the command, its output summary and its exit code.
- Figma proof: the console summary line, any per-variable lines, and CJ's confirmation of the file state.
- Record the feature file and entry point used with each proof.
- Report a skipped entry point as skipped, with the unmet precondition. Never report it as verified through a different path.
- Tests against the fake Figma are not proof of Figma behavior.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections, in this order:

1. `Sub-features` lists short IDs, with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with <harness>` starts with `Preconditions:`, then pairs each action with an exact command and its observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the feature files. Source locations appear only in the list below, so agents can find the code.

## Features

- [CSS tokens](./css-tokens.md) covers building `src/styles/tokens.css` from the token JSON and validating it. Code: `scripts/tokens/build-css.mjs`, `scripts/tokens/check-css.mjs`.
- [Figma plugin build](./figma-plugin-build.md) covers the type check, the tests and the bundle. Code: `figma-plugin/tsconfig.json`, `figma-plugin/tests/`.
- [Figma Inventory](./figma-inventory.md) covers the read-only inventory command. Code: `figma-plugin/code.ts`, `figma-plugin/manifest.json`.
- [Figma Primitives sync](./figma-primitives-sync.md) covers the dry run, the sync, idempotency, migration onto permanent ids, a JSON rename, and binding survival. Code: `figma-plugin/src/dtcg.ts`, `figma-plugin/src/plan-primitives.ts`, `figma-plugin/src/sync-primitives.ts`.
- [Figma Semantic sync](./figma-semantic-sync.md) covers the dry run, the sync, both modes, idempotency, a Figma-side rename, migration onto permanent ids, a JSON rename, and binding survival. Code: `figma-plugin/code.ts`, `figma-plugin/manifest.json`, `figma-plugin/src/plan-semantic.ts`, `figma-plugin/src/sync-semantic.ts`.
- [Figma Text Style sync](./figma-text-styles-sync.md) covers the dry run, the sync, idempotency, and the desktop checks that are still open assumptions. Code: `figma-plugin/code.ts`, `figma-plugin/manifest.json`, `figma-plugin/src/plan-text-styles.ts`, `figma-plugin/src/sync-text-styles.ts`, `figma-plugin/src/text-style-command.ts`.
- [Demo app](./demo-app.md) covers the Vite + React showcase: Blocks, Tokens, and Pipeline, the masonry of components, the proximity hex color picker, and the security-code generator. Code: `src/App.jsx`, `src/parseTokenCss.js`, `src/styles/fonts.css`, `src/styles/global.css`, `src/showcase/Showcase.jsx`, `src/showcase/showcase.css`, `src/showcase/layout.js`, `src/showcase/catalog.js`, `src/showcase/blocks.jsx`, `src/showcase/controls.jsx`, `src/showcase/slot-controls.jsx`, `src/components/hex-color-picker/HexColorPicker.jsx`, `src/components/hex-color-picker/HexColorPicker.css`, `src/components/hex-color-picker/model.js`, `src/components/slot-code/SlotCode.jsx`, `src/components/slot-code/SlotCode.css`, `src/components/slot-code/model.js`.

Update the affected feature file in the same change that alters a feature's behavior or entry point, and update the revision line above.
