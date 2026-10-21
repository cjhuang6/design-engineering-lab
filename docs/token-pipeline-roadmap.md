# Camellia token pipeline roadmap

This is the single roadmap for the Camellia token pipeline: approved phases, their order and scope, decisions, progress, and open questions. Only CJ can approve changes to it (see [AGENTS.md](../AGENTS.md#authorization-and-autonomy)).

What already works today, and how to exercise it, lives in the [feature map](../.cursor/skills/verify-camellia/features/README.md). How to obtain evidence lives in [verification](verification.md). Design intent (principles, palette, type scale) lives in the [design system spec](camellia-design-system-v0.1.md).

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

## Current status

| | |
|---|---|
| Phases complete | 2A and 2B (Observed: merged to `main` in [PR #5](https://github.com/cjhuang6/design-engineering-lab/pull/5), merge commit `6f4058f`). Phase 2C build PRs 1–3 are merged ([PR #11](https://github.com/cjhuang6/design-engineering-lab/pull/11), [PR #12](https://github.com/cjhuang6/design-engineering-lab/pull/12), [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14)). Desktop verification of 2C is not done |
| Current phase | 2C, Semantic Light/Dark sync, plus rename-safe ids for the 41 semantic tokens. The ids are in this change. Figma has not run them |
| **Next agreed task** | **CJ runs the [Semantic desktop checklist](../.cursor/skills/verify-camellia/features/figma-semantic-sync.md),** including the permanent-id migration and one JSON rename. Do not start [primitive ids](#add-permanent-ids-to-primitives-too-deferred) or Phase 2D from this line alone |
| Figma file state | Observed 2026-10-13: one `Primitives` collection with 110 variables and one `Value` mode; no other collections or styles. Test rectangle `61:117` is bound to `feedback/success` and `radius/xl` |

## Architecture (Approved)

```text
tokens/camellia.tokens.json   ← the only authored token source (DTCG)
        |
   +----+-----------------+
   v                      v
CSS pipeline         Figma sync plugin
   |                      |
   v                      v
src/styles/tokens.css   Figma variables and styles
```

- Tokens are layered **primitive → semantic → component**.
- **Sync direction is one-way: DTCG to CSS and DTCG to Figma.** Generated CSS and Figma variables are never independent sources of truth. When Figma conflicts with the JSON, the JSON wins.
- **Parity means the same intent and value on every platform, not the same kind of object.** Use the native type on each platform: color becomes a CSS custom property and a Figma COLOR variable; typography becomes CSS font variables and a Figma Text Style; shadow becomes a CSS `box-shadow` and a Figma Effect Style; Frost becomes a CSS recipe and Figma variables plus an Effect Style; expression fields become a CSS gradient and a Figma Paint Style.
- Do not create fake Figma STRING variables just to force a one-to-one mapping with CSS.
- When the DTCG and Figma models differ, write an adapter in the plugin. Do not add Figma-specific assumptions to the canonical schema without a strong architectural reason and CJ's approval.
- The CSS pipeline uses Style Dictionary with a custom formatter. Do not redesign it unless CJ asks.

## Rules for every sync phase (Approved)

- Syncing must be idempotent: running it twice produces no duplicates.
- Update existing variables and styles in place, preserving their IDs, so Figma layers stay bound to them.
- Create what is missing. Never delete everything and recreate it.
- Report variables that exist only in Figma; never delete them (decided 2026-10-13).
- Recognise a primitive by its name, e.g. `color/primitive/blue/600` (decided 2026-10-13). Recognise a semantic token by its permanent id (CJ, 2026-10-21; see [Rename-safe token IDs](#rename-safe-token-ids)). A file that was synced before those ids existed is adopted once from the old name tag.
- Set appropriate Figma scopes, and a WEB code syntax that maps to the CSS variable.
- Keep each phase independently testable. Stop at the end of each phase and wait for CJ's approval.

## Phases

### Phase 2A: plugin scaffold (complete)

- **Approved scope:** a local Figma development plugin built from this repo with TypeScript, esbuild and `@figma/plugin-typings`; it runs without modifying the file; no token sync.
- **Observed:** commit `61ade6f`. Imported and run in the Figma desktop app on 2026-10-13. The read-only Inventory command produced identical output on two runs.

### Phase 2B: primitive variable sync (complete)

- **Approved scope:** sync primitives into the `Primitives` collection, following the sync-phase rules.
- **Approved decisions (2026-10-13):**
  - Primitive colors are hidden from pickers (`scopes: []`). Feedback colors stay visible (`ALL_FILLS`, `STROKE_COLOR`) because they have no semantic layer.
  - Font family and weight are included as variables.
  - The JSON is bundled into the plugin at build time.
  - Terminal tests are written as plain `.mjs` with no new dependency.
  - Motion is included: `duration` becomes TIMING variables (in seconds) and `ease` becomes EASING variables (custom cubic-bezier).
  - CSS-only, with no Figma variable: `z`, `border.style`.
  - Excluded until later phases: `theme`, `layout`, `control` (2C); typography and `tracking` (2D); `shadow`, `frost` (2E); `expression` (2F).
- **Observed:** commit `9937929`.
  - 110 variables were created in a single `Value` mode.
  - A second run reported 0 created and 0 updated.
  - Spot checks by CJ: scopes, code syntax in Dev Mode, and opacity showing as 64%.
  - The binding-survival test passed in both directions on rectangle `61:117`: the same variable IDs were kept while the values changed and were restored.

### Phase 2C: Semantic Light/Dark sync (desktop verification pending)

- **Approved scope:**
  - A `Semantic` collection with modes `Light` and `Dark`.
  - Semantic variables **alias** primitives. For example, `color/action/primary` is `color/primitive/blue/600` in Light and `color/primitive/blue/400` in Dark.
  - Don't copy raw hex values where a primitive alias exists, so the alias graph preserves primitive → semantic.
  - Correct scopes and WEB code syntax.
  - Stop after validation.
  - Composite border tokens are deferred (CJ, 2026-10-20). See [open question 2](#open-questions).
- **Source data (Observed in the JSON):**
  - `theme.light.*` and `theme.dark.*` become one semantic name once the `theme/{mode}/` prefix is removed.
  - `layout.*` and `control.*` are mode-independent aliases of `space.*`. The JSON marks them for the Semantic collection, in both modes.
  - The collection and mode names come from `$extensions.com.cjhuang.camellia.targets.figma`.
- **Details:** see the [Phase 2C task brief](#phase-2c-task-brief).
- **Plan:** [Phase 2C implementation plan](plans/phase-2c-semantic-sync.md). Decisions 1–5 there were approved by CJ on 2026-10-20. Build PRs 1–3 are merged (PR #11, PR #12, PR #14). The plan's variable-identity section stored the Figma path in plugin data. [Rename-safe token IDs](#rename-safe-token-ids) replaces that for semantic tokens. Nothing in 2C has been run in Figma yet.

### Rename-safe token IDs

Not a phase. CJ approved the semantic-token JSON change on 2026-10-21. This change adds those ids and teaches semantic sync to match on them. **Observed** against the fake Figma: a JSON rename keeps the variable id, and migration from the legacy name tag creates 0 and deletes 0. **Not observed in Figma** until CJ runs the checklist.

- Every semantic token leaf under `theme.light` and `theme.dark` has `"$extensions": { "com.cjhuang.camellia": { "id": "sem-xxxxxx" } }`. The light and dark leaves of the same path share one id, because together they are one Figma variable with Light and Dark modes. `layout` and `control` leaves have an id too: they are 15 of the 41 semantic variables, and each leaf is already one variable. The eight composite border leaves have ids as well and are still not created as Figma variables.
- An id is `sem-` plus 6 lowercase hex characters, chosen once. It is the token's identity. It is not a Figma setting, so it does not sit under a key with `figma` in the name.
- Semantic sync stores the id with shared plugin data, namespace `com.cjhuang.camellia` and key `id`, and matches that first. Private plugin data throws in the Figma connector runtime, and it is dropped if the plugin id changes. Shared data works in the desktop app and in the connector, and it stays if the plugin is published. Other plugins can read it. The id is not a secret.
- A file synced before this change has private plugin data `token` set to the variable's name and no shared id. The sync adopts, in order: a variable whose shared id matches; otherwise the variable whose private `token` equals the token's current name; otherwise an untagged variable with that name. It writes the shared id. It clears the private `token` only when that API works, and a failure there does not fail the sync. Renaming the JSON path before that migration does not match the old name tag: the old variable stays, and a new one is created. The sync still refuses a rename that would collide with a different variable's name, and it still never deletes a variable.
- A renamed path that stays in the same group (for example `color/action/primary` to `color/action/main`) keeps that group's picker scopes. A path that fits no group still fails the plan.
- Phases 2D–2G stay as approved. This item does not replace them.

### Add permanent IDs to primitives too (deferred)

Not started. Do not implement unless CJ asks.

- Primitive variables still match by their visible name, for example `color/primitive/blue/600`. They have no permanent id, and primitive sync does not read plugin data.
- The idea is the same as the semantic ids, applied to the `Primitives` collection. It is a separate later change.

### Phase 2D: Text Styles

- **Approved scope:**
  - Real Figma Text Styles generated from the DTCG typography tokens: `Camellia/Display/LG`, `Camellia/Display/SM`, `Camellia/Heading/XL`, `Camellia/Heading/LG`, `Camellia/Heading/MD`, `Camellia/Heading/SM`, `Camellia/Body/LG`, `Camellia/Body/MD`, `Camellia/Body/SM`, `Camellia/Label/MD`, `Camellia/Label/SM`, `Camellia/Code/MD`, `Camellia/Code/SM`.
  - Use Geist and Geist Mono, with the intended tracking.
  - No fake STRING variables.
  - Stop after validation.
- **Approved (2026-10-13):** tracking is applied as a percentage letter spacing in the styles, because em ratios can't be pixel variables.

### Phase 2E: Effect Styles

- **Approved scope:**
  - Shadow styles: `none`, `sm`, `md`, `lg`.
  - Frost styles: `light/subtle`, `light/strong`, `dark/subtle`, `dark/strong`.
  - Keep Shadow and Frost conceptually separate.
  - The goal is recipe and intent parity with CSS `backdrop-filter`, not identical pixels.
  - Stop after validation.

### Phase 2F: Expression Paint Styles

- **Approved scope:**
  - Paint Styles `Camellia/Expression/Ice`, `Camellia/Expression/Tropical` and `Camellia/Expression/Pink Dream`.
  - They are for atmospheric backgrounds, branding imagery, visual experiments and future AI-assisted assets. **They are not default component fills** (Background = expressive, Surface = restrained).
  - Stop after validation.

### Phase 2G: Figma validation and audit

- **Approved scope:** a reliable expected-versus-actual report, for example:

  ```text
  Camellia Figma Sync

  Primitives       X/X
  Semantic         X/X
  Text Styles      X/X
  Shadow Styles    X/X
  Frost Styles     X/X
  Paint Styles     X/X

  PASS
  ```

- It catches missing or duplicate variables, wrong mode counts, incorrect semantic aliases, wrong values, wrong scopes, missing code syntax, and missing text, effect or paint styles.
- The audit never fixes anything. Fixes happen only when CJ runs a sync command.

### Phase 3: designer review workflow (Figma to DTCG) — do not build during Phase 2

- **Approved intent:**
  1. DTCG syncs to Figma.
  2. CJ explores in Figma, possibly changing tokens there temporarily. Those changes never become canonical automatically.
  3. When a change should become official, an "Export Changes" or "Review Drift" command compares Figma with DTCG and produces a change report or DTCG patch.
  4. CJ reviews and applies the patch in Cursor, commits it, regenerates the CSS, and re-syncs Figma.
- No fully automatic two-way sync. Figma is the exploration environment; DTCG stays the approved source of truth.

### Phase 4: component system — do not build yet

- **Approved intent:** only after the foundations are stable.
- Button is the likely first validation component: it exercises color, typography, spacing, radius, states, focus, dark mode and motion.
- Future parity looks like Figma `Button` (`Style=Primary`, `Size=MD`, `State=Default`) mapping to React `<Button variant="primary" size="md" />`. Figma Code Connect gets evaluated at that point.
- The React demo is a token reference page (CJ, 2026-10-17), not a component. Component implementation still waits for this phase.

## Phase 2C task brief

This is the starting summary for the next agent. It contains approved facts. The design is the [Phase 2C implementation plan](plans/phase-2c-semantic-sync.md). CJ approved decisions 1–5 on 2026-10-20. Build PRs 1–3 are merged. None of 2C has been run in Figma. Semantic tokens now have permanent ids ([Rename-safe token IDs](#rename-safe-token-ids)). Do not start [primitive ids](#add-permanent-ids-to-primitives-too-deferred) or Phase 2D unless CJ asks.

- **Phase:** 2C, Semantic Light/Dark sync.
- **Scope:** the approved scope above, plus the rules for every sync phase. Out of scope: text, effect and paint styles; the audit; component tokens. Permanent semantic ids are a separate approved change and are already in the JSON.
- **Acceptance criteria (Approved):**
  1. One `Semantic` collection exists with exactly the modes `Light` and `Dark`.
  2. Each semantic variable's mode values are aliases to the matching primitives, not raw values, wherever a primitive exists.
  3. Scopes and WEB code syntax are correct; the code syntax names exist in `src/styles/tokens.css`.
  4. A second run creates nothing and updates nothing.
  5. Layers bound to semantic variables stay bound across value changes.
- **Verification plan (Proposal, mirroring 2B):** unit tests for the plan, sync tests against the fake Figma, then CJ runs the [Semantic desktop checklist](../.cursor/skills/verify-camellia/features/figma-semantic-sync.md), including both modes, the translucent dark aliases, the spacing pickers, a Figma-side rename, and a binding-survival test on a semantic variable.
- **Design questions:** 2, 3, and 5 were decided by CJ on 2026-10-20. See [open questions](#open-questions) and the [plan](plans/phase-2c-semantic-sync.md). Question 4 (whether dark alpha aliases look translucent in Figma) stays unknown until the desktop checklist.
- **Workflow:** follow the [implement/verify handoff](verification.md#implementverify-handoff). The 2C plan is the first planned trial of that handoff.

## Open questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | **Renaming tokens safely.** Semantic tokens now have a permanent id in `$extensions.com.cjhuang.camellia.id` (CJ, 2026-10-21). Sync matches shared plugin data `com.cjhuang.camellia` / `id`, so a JSON rename renames the same variable. A file synced under the old private name tag is migrated once. Private plugin data throws in the connector runtime (observed 2026-10-21). Whether a bound layer stays bound after a JSON rename is still a desktop check. Primitives still match by name ([deferred](#add-permanent-ids-to-primitives-too-deferred)) | Approved for semantic tokens. Unknown in Figma until the checklist. Deferred for primitives | Primitive renames |
| 2 | **Composite border tokens, deferred** (CJ, 2026-10-20). The eight tokens `theme.light.border` and `theme.dark.border` × `subtle`, `default`, `strong`, and `focus` are not created as Figma variables in 2C. Each value is a color, a width, and a style. Figma variables have no type for that composite, so a color variable would not be the token. The color syncs as `color/border/*` and `color/focus`; `border/width/*` already syncs in Primitives; `border.style` stays CSS-only. Unblocked when a later phase has a Figma object that can carry color, width, and style together | Approved (deferred) | Does not block 2C. Blocks a Figma form of the border shorthand |
| 3 | **Semantic scopes.** Text as `TEXT_FILL`, surfaces as `FRAME_FILL`/`SHAPE_FILL`, borders and focus as `STROKE_COLOR`, icons as `SHAPE_FILL`, layout and control as `GAP`. Full table in the [2C plan](plans/phase-2c-semantic-sync.md) | Approved (CJ, 2026-10-20) | Nothing |
| 4 | **Dark aliases to alpha primitives** (e.g. `color/border/subtle` → `alpha/blue-400/18`). Plain aliasing should work; not yet verified in Figma | Unknown | 2C verification |
| 5 | **Feedback colors have no semantic Light/Dark layer.** They stay in `Primitives`, visible in pickers. The spec lists them as single accents, and the JSON has no `theme.*.feedback` | Approved (CJ, 2026-10-20) | Nothing |
| 6 | **Section 20 ("CSS starter mapping") of the design system spec** is a hand-written CSS block that predates the generated `tokens.css`. The JSON is canonical, so it is at least historical. Remove it, label it, or keep it? | Unknown | Nothing; risks a duplicate source |
| 7 | **The design spec's "Components" collection and Profile Card component tokens** aren't in the JSON (`componentTokensIncluded: false`). Deferred to Phase 4? | Unknown | Phase 4 |
| 8 | **Motion variables in actual use.** EASING and TIMING variables were created (Observed), but binding them to Figma Motion keyframes was not verified. The Figma Motion API is in Beta | Unknown | Nothing yet |
| 9 | **Text Styles binding to the font family and weight variables** in 2D | Unknown | 2D plan |
| 10 | **Existing explanatory comments.** The CSS scripts and the plugin carry many explanatory comments that predate the no-comments default in AGENTS.md. They stay until CJ asks for a cleanup; new code follows the default | Approved (deferred) | Nothing |
| 11 | **Lint coverage.** ESLint only covers `.js`/`.jsx`, so the plugin's `.ts` files and the `.mjs` scripts aren't linted. Covering TypeScript needs a new dependency (e.g. `typescript-eslint`), which requires CJ's approval | Proposal | Nothing |
| 12 | **AGENTS.md has no local block.** CJ decided on 2026-10-17 to remove the Cursor hook: its false positives interrupted autonomous runs, and it could be bypassed. A local edit takes effect for agents in that checkout immediately, but can't reach `main` without CJ's approval comment. See [AGENTS.md protection](verification.md#agentsmd-protection) | Approved | Nothing |
