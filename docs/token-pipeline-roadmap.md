# Camellia token pipeline roadmap

**Project-wide current status and the next agreed task live in [docs/roadmap.md](roadmap.md).** [AGENTS.md](../AGENTS.md) sends agents there first. Read that file before you treat anything below as the next task. This file is the token-pipeline detail only.

This file is the detailed plan for the token pipeline: approved phases, their order and scope, decisions, and open questions. It does not state the next agreed task. Only CJ can approve changes to it (see [AGENTS.md](../AGENTS.md#authorization-and-autonomy)).

What already works today, and how to exercise it, lives in the [feature map](../.cursor/skills/verify-camellia/features/README.md). How to obtain evidence lives in [verification](verification.md). Design intent (principles, palette, type scale) lives in the [design system spec](camellia-design-system-v0.1.md). The project phase list lives in [docs/roadmap.md](roadmap.md).

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

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
- Recognise a primitive and a semantic token by its permanent id (CJ, 2026-10-21; see [Rename-safe token IDs](#rename-safe-token-ids)). A file synced before those ids existed is adopted once: primitives by the visible name, semantic tokens by the old private name tag. The visible name, for example `color/primitive/blue/600`, is still what you read in the variables table.
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

### Phase 2C: Semantic Light/Dark sync (desktop verification passed)

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
- **Plan:** [Phase 2C implementation plan](plans/phase-2c-semantic-sync.md). Decisions 1–5 there were approved by CJ on 2026-10-20. Build PRs 1–3 are merged (PR #11, PR #12, PR #14). The plan's variable-identity section stored the Figma path in plugin data, and it said primitives keep matching by name. [Rename-safe token IDs](#rename-safe-token-ids) replaces that for semantic tokens and for primitives. **Observed** 2026-10-21, evidence CJ's report from Figma desktop on his real Camellia file: he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed.

### Rename-safe token IDs

Not a phase. CJ approved the semantic-token JSON change on 2026-10-21, merged in [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15), and the primitive-token JSON change, merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (merge commit `fe3533b`, 2026-10-22). Semantic sync and primitive sync both match on those ids. **Observed** against the fake Figma: a JSON rename keeps the variable id, and migration creates 0 and deletes 0. **Observed** on CJ's real file, his report from Figma desktop: on 2026-10-21 the semantic migration dry run and sync each reported 0 created and 41 updated, a rerun reported 41 unchanged, and rectangle `61:117` stayed bound. On 2026-10-22 the primitives desktop checklist passed. Inventory showed 151 variables (110 Primitives plus 41 Semantic), the dry run would create 0 and update 110, the sync created 0 and updated 110, a rerun created 0 and updated 0, and rectangle `61:117` stayed bound. A JSON rename of a semantic token on that file is not in the report. Renaming `blue/600` so the same variable kept its id was observed on a scratch file, not CJ's file, on 2026-10-21.

- Every semantic token leaf under `theme.light` and `theme.dark` has `"$extensions": { "com.cjhuang.camellia": { "id": "sem-xxxxxx" } }`. The light and dark leaves of the same path share one id, because together they are one Figma variable with Light and Dark modes. `layout` and `control` leaves have an id too: they are 15 of the 41 semantic variables, and each leaf is already one variable. The eight composite border leaves have ids as well and are still not created as Figma variables.
- An id is `sem-` plus 6 lowercase hex characters, chosen once. It is the token's identity. It is not a Figma setting, so it does not sit under a key with `figma` in the name.
- Semantic sync stores the id with shared plugin data, namespace `com.cjhuang.camellia` and key `id`, and matches that first. Private plugin data throws in the Figma connector runtime, and it is dropped if the plugin id changes. Shared data works in the desktop app and in the connector, and it stays if the plugin is published. Other plugins can read it. The id is not a secret.
- A file synced before this change has private plugin data `token` set to the variable's name and no shared id. The sync adopts, in order: a variable whose shared id matches; otherwise the variable whose private `token` equals the token's current name; otherwise an untagged variable with that name. It writes the shared id. It clears the private `token` only when that API works, and a failure there does not fail the sync. Renaming the JSON path before that migration does not match the old name tag: the old variable stays, and a new one is created. The sync still refuses a rename that would collide with a different variable's name, and it still never deletes a variable.
- A renamed path that stays in the same group (for example `color/action/primary` to `color/action/main`) keeps that group's picker scopes. A path that fits no group still fails the plan.
- Phases 2D and 2E stay in scope. **Approved (2026-10-22):** 2D is next and 2E follows it. Phases 2F and 2G, and the designer-review workflow, are deferred until a component needs them. This item does not replace any of those phases.
- Primitive tokens have the same kind of id, with the prefix `prim-` instead of `sem-`. See the primitive paragraphs below. An id is unique across the whole file: a `prim-` id never equals a `sem-` id, and light/dark pairs are the only leaves that share an id (they are one semantic variable).

Every primitive token that becomes a Figma variable (110 of them) has `"$extensions": { "com.cjhuang.camellia": { "id": "prim-xxxxxx" } }`. Tokens that are not primitive variables (typography composites, shadow, frost, expression, `z`, `border.style`) do not get one. **Observed** in the JSON today. Whether the 13 typography tokens gain an id is a Phase 2D decision, and adding one is a token JSON change. See the [Phase 2D task brief](#phase-2d-task-brief). Semantic alias references such as `{color.primitive.blue.600}` are unchanged.

- An id is `prim-` plus 6 lowercase hex characters, chosen once. It is the token's identity. It is not a Figma setting.
- Primitive sync stores the id with the same shared plugin data as semantic sync: namespace `com.cjhuang.camellia`, key `id`. It does not call private `setPluginData`. Private plugin data throws in the connector runtime.
- A file synced before this change has variables and no shared id. The sync adopts, in order: a variable whose shared id matches; otherwise an untagged variable with the token's current visible name. It writes the shared id. Renaming the JSON path before that migration does not match the old name: the old variable stays, and a new one is created. The sync still refuses a rename that would collide with a different variable's name, and it still never deletes a variable.
- After the ids are stored, renaming the JSON path renames that same Figma variable. Semantic sync finds the aliased primitive by that id, so an alias stays on the variable even when the visible name has not caught up yet. Until the id is stored, it falls back to the visible name.
- **Observed** against the fake Figma: a JSON rename keeps the variable id, a name-match migration creates 0 and deletes 0, and a second run changes nothing. **Observed** 2026-10-22 on CJ's real Camellia file, his report from Figma desktop: the [Primitives checklist](../.cursor/skills/verify-camellia/features/figma-primitives-sync.md) passed. Inventory showed 151 variables, the dry run would create 0 and update 110, the sync created 0 and updated 110, a rerun created 0 and updated 0, and rectangle `61:117` stayed bound. Merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`). The project-wide next task is in [docs/roadmap.md](roadmap.md).

### Phase 2D: Text Styles

- **Approved scope:**
  - Real Figma Text Styles generated from the DTCG typography tokens: `Camellia/Display/LG`, `Camellia/Display/SM`, `Camellia/Heading/XL`, `Camellia/Heading/LG`, `Camellia/Heading/MD`, `Camellia/Heading/SM`, `Camellia/Body/LG`, `Camellia/Body/MD`, `Camellia/Body/SM`, `Camellia/Label/MD`, `Camellia/Label/SM`, `Camellia/Code/MD`, `Camellia/Code/SM`.
  - Use Geist and Geist Mono, with the intended tracking.
  - No fake STRING variables.
  - Stop after validation.
- **Approved (2026-10-13):** tracking is applied as a percentage letter spacing in the styles, because em ratios can't be pixel variables.
- **Approved (2026-10-22):** this is the next pipeline phase. Do it now. The build waits until CJ decides the open questions in the [Phase 2D task brief](#phase-2d-task-brief). The project-wide next agreed task is in [docs/roadmap.md](roadmap.md).
- **Details:** the [Phase 2D task brief](#phase-2d-task-brief).

### Phase 2E: Effect Styles

- **Approved scope:**
  - Shadow styles: `none`, `sm`, `md`, `lg`.
  - Frost styles: `light/subtle`, `light/strong`, `dark/subtle`, `dark/strong`.
  - Keep Shadow and Frost conceptually separate.
  - The goal is recipe and intent parity with CSS `backdrop-filter`, not identical pixels.
  - Stop after validation.
- **Approved (2026-10-22):** do this after Phase 2D is merged and desktop-verified. It is the last phase required to call the token pipeline finished. It does not start inside a 2D pull request.

### Phase 2F: Expression Paint Styles

- **Approved scope:**
  - Paint Styles `Camellia/Expression/Ice`, `Camellia/Expression/Tropical` and `Camellia/Expression/Pink Dream`.
  - They are for atmospheric backgrounds, branding imagery, visual experiments and future AI-assisted assets. **They are not default component fills** (Background = expressive, Surface = restrained).
  - Stop after validation.
- **Approved (deferred, 2026-10-22):** do not build this until a component needs these paint styles. It does not block Phase 2D, Phase 2E, or the start of [Components & interactions](components-roadmap.md).

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
- **Approved (deferred, 2026-10-22):** do not build this until a component needs a combined audit. Today's dry runs already report the diffs: the primitive and semantic commands report what would be created, what would be updated, what is unchanged, and what exists only in Figma. That per-command diff is why this phase can wait. Those dry runs are not this audit: they do not yet score text, effect, or paint styles. This phase does not block 2D, 2E, or the start of components.

### Phase 3: designer review workflow (Figma to DTCG) — do not build during Phase 2

- **Approved intent:**
  1. DTCG syncs to Figma.
  2. CJ explores in Figma, possibly changing tokens there temporarily. Those changes never become canonical automatically.
  3. When a change should become official, an "Export Changes" or "Review Drift" command compares Figma with DTCG and produces a change report or DTCG patch.
  4. CJ reviews and applies the patch in Cursor, commits it, regenerates the CSS, and re-syncs Figma.
- No fully automatic two-way sync. Figma is the exploration environment; DTCG stays the approved source of truth.
- **Approved (deferred, 2026-10-22):** do not build this until a component needs a path from Figma back to the JSON. It does not block 2D, 2E, or the components phase. The components phase is a different Phase 3 and lives in [Components & interactions](components-roadmap.md).

### Phase 4: component system — do not build yet

The component plan now lives in [Components & interactions](components-roadmap.md). Do not start component work from this section. The bullets below are the earlier approved intent. Which component comes first is **Unknown** in that document, not settled by the Button note here.

- **Approved intent:** components start after Phase 2D and Phase 2E are merged and desktop-verified ([entry criteria](components-roadmap.md#entry-criteria)). Deferred pipeline work does not block that start.
- Button is the likely first validation component: it exercises color, typography, spacing, radius, states, focus, dark mode and motion.
- Future parity looks like Figma `Button` (`Style=Primary`, `Size=MD`, `State=Default`) mapping to React `<Button variant="primary" size="md" />`. Figma Code Connect gets evaluated at that point.
- The React demo is a token reference page (CJ, 2026-10-17), not a component. Component implementation still waits for this phase.

## Phase 2C task brief

This brief holds the approved facts for Phase 2C. It is not the project-wide next task. That task is in [docs/roadmap.md](roadmap.md). The design is the [Phase 2C implementation plan](plans/phase-2c-semantic-sync.md). CJ approved decisions 1–5 on 2026-10-20. Build PRs 1–3 are merged. **Observed** 2026-10-21, evidence CJ's report from Figma desktop on his real Camellia file: he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed. Semantic permanent ids are merged in [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15). Primitive permanent ids are merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`) and were checked on that file on 2026-10-22. Do not start Phase 2D from this brief. The [Phase 2D task brief](#phase-2d-task-brief) is the 2D starting summary, and the build waits until CJ decides the questions there. The project-wide next task is in [docs/roadmap.md](roadmap.md).

- **Phase:** 2C, Semantic Light/Dark sync.
- **Scope:** the approved scope above, plus the rules for every sync phase. Out of scope: text, effect and paint styles; the audit; component tokens. Permanent semantic ids ([PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15)) and permanent primitive ids ([PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16)) are separate approved changes and are in the JSON.
- **Acceptance criteria (Approved):**
  1. One `Semantic` collection exists with exactly the modes `Light` and `Dark`.
  2. Each semantic variable's mode values are aliases to the matching primitives, not raw values, wherever a primitive exists.
  3. Scopes and WEB code syntax are correct; the code syntax names exist in `src/styles/tokens.css`.
  4. A second run creates nothing and updates nothing.
  5. Layers bound to semantic variables stay bound across value changes.
- **Verification plan (Proposal, mirroring 2B):** unit tests for the plan, sync tests against the fake Figma, then CJ runs the [Semantic desktop checklist](../.cursor/skills/verify-camellia/features/figma-semantic-sync.md), including both modes, the translucent dark aliases, the spacing pickers, a Figma-side rename, and a binding-survival test on a semantic variable.
- **Design questions:** 2, 3, and 5 were decided by CJ on 2026-10-20. See [open questions](#open-questions) and the [plan](plans/phase-2c-semantic-sync.md). Question 4 (whether dark alpha aliases look translucent in Figma) is check (b) of the PR #14 checklist. **Observed** 2026-10-21: CJ ran that checklist on his real file and every check passed.
- **Workflow:** follow the [implement/verify handoff](verification.md#implementverify-handoff). The 2C plan is the first planned trial of that handoff.

## Phase 2D task brief

This is the starting summary for the Phase 2D build. It is not permission to open that build. **Approved (2026-10-22):** Text Styles are the next pipeline phase, and the build waits until CJ decides the questions under [Decisions for CJ](#decisions-for-cj). The project-wide next task is in [docs/roadmap.md](roadmap.md). Phase 2E starts after 2D is merged and desktop-verified. This brief does not start 2E.

Words used here, the first time they matter:

- **DTCG** is the Design Tokens Community Group file format. Camellia's DTCG file is `tokens/camellia.tokens.json`, the only token source.
- A **Text Style** is a Figma object that packages a font, a size, a line height, and letter spacing. A text layer can use that package by name. The style's name is the whole string, for example `Camellia/Display/LG`. **Inferred** from Figma's style picker: slashes also group styles into folders. The desktop checklist confirms the grouping.
- **`fontName`** is Figma's pair of a family and a style, such as `{ family: "Geist", style: "SemiBold" }`. The style is a name the font file defines. It is not the number 400 or 600.
- **Tracking** and **letter spacing** are the space between characters. An **em** is a fraction of the font size. `-0.02em` is 2% tighter than the font's normal spacing. **Approved (2026-10-13):** Figma stores that tracking as a percentage on the Text Style. The percent scale is spelled out below and marked **Inferred**.
- **Line height** is the distance from one line's baseline to the next.
- A **dry run** asks the plugin what it would change, and the plugin writes nothing.
- **Idempotent** means a second sync creates no duplicates and changes nothing.
- A **permanent id** is the token's identity. It is not the visible name, so a rename can find the same Figma object.
- **Shared plugin data** is a small tag stored on a Figma object. The namespace `com.cjhuang.camellia` and the key `id` are the tag [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15) and [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) already use for variables. Other plugins can read it. It is not a secret.
- The **fake Figma** is the in-memory stand-in the unit tests use. A passing fake test is not Figma behavior.
- A **connector test** runs the real plugin API against a scratch Figma file. It is still not a check of CJ's Camellia file.
- A **binding** is a live link from a field to a Figma variable. Change the variable, and the field follows.

### Scope

**Approved** scope, unchanged: the 13 Text Styles named above, Geist and Geist Mono, the intended tracking as a percentage, no fake STRING variables, and stop after validation. The rules for every sync phase apply: idempotent, update in place, create what is missing, never delete a style that exists only in Figma, report it instead.

**Observed** in `tokens/camellia.tokens.json`: those 13 styles are the tokens whose `$type` is `typography`. Two `display`, four `heading`, three `body`, two `label`, two `code`. Each `$value` references a font family and a font weight, and stores a font size, a letter spacing in px, and a unitless line height. The Camellia extension on each leaf stores `trackingIntent` (a reference to a `tracking` token) and `lineHeightPx`. None of the 13 has an `id`.

**Observed** in `figma-plugin/src/plan-primitives.ts`: `display`, `heading`, `body`, `label`, `code`, and `tracking` are excluded from the Primitives collection with the reason "Text Styles (2D)". `font/family/*` and `font/weight/*` already sync as variables (STRING with scope `FONT_FAMILY`, FLOAT with scope `FONT_WEIGHT`). 2D does not create those variables again. `tracking` stays out of the variables table because an em ratio is not a pixel variable (Approved, 2026-10-13).

**Observed** in `src/styles/tokens.css`: each style is a CSS `font` shorthand (`weight size/line-height family`) plus a separate `*-letter-spacing` custom property. The letter-spacing property uses `trackingIntent` (`-0.02em` or `0em`), which is what `scripts/tokens/build-css.mjs` prefers over the px letter spacing baked into the composite.

**Out of scope:** effect styles, paint styles, the audit, the designer-review workflow, component tokens, new dependencies, `AGENTS.md`, hand-editing `src/styles/tokens.css`, and an agent writing to CJ's Figma file. Variable-font axes (a `wght` setting on top of a named style) are out of this brief. The first build uses a named style.

### How each DTCG field maps to a Text Style

The JSON path is not the Figma name. `display.lg` is the token. `Camellia/Display/LG` is the approved style name. The root extension `typographyTarget` is the string `"Text Styles"`, which names the kind of Figma object, not the style.

Family. `$value.fontFamily` is a reference, `{font.family.sans}` or `{font.family.mono}`. **Observed:** `font.family.sans` is the list `Geist, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`. `font.family.mono` is `Geist Mono, SFMono-Regular, Consolas, Liberation Mono, monospace`. Figma's `fontName.family` is one family. **Observed** in `plan-primitives.ts`: the primitive planner already keeps the first name only, because Figma has no fallback list. The rest of the stack stays in CSS. Text Styles use that same first name: `Geist` or `Geist Mono`.

Weight and style. `$value.fontWeight` is a reference to a number: `{font.weight.semibold}` is 600, `{font.weight.medium}` is 500, `{font.weight.regular}` is 400. **Observed** in the JSON. A Text Style has no numeric weight field. It has `fontName.style`, a string. **Proposal** for the string the sync asks the font for, one row per weight that these 13 styles use:

| JSON weight | Token | Style name to request |
|---|---|---|
| 400 | `font/weight/regular` | `Regular` |
| 500 | `font/weight/medium` | `Medium` |
| 600 | `font/weight/semibold` | `SemiBold` |

**Unknown** until `figma.listAvailableFontsAsync()` on CJ's machine: the style string Geist actually registers. `SemiBold` and `Semi Bold` are both seen in the wild. If the load fails, the error names the family and the style that was tried, and it lists the style names that family does have. The sync does not switch to Inter or to a CSS fallback.

Size. `$value.fontSize` is a px dimension. It maps to `fontSize`, a number of pixels. `display/lg` is 48.

Line height. The DTCG field `$value.lineHeight` is a unitless ratio. `display/lg` is `1.083333`. The extension `lineHeightPx` is `52`. CSS uses the ratio (`48px/1.083333`). The design spec's type scale table uses the pixels. Which of those Figma stores is [decision 3](#decisions-for-cj). Figma's `lineHeight` is `{ unit: "PIXELS" | "PERCENT", value: number }` or `{ unit: "AUTO" }`. These styles do not use `AUTO`.

Letter spacing and tracking. **Approved (2026-10-13):** tracking is a percentage letter spacing on the style, because an em ratio cannot be a pixel variable. **Observed:** `tracking.tight` is `-0.02` with unit `em`. `tracking.normal` is `0`. `tracking.technical` (`0.1` em) is not referenced by any of the 13 styles, so it does not become a Text Style. CSS already emits `--tracking-tight: -0.02em` and points `--display-lg-letter-spacing` at it. **Inferred** from that approval and from CSS: the percent value is the em ratio times 100. `-0.02em` becomes `{ unit: "PERCENT", value: -2 }`. `0em` becomes `{ unit: "PERCENT", value: 0 }`. The px `letterSpacing` on the composite is the same intent already multiplied by the font size (`48 × -0.02 = -0.96`). The sync reads `trackingIntent`, the same choice the CSS builder makes, and writes the percent. The desktop checklist confirms the type panel shows `-2%` on `Camellia/Display/LG`. If the panel shows a different number, the percent scale was wrong and the build stops for a fix.

Fields the token does not have (`textCase`, `textDecoration`, paragraph spacing, paragraph indent, leading trim) stay as Figma left them. The sync writes the name, the font, the size, the line height, the letter spacing, and the shared id when ids are approved.

**Observed** counts and values:

| Token | Figma Text Style | Family | Weight | Size | Ratio | `lineHeightPx` | Tracking | Percent |
|---|---|---|---:|---:|---:|---:|---|---:|
| `display/lg` | `Camellia/Display/LG` | Geist | 600 | 48 | 1.083333 | 52 | tight, -0.02em | -2 |
| `display/sm` | `Camellia/Display/SM` | Geist | 600 | 40 | 1.1 | 44 | tight, -0.02em | -2 |
| `heading/xl` | `Camellia/Heading/XL` | Geist | 600 | 32 | 1.1875 | 38 | tight, -0.02em | -2 |
| `heading/lg` | `Camellia/Heading/LG` | Geist | 600 | 28 | 1.214286 | 34 | tight, -0.02em | -2 |
| `heading/md` | `Camellia/Heading/MD` | Geist | 600 | 24 | 1.25 | 30 | normal, 0 | 0 |
| `heading/sm` | `Camellia/Heading/SM` | Geist | 600 | 20 | 1.3 | 26 | normal, 0 | 0 |
| `body/lg` | `Camellia/Body/LG` | Geist | 400 | 18 | 1.555556 | 28 | normal, 0 | 0 |
| `body/md` | `Camellia/Body/MD` | Geist | 400 | 16 | 1.5 | 24 | normal, 0 | 0 |
| `body/sm` | `Camellia/Body/SM` | Geist | 400 | 14 | 1.428571 | 20 | normal, 0 | 0 |
| `label/md` | `Camellia/Label/MD` | Geist | 500 | 14 | 1.428571 | 20 | normal, 0 | 0 |
| `label/sm` | `Camellia/Label/SM` | Geist | 500 | 12 | 1.333333 | 16 | normal, 0 | 0 |
| `code/md` | `Camellia/Code/MD` | Geist Mono | 400 | 14 | 1.428571 | 20 | normal, 0 | 0 |
| `code/sm` | `Camellia/Code/SM` | Geist Mono | 400 | 12 | 1.333333 | 16 | normal, 0 | 0 |

`48 × 1.083333 = 51.999984`, while `lineHeightPx` is 52. The ratio is a rounded encoding of the pixel line height. The same rounding shows up on the other non-integer ratios. That is why line height is a decision rather than a silent pick.

### Font loading

**Observed** in `@figma/plugin-typings` 1.141.0, the version this repository depends on: `figma.loadFontAsync({ family, style })` makes a font usable by the plugin. The font has to be one the Figma editor can already see. The call does not download a font from the internet. `figma.listAvailableFontsAsync()` returns the same list as the font picker, and it does not modify the file. A Text Style supports `setSharedPluginData` (the style mixin includes plugin data). That fact is from the typings. It has not been run in Figma.

**Inferred:** Geist and Geist Mono are not fonts Figma ships by default. They need to be installed on the computer that runs the Figma desktop app, so the editor lists them. If either family is missing, `loadFontAsync` rejects. The sync records an error for that style and does not write the style. It does not substitute Inter, `system-ui`, or the rest of the CSS stack. Installing the font and reopening the desktop app is a machine setup step. It is not a token change.

**Proposal:** a dry run calls `listAvailableFontsAsync` and reports a missing family as an error, before any create. The real sync calls `loadFontAsync` before it writes `fontName`, `fontSize`, `lineHeight`, or `letterSpacing`. **Unknown** until the desktop checklist: whether this machine has Geist and Geist Mono, and the exact style strings they register. **Unknown** whether assigning `fontName` on a Text Style requires `loadFontAsync`, or only requires the family to be visible. The sync calls `loadFontAsync` anyway, which matches the documented way to apply a font.

### Rename safety

Two different ids show up in this work. The **Figma style id** (a string like the variable ids already in the console) is what a text layer stores when it uses a style. Updating a style in place keeps that id, so the layer stays attached. The **token permanent id** is how the plugin finds the style after the JSON path changes. [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15) added `sem-` ids for semantic variables. [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) added `prim-` ids for primitive variables. Both store the id with shared plugin data, namespace `com.cjhuang.camellia`, key `id`. Private plugin data throws in the connector runtime for variables (**Observed** 2026-10-21). **Inferred** for styles: text styles use shared plugin data only, the same choice those two pull requests made, and they do not call private `setPluginData`.

**Observed:** the 13 typography leaves can carry an id. Each already has `$extensions.com.cjhuang.camellia` with `trackingIntent` and `lineHeightPx`. `camelliaExtensions` in `figma-plugin/src/dtcg.ts` already returns that object. An `id` would sit beside those two keys. The same shape is what primitive and semantic tokens use. They do not have an `id` today. Adding one edits `tokens/camellia.tokens.json`. That edit needs CJ's approval. This pull request does not make it.

**Proposal** if the answer is yes, matching PR #15 and #16:

- Prefix `type-` plus 6 lowercase hex characters, chosen once. `prim-` and `sem-` stay as they are. An id is unique across the whole file. `plan-primitives.ts` already records ids that sit on non-primitive tokens so a `prim-` id cannot copy one (`foreignIds`). A `type-` id must not equal any existing id.
- The sync matches shared plugin data `com.cjhuang.camellia` / `id` first.
- Text styles have never been synced, so there is no legacy private name tag to migrate. If an untagged local style already has the approved name, adopt it and write the shared id. That is the same name-adoption primitive sync uses.
- After the id is stored, renaming the JSON path renames that same Text Style. A rename that would collide with a different style's name fails the plan. The sync still never deletes a style.
- Styles that exist only in Figma are reported and left in place.

**Proposal** if the answer is no: match the approved style name only. A later rename of the JSON path leaves the old style in the file, reports it as not in the JSON, and creates a new style. Layers stay on the old style.

### Dry run and idempotence

The report uses the same counts as primitive and semantic sync: created, updated, unchanged, not in JSON, errors. The toast shape is `Camellia · Text Styles (dry run) · Would create N · Would update N · Unchanged N · Not in JSON N · Errors N`. A dry run writes no styles and does not rename one. A second sync, after a successful first sync and before anyone edits the file, reports Created 0 and Updated 0.

A value that differs (size, line height, letter spacing, family, style, or the bound variable when decision 1 picks binding) is an update of the same style. The Figma style id in the console line stays the same.

### Planned pull-request split

**Proposal**, mirroring the three Phase 2C build pull requests ([PR #11](https://github.com/cjhuang6/design-engineering-lab/pull/11), [PR #12](https://github.com/cjhuang6/design-engineering-lab/pull/12), [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14)). Stop at the end of each one.

1. **Planner.** A pure function from the JSON to the 13 planned styles. No Figma writes. Unit tests in Node. If permanent ids are approved, this pull request is the one that adds the 13 ids to the JSON. That is the approved token change. It is not this decision-record pull request.
2. **Sync against the fake Figma.** Create, update in place, dry run writes nothing, a second run changes nothing, a missing font is an error, a style that exists only in Figma is listed and kept, and a JSON rename keeps the Figma style id when a token id matches. The tests use the in-memory fake. They do not prove Figma behavior.
3. **Menu command and desktop checklist.** Add the menu entries and a feature-map checklist. CJ runs that checklist on his Camellia file. **Proposal** for the menu strings, which are a public contract: `Sync Text Styles — dry run` (`sync-text-styles-dry-run`) and `Sync Text Styles` (`sync-text-styles`), placed after the semantic commands. The feature map is updated in that pull request. This decision record does not add a feature-map page, because the command does not exist yet.

### Verification plan

**Proposal**, in this order. Follow the [implement/verify handoff](verification.md#implementverify-handoff).

1. **Unit tests** for the planner: 13 styles, the approved names, the family, the weight-to-style table, the size, the line-height choice, percent tracking (`-2` or `0`), and no new STRING variable for a typography composite or for `tracking`.
2. **Sync tests against the fake Figma:** the dry-run and idempotence cases above, the missing-font error, the not-in-JSON case, and the rename case that matches the id decision.
3. **A connector test on a scratch Figma file**, not CJ's Camellia file. Create the 13, run again and expect no changes, and, if ids are approved, rename one token and expect the same style id. The build task that runs this test needs an explicit permission to write to that scratch file. The scratch run is not the desktop check.
4. **CJ's desktop checklist** on his real Camellia file. Only this step verifies Figma behavior. The checklist is written into the feature map in the menu pull request. It covers: the text-style count before and after, a dry run that would create 13 and writes nothing, a sync that creates 13, a second run that changes nothing, a spot check of `Camellia/Display/LG` (Geist, 48, the chosen line height, letter spacing `-2%`) and `Camellia/Code/SM` (Geist Mono, 12), a text layer that stays on `Camellia/Body/MD` after a size change and a resync, the rename case when ids are approved, a hand-made `Camellia/Scratch` style that is reported and kept, and Primitives and Semantic left at 110 and 41. A missing Geist or Geist Mono fails the command and creates no fallback style.

### Acceptance criteria

1. **Approved:** the file has the 13 named Text Styles, and a second run creates nothing and updates nothing.
2. **Approved:** family is `Geist` or `Geist Mono`. The CSS fallback list is not written into Figma. Tracking is percent letter spacing from the em ratio. No new STRING variables.
3. **Approved:** a style that exists only in Figma is reported and not deleted. The sync updates in place, so a layer using a style keeps that style's Figma id across a value change.
4. **Waiting on [decision 1](#decisions-for-cj):** family and weight are either bound to `font/family/*` and `font/weight/*`, or written as raw `fontName` values.
5. **Waiting on [decision 2](#decisions-for-cj):** a JSON rename either keeps the same Text Style (ids) or leaves the old style and creates a new one (names only).
6. **Waiting on [decision 3](#decisions-for-cj):** line height is either pixels from `lineHeightPx` or a percent from the unitless ratio.

### Decisions for CJ

These are not decided. The recommendation under each one is a **Proposal**. Picking an option in the review is the decision. The 2D build does not start until you pick, and a merge by itself does not turn a Proposal into an Approved choice.

#### 1. Open question 9 — bind Text Styles to the font family and weight variables, or write raw values?

A Text Style can point `fontFamily` and `fontWeight` at variables that already exist (`TextStyle.setBoundVariable`, **Observed** in the plugin typings). The family variables are `font/family/sans` (`Geist`) and `font/family/mono` (`Geist Mono`). The weight variables are `font/weight/regular` (400), `font/weight/medium` (500), and `font/weight/semibold` (600). Size, line height, and letter spacing stay raw numbers either way. They are not variables. `tracking` is excluded from the variables table on purpose.

**Option A. Bind family and weight.** `setBoundVariable("fontFamily", …)` links to `font/family/sans` or `font/family/mono`. `setBoundVariable("fontWeight", …)` links to the matching `font/weight/*` variable. The weight variable is a number, so the field is `fontWeight`, not `fontStyle`. Size, line height, and letter spacing are still written as numbers.

- Pro: the typography token already references those tokens (`{font.family.sans}`, `{font.weight.semibold}`). A binding keeps that link visible in Figma, the same idea as a semantic color aliasing a primitive.
- Pro: the variables already exist from Phase 2B, so this adds no new variable.
- Con: Figma still has to turn the number 600 into a font style name inside Geist. This plugin has never bound a variable onto a style. **Observed:** `figma-plugin/src` does not call `setBoundVariable`. A fake-Figma test cannot prove the binding. Only the desktop checklist can.
- Con: the style is mixed. Two fields are links, and the rest are copies. The dry run has to compare both.

**Option B. Write raw values.** `fontName` is `{ family: "Geist" | "Geist Mono", style: "Regular" | "Medium" | "SemiBold" }`. Size, line height, and letter spacing are numbers on the style. Nothing on the style is bound to a variable.

- Pro: a Text Style is one package, like the CSS `font` shorthand, which already bakes the resolved weight, size, and family into one declaration. The family and weight variables remain available for anything else that wants them.
- Pro: the dry run compares plain fields. `loadFontAsync({ family, style })` is the documented way to apply a font. The JSON stays the source of truth on the next sync.
- Con: the link from `display/lg` to `font/family/sans` is visible in the JSON and in CSS, and it would not be visible on the Figma style. Editing the family variable in Figma would not change the styles. The next sync from the JSON would, after the JSON itself changed.

**Proposal:** Option B, raw values. Binding does not install Geist, and it does not remove the need to resolve 600 to a style name. Writing the resolved `fontName` is the smaller step, and it matches a Text Style being the native object for a whole typographic style.

#### 2. Permanent ids on the 13 typography tokens — yes or no?

**Option A. Yes.** Add `id` to each of the 13 typography leaves, prefix `type-` plus 6 lowercase hex characters, and store it with shared plugin data `com.cjhuang.camellia` / `id`. Match that id the way PR #15 and PR #16 match variable ids. The JSON change lands in the planner pull request, after this decision, not in this pull request.

- Pro: renaming `display/lg` in the JSON renames `Camellia/Display/LG` in place. A text layer stores the Figma style id, so it stays on that style. That is the failure mode the variable ids were added to prevent.
- Pro: the extension object is already on each leaf, and Text Styles support shared plugin data in the typings. The tag is the same namespace and key the variables use. There is no legacy text-style migration, because text styles have not been synced.
- Con: it is an edit to the canonical token file. Thirteen styles will be renamed rarely. Matching by the visible name is fewer moving parts.

**Option B. No.** Match the approved style name. Do not add ids. Do not write shared plugin data for identity.

- Pro: no token JSON change. The first sync creates 13 styles and finds them by name after that.
- Con: a later rename leaves the old style in the file and creates a second one. The sync will not delete the old one. Every text layer that used it stays on the old style until someone moves it by hand.

**Proposal:** Option A. The JSON change is small, the extension object is already there, and a style attached to a layer is painful to duplicate. Use `type-` so the id cannot collide with `prim-` or `sem-`. Effect styles can reuse the pattern in Phase 2E. That later prefix is not part of this decision.

#### 3. Line height — pixels from `lineHeightPx`, or a percent from the unitless ratio?

**Option A. Pixels.** `lineHeight` is `{ unit: "PIXELS", value: <lineHeightPx> }`. `Camellia/Display/LG` is 52. The numbers are the ones in the design spec's type scale table.

- Pro: 52, 44, 38, and the rest are exact integers. The unitless ratio does not multiply back to those integers (`1.083333 × 48 = 51.999984`). An equality check against the spec can be exact.
- Con: if the font size later changes and the pixel line height is not updated with it, the ratio drifts. The JSON already stores both, so a sync that reads `lineHeightPx` stays honest to that field.

**Option B. Percent from the ratio.** `lineHeight` is `{ unit: "PERCENT", value: <ratio × 100> }`. `1.083333` becomes `108.3333%`. In Figma, 100% line height means the same height as the font size, which is what a CSS unitless ratio means. This matches the CSS `font` shorthand.

- Pro: one DTCG field (`$value.lineHeight`) feeds CSS and Figma. The line height stays proportional to the size.
- Con: the percent does not land on the spec's pixel (`108.3333%` of 48 is `51.999984`, not 52). A strict equality check against `lineHeightPx` fails on a rounding residue.

**Proposal:** Option A, pixels from `lineHeightPx`. The spec and the extension already name those pixels. The ratio remains the CSS value. Figma shows the line height a designer reads in the type scale.

#### 4. Menu command names

These strings are a public contract (plugin commands). They are not a token change.

**Option A.** `Sync Text Styles — dry run` with command `sync-text-styles-dry-run`, and `Sync Text Styles` with command `sync-text-styles`, after the semantic commands. Same pattern as `Sync Semantic — dry run` / `Sync Semantic`.

**Option B.** Different names, written in the review.

**Proposal:** Option A.

### Workflow

Follow the [implement/verify handoff](verification.md#implementverify-handoff). One separate verifier. The implementer runs the checks for that pull request before handing off. The verifier does not weaken the criteria above. An agent does not write to CJ's Figma file. The scratch-file connector test waits for a build task that explicitly allows that write.

## Open questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | **Renaming tokens safely.** Semantic tokens and primitive tokens have a permanent id in `$extensions.com.cjhuang.camellia.id` (CJ, 2026-10-21). Semantic ids are merged in [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15). Primitive ids are merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`). Sync matches shared plugin data `com.cjhuang.camellia` / `id`, so a JSON rename renames the same variable. A semantic file synced under the old private name tag is migrated once. A primitive file synced by visible name is migrated once, by that name. Private plugin data throws in the connector runtime (observed 2026-10-21). **Observed** on CJ's real file: 2026-10-21, semantic migration 0 created and 41 updated, rerun 41 unchanged, rectangle `61:117` stayed bound. 2026-10-22, primitives checklist passed: Inventory 151 variables, dry run would create 0 and update 110, sync created 0 and updated 110, rerun created 0 and updated 0, rectangle `61:117` stayed bound. A JSON rename of a semantic token on that file is not in the report. Renaming `blue/600` on a scratch file, not CJ's file, kept the same variable (2026-10-21) | Approved, and merged for both. Migrations and binding observed on CJ's real file. Semantic JSON rename on that file is not in the report | A semantic JSON rename on CJ's file, until he reports it or defers it |
| 2 | **Composite border tokens, deferred** (CJ, 2026-10-20). The eight tokens `theme.light.border` and `theme.dark.border` × `subtle`, `default`, `strong`, and `focus` are not created as Figma variables in 2C. Each value is a color, a width, and a style. Figma variables have no type for that composite, so a color variable would not be the token. The color syncs as `color/border/*` and `color/focus`; `border/width/*` already syncs in Primitives; `border.style` stays CSS-only. Unblocked when a later phase has a Figma object that can carry color, width, and style together | Approved (deferred) | Does not block 2C. Blocks a Figma form of the border shorthand |
| 3 | **Semantic scopes.** Text as `TEXT_FILL`, surfaces as `FRAME_FILL`/`SHAPE_FILL`, borders and focus as `STROKE_COLOR`, icons as `SHAPE_FILL`, layout and control as `GAP`. Full table in the [2C plan](plans/phase-2c-semantic-sync.md) | Approved (CJ, 2026-10-20) | Nothing |
| 4 | **Dark aliases to alpha primitives** (e.g. `color/border/subtle` → `alpha/blue-400/18`). This is check (b) of the PR #14 semantic desktop checklist | **Observed** 2026-10-21: CJ ran that checklist on his real Camellia file and every check passed (his report from Figma desktop). The report does not quote each swatch | Nothing |
| 5 | **Feedback colors have no semantic Light/Dark layer.** They stay in `Primitives`, visible in pickers. The spec lists them as single accents, and the JSON has no `theme.*.feedback` | Approved (CJ, 2026-10-20) | Nothing |
| 6 | **Section 20 ("CSS starter mapping") of the design system spec** is a hand-written CSS block that predates the generated `src/styles/tokens.css` | **Approved, resolved (2026-10-22).** The heading is labeled historical. A note at the top of the section says it predates the generated `src/styles/tokens.css`, is not a source of truth, and that `tokens/camellia.tokens.json` is canonical. The section was kept. No values in it were changed | Nothing |
| 7 | **The design spec's "Components" collection and Profile Card component tokens** aren't in the JSON (`componentTokensIncluded: false`). Where a component-token layer would live is recorded in the [components roadmap](components-roadmap.md#open-questions). Changing the canonical schema needs CJ's approval | **Approved (deferred, 2026-10-22).** Decide it with the first component in the components roadmap. It does not block 2D, 2E, or the start of components | The component-token layer, until that first component |
| 8 | **Motion variables in actual use.** EASING and TIMING variables were created (Observed), but binding them to Figma Motion keyframes was not verified. The Figma Motion API is in beta | **Approved (deferred, 2026-10-22).** Until a component needs that binding. It does not block 2D, 2E, or the start of components | Motion binding in Figma, until a component needs it |
| 9 | **Text Styles binding to the font family and weight variables**, or writing raw `fontName` values. Options are in the [Phase 2D task brief](#decisions-for-cj) | Unknown. **Proposal** there: write raw values | The 2D build |
| 10 | **Existing explanatory comments.** The CSS scripts and the plugin carry many explanatory comments that predate the no-comments default in AGENTS.md. They stay until CJ asks for a cleanup; new code follows the default | Approved (deferred) | Nothing |
| 11 | **Lint coverage.** ESLint only covers `.js`/`.jsx`, so the plugin's `.ts` files and the `.mjs` scripts aren't linted. Covering TypeScript needs a new dependency (e.g. `typescript-eslint`), which requires CJ's approval | Proposal | Nothing |
| 12 | **AGENTS.md has no local block.** CJ decided on 2026-10-17 to remove the Cursor hook: its false positives interrupted autonomous runs, and it could be bypassed. A local edit takes effect for agents in that checkout immediately, but can't reach `main` without CJ's approval comment. See [AGENTS.md protection](verification.md#agentsmd-protection) | Approved | Nothing |
| 13 | **Permanent ids on the 13 typography tokens.** They have no `id` today. Adding one edits `tokens/camellia.tokens.json` and needs CJ's approval. Options are in the [Phase 2D task brief](#decisions-for-cj) | Unknown. **Proposal** there: yes, prefix `type-`, shared plugin data `com.cjhuang.camellia` / `id`, the same approach as [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15) and [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) | The 2D build |
| 14 | **Text Style line height.** The JSON has a unitless ratio and a pixel `lineHeightPx`. Options are in the [Phase 2D task brief](#decisions-for-cj) | Unknown. **Proposal** there: pixels from `lineHeightPx` | The 2D build |
