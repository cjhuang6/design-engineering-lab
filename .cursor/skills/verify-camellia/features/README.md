# Camellia verification map

This directory is the maintained source for what Camellia can do today and how to prove it. Read this index before driving anything, then use the matching feature file as the recipe. Planned work is in the [project roadmap](../../../../docs/roadmap.md), not here.

**Last verified against revision:** `5a6653e`, on 2026-10-17 for the terminal checks and the demo page. **Observed** (CJ's report from Figma desktop on his real Camellia file, 2026-10-21): he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed. The same day, semantic permanent-id migration on that file reported 0 created and 41 updated for the dry run and the sync, a rerun reported 41 unchanged, and rectangle `61:117` stayed bound. **Observed** the same way on 2026-10-22: he ran the primitives desktop checklist and every check passed. Inventory showed 151 variables (110 in `Primitives` and 41 in `Semantic`). The dry run would create 0 and update 110, the sync created 0 and updated 110, a rerun created 0 and updated 0, and rectangle `61:117` stayed bound. All 151 variables are tagged with permanent ids. Primitive permanent ids are merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`). A connector test on a scratch Figma file, not CJ's file, also passed for that pull request on 2026-10-21: 0 created and 110 updated, a rerun 110 unchanged, and renaming `blue/600` renamed the same variable. That scratch run is not the desktop check of his file.

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
- [Demo app](./demo-app.md) covers the Vite + React token reference page. Code: `src/App.jsx`, `src/parseTokenCss.js`, `src/styles/global.css`.

Update the affected feature file in the same change that alters a feature's behavior or entry point, and update the revision line above.
