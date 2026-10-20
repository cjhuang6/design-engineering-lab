# Phase 2C plan: Semantic Light/Dark sync

**Status: Proposal.** This is the implementation plan for CJ to approve or push back on. It does not approve itself. No plugin code is written from this document until CJ approves it.

Approving the plan means approving the recommendations in [Decisions for you](#decisions-for-you) and the three pull requests under [Implementation pull requests](#implementation-pull-requests). Push back on any row you disagree with; that row stays open and the rest can proceed.

The five acceptance criteria already approved in the [roadmap](../token-pipeline-roadmap.md#phase-2c-task-brief) stay as they are:

1. One `Semantic` collection exists with exactly the modes `Light` and `Dark`.
2. Each semantic variable's mode values are aliases to the matching primitives, wherever a primitive exists.
3. Scopes and WEB code syntax are correct, and those code-syntax names exist in `src/styles/tokens.css`.
4. A second run creates nothing and updates nothing.
5. Layers bound to semantic variables stay bound across value changes.

Labels used below match the roadmap: **Approved**, **Observed**, **Proposal**, **Unknown**.

## Decisions for you

These are the choices the roadmap left open, plus the new public names this phase would publish. A later rename of a Figma variable orphans anything bound to the old one (roadmap open question 1). First-time names are decided here.

| # | Decision | Recommendation | If you disagree |
|---|---|---|---|
| 1 | Composite `border` tokens (`theme.*.border.subtle`, `default`, `strong`, `focus`: color + width + style) | **Defer.** Do not create Figma variables for them in 2C. The color half already syncs as `color/border/*` and `color/focus`. Width already exists on `border/width/*`. `border.style` stays CSS-only, as in 2B. | Say so, and name the Figma variable. This plan will not invent a name. `border/subtle` is the spec's name for the shorthand `1px solid …`, while CSS `--border-subtle` is that shorthand and `--color-border-subtle` is the color. Publishing `border/subtle` as a color pointer would make one name mean two different things. |
| 2 | Which pickers show each semantic variable (scopes) | The scope column in the tables below. Scopes can be corrected on a later sync without new variable IDs. | Mark up the table. Wrong scopes only hide a variable from a picker; they do not change its value. |
| 3 | Plugin menu strings | Add `Sync Semantic — dry run` (`sync-semantic-dry-run`) and `Sync Semantic` (`sync-semantic`), after the primitives commands. | These strings are a public contract. Change them now if you want different words. |
| 4 | Figma variable names | Publish the names already in the design spec and in `tokens.css`: `color/action/primary`, `layout/content-gap/md`, and the rest of the tables. Collection `Semantic`, modes `Light` and `Dark`, already stored in the JSON. | Say which name should differ. Changing it later is a rename. |
| 5 | Feedback colors (`feedback/success` and the other three) | Leave them in `Primitives`, visible, with no Light/Dark pair. **Observed:** the spec lists them as single accents, and the JSON has no `theme.*.feedback`. **Inferred** from that, plus the comment in `figma-plugin/src/plan-primitives.ts`, that this is intentional. | A semantic feedback layer is a token-JSON change. It needs its own approval and is outside 2C. |

Dark-mode aliases to alpha primitives (`color/border/subtle` → `color/primitive/alpha/blue-400/18`, and three more) are not a naming decision. The sync will store those pointers. Whether Figma draws them as translucent swatches is a manual check, still **Unknown** (roadmap open question 4).

## Goal

Make the Figma file's `Semantic` collection match the semantic tokens in `tokens/camellia.tokens.json`.

**Observed** counts in the JSON today:

| Group | Variables | Modes |
|---|---|---|
| `theme.light` / `theme.dark` color tokens | 26 pairs, one variable each | Light and Dark point at different primitives (a few point at the same one) |
| `theme.*.border.*` composite borders | 4 pairs | Deferred, decision 1 |
| `layout.*` | 9 | Same `space/*` pointer in both modes |
| `control.*` | 6 | Same `space/*` pointer in both modes |
| **Shipped if decision 1 stands** | **41** | |

The 30 light/dark pairs in the brief are the 26 colors plus the 4 composite borders. `layout` and `control` are in the approved 2C scope as well; they are mode-independent spacing aliases, not a 31st color pair.

Running **Sync Semantic** on the file that 2B already filled creates those 41 variables. Running it again changes nothing.

## Out of scope

- Text styles, effect styles, paint styles, and the audit (phases 2D–2G).
- Component tokens, the Phase 3 export-from-Figma flow, and Phase 4.
- Any edit to `tokens/camellia.tokens.json`, `src/styles/tokens.css`, or the token schema. The plugin reads the JSON it already bundles.
- Renaming primitives, CSS variables, or the `Primitives` collection.
- A rename workflow for variables that already exist.
- Deleting variables that exist only in Figma.
- One command that syncs primitives and semantics together. Semantic sync reads `Primitives` and does not write to it. If primitives are missing, it stops with a message.
- Two-way sync. An edit made in Figma is overwritten the next time that field is synced, which is the approved rule that the JSON wins.
- Writing to the Figma file from an agent. CJ runs the plugin in Figma desktop.
- New dependencies, including a model checker. TLA+ is covered under [Verification](#verification).
- `AGENTS.md` and its guardrails.

## How modes and aliases work

A **collection** is a table of variables. A **mode** is a column. `Primitives` has one column, `Value` (110 variables, from 2B). `Semantic` will have two columns, `Light` and `Dark`.

An **alias** is a pointer to another variable, not a copy of its hex or its number. The stored value is `{ type: "VARIABLE_ALIAS", id: "<the other variable's id>" }`. Figma's `valuesByMode` returns that pointer and does not follow it ([Variable.valuesByMode](https://developers.figma.com/docs/plugins/api/Variable/)). The sync compares pointer ids, so the 32-bit rounding that 2B had to tolerate never applies to these values.

Example, already approved on the roadmap: `color/action/primary` in Light points at `color/primitive/blue/600`. In Dark it points at `color/primitive/blue/400`. Changing `blue/600` later changes every semantic variable that points at it.

The Plugin API calls, in the order Figma's own [authoring example](https://developers.figma.com/docs/plugins/working-with-variables/) uses:

1. `figma.variables.createVariableCollection("Semantic")` creates the table with one column.
2. `renameMode` names that column `Light`. The first column is the default mode (`defaultModeId`, **Observed** in Figma's authoring example). **Inferred:** a layer that has never picked a Semantic mode shows that default column. Light stays first so the default matches CSS `:root` as the light theme (`targets.css.lightSelector` in the JSON).
3. `addMode("Dark")` adds the second column.
4. `createVariable(name, collection, "COLOR" | "FLOAT")` adds a row. Color tokens are `COLOR`. Layout and control tokens are `FLOAT`, because they point at `space/*`, which 2B stored as `FLOAT`.
5. `setValueForMode(modeId, figma.variables.createVariableAlias(primitiveVariable))` writes the pointer for that column.

**How a layer picks a color.** Modes belong to one collection each. On a frame you choose Semantic `Light` or `Dark`, and separately Primitives `Value`. Choosing Dark on Semantic does not require a Dark column on Primitives. Figma follows the pointer, then reads the primitive using that layer's mode for the Primitives collection ([resolveForConsumer](https://developers.figma.com/docs/plugins/api/properties/Variable-resolveforconsumer/)). Primitives has only `Value`, so that is the color you get.

**Observed** in our code: `sync-primitives.ts` already renames the single column of a new collection, and the test fake starts that column as `Mode 1`. **Inferred** from Figma's authoring example: the same rename-then-`addMode` sequence is what we should use for two columns. The real default label is confirmed on the first desktop run.

**Unknown:** Figma's docs say the Starter plan is limited to a single mode. If this file is on that plan, `addMode("Dark")` fails and 2C cannot be finished by a code change. The manual checklist starts with that check.

Scopes only decide which pickers list the variable. They do not block a pointer. Primitive colors stay hidden (`scopes: []`, approved in 2B) and semantic colors are what the pickers offer. **Inferred** from the [scopes docs](https://developers.figma.com/docs/plugins/api/properties/Variable-scopes/): a hidden primitive can still be the target of an alias. The desktop checklist confirms the variables panel shows that link.

Code syntax is one string per variable, not per mode (`setVariableCodeSyntax("WEB", …)` in `sync-primitives.ts`). Light and Dark share `var(--color-action-primary)`, which is how `tokens.css` already works: one custom property, overridden under `[data-theme="dark"]`.

## How the JSON maps onto that table

Source of names, **Observed** in `tokens/camellia.tokens.json`:

- Collection and mode names: `$extensions.com.cjhuang.camellia.targets.figma.semanticCollection` is `Semantic`, and `semanticModes` is `["Light", "Dark"]`. The planner reads these through `figmaTargets` in `figma-plugin/src/dtcg.ts` (that helper currently returns only `primitiveCollection`; 2C extends it). It does not hardcode the strings.
- `theme.light` / `theme.dark` carry `modeMap`: `light` → `Light`, `dark` → `Dark`.
- `layout` and `control` carry `figmaCollection: "Semantic"` and `modes: ["Light", "Dark"]`.

The planner checks that those group extensions agree with the root `targets.figma`. A disagreement fails the plan. Two sources of names would be a bug.

**Variable name.** Strip `theme/{mode}/` and join the rest with `/`. That is the same join `planPrimitives` uses, and the same public path `cssVarName` in `scripts/tokens/build-css.mjs` turns into a CSS variable with hyphens. `theme.light.color.action.primary` and `theme.dark.color.action.primary` become one row, `color/action/primary`. `layout.content-gap.md` becomes `layout/content-gap/md`.

**Pointer target.** A value that is a single DTCG reference, such as `{color.primitive.blue.600}`, becomes the primitive name `color/primitive/blue/600`. `isReference` in `dtcg.ts` already detects that shape. Every color, layout, and control value in the JSON today is one reference (**Observed**). Anything else fails the plan, including a raw hex that appears later. We do not copy a hex into Semantic.

**Both columns required.** Every `theme` name must exist under `light` and under `dark`. A one-sided token fails the plan. Layout and control write the same pointer into both columns, because the JSON says they are mode-independent.

**One description per row.** A Figma variable has one description. If the light and dark tokens ever disagree, the plan fails. Today every semantic `$description` is empty (**Observed**), so the synced description is `""`.

**WEB code syntax.** `var(--` + the Figma name with `/` replaced by `-` + `)`. `color/action/primary` → `var(--color-action-primary)`. `layout/content-gap/md` → `var(--layout-content-gap-md)`. The plan test checks that each of these is declared in `src/styles/tokens.css`, the same way `figma-plugin/tests/plan-primitives.test.mjs` does.

**Type.** The pointer's primitive must be the same Figma type as the row (`COLOR` or `FLOAT`). The plan checks that against `planPrimitives`. A miss fails the plan before any sync runs.

### Color rows (26)

Scopes are a **Proposal** (decision 2). Pointers are **Observed** in the JSON. Figma names are the **Proposal** in decision 4; they match the spec's section 5 and the CSS names.

| Figma name | Light points at | Dark points at | Proposed scopes |
|---|---|---|---|
| `color/background/canvas` | `color/base/white` | `color/base/black` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/surface/primary` | `color/base/white` | `color/primitive/ice/950` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/surface/secondary` | `color/primitive/ice/50` | `color/primitive/ice/900` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/surface/subtle` | `color/primitive/ice/100` | `color/primitive/ice/950` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/surface/selected` | `color/primitive/blue/50` | `color/primitive/blue/950` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/text/primary` | `color/primitive/ice/900` | `color/primitive/ice/50` | `TEXT_FILL` |
| `color/text/secondary` | `color/primitive/ice/600` | `color/primitive/ice/300` | `TEXT_FILL` |
| `color/text/tertiary` | `color/primitive/ice/500` | `color/primitive/ice/400` | `TEXT_FILL` |
| `color/text/inverse` | `color/base/white` | `color/primitive/ice/950` | `TEXT_FILL` |
| `color/icon/primary` | `color/primitive/ice/800` | `color/primitive/ice/100` | `SHAPE_FILL` |
| `color/icon/secondary` | `color/primitive/ice/600` | `color/primitive/ice/300` | `SHAPE_FILL` |
| `color/border/subtle` | `color/primitive/ice/200` | `color/primitive/alpha/blue-400/18` | `STROKE_COLOR` |
| `color/border/default` | `color/primitive/ice/300` | `color/primitive/alpha/blue-400/30` | `STROKE_COLOR` |
| `color/border/strong` | `color/primitive/ice/400` | `color/primitive/alpha/blue-400/50` | `STROKE_COLOR` |
| `color/action/primary` | `color/primitive/blue/600` | `color/primitive/blue/400` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/action/primary-hover` | `color/primitive/blue/700` | `color/primitive/blue/300` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/action/primary-pressed` | `color/primitive/blue/800` | `color/primitive/blue/500` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/action/primary-text` | `color/base/white` | `color/primitive/ice/950` | `TEXT_FILL` |
| `color/action/link` | `color/primitive/blue/700` | `color/primitive/blue/300` | `TEXT_FILL` |
| `color/action/link-hover` | `color/primitive/blue/800` | `color/primitive/blue/200` | `TEXT_FILL` |
| `color/focus` | `color/primitive/blue/500` | `color/primitive/blue/400` | `STROKE_COLOR` |
| `color/functional/accent` | `color/primitive/green/500` | `color/primitive/green/400` | `SHAPE_FILL`, `STROKE_COLOR` |
| `color/functional/surface` | `color/primitive/green/50` | `color/primitive/alpha/green-400/12` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/expression/pink` | `color/primitive/pink/400` | `color/primitive/pink/400` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/expression/blue` | `color/primitive/blue/300` | `color/primitive/blue/400` | `FRAME_FILL`, `SHAPE_FILL` |
| `color/expression/green` | `color/primitive/green/300` | `color/primitive/green/400` | `FRAME_FILL`, `SHAPE_FILL` |

`expression/pink` is the case where both columns point at the same primitive. That is still two stored pointers, and a second sync leaves them alone.

Picker words, from Figma's [VariableScope](https://developers.figma.com/docs/plugins/api/VariableScope/): `FRAME_FILL` is frame fills, `SHAPE_FILL` is shapes and icons, `TEXT_FILL` is text color, `STROKE_COLOR` is strokes. `ALL_FILLS` cannot be combined with the narrower fill scopes. Feedback in 2B uses `ALL_FILLS` plus `STROKE_COLOR`; CJ spot-checked scopes in Figma during 2B (**Observed** on the roadmap), so that combination is the precedent these narrower pairs follow.

### Spacing rows (15)

Both modes point at the same primitive. Proposed scope for every row is `GAP`. There is no padding scope in `VariableScope`. **Unknown** whether the padding fields in the UI list `GAP` variables; the checklist records what they actually do.

| Figma name | Points at (both modes) |
|---|---|
| `layout/content-gap/sm` | `space/2` |
| `layout/content-gap/md` | `space/4` |
| `layout/content-gap/lg` | `space/6` |
| `layout/section-gap/sm` | `space/6` |
| `layout/section-gap/md` | `space/12` |
| `layout/section-gap/lg` | `space/16` |
| `layout/page-gutter/mobile` | `space/4` |
| `layout/page-gutter/tablet` | `space/6` |
| `layout/page-gutter/desktop` | `space/8` |
| `control/padding-inline/sm` | `space/3` |
| `control/padding-inline/md` | `space/4` |
| `control/padding-inline/lg` | `space/5` |
| `control/padding-block/sm` | `space/2` |
| `control/padding-block/md` | `space/3` |
| `control/padding-block/lg` | `space/4` |

### Composite borders (deferred)

**Observed** shape of each pair: `color` points at the semantic color (`{theme.light.color.border.subtle}` or the dark twin, or `color.focus` for the focus ring), `width` points at `{border.width.1}` or `{border.width.2}`, `style` points at `{border.style.solid}`. Figma has no variable type for that triple. CSS already emits the shorthand (`--border-subtle: var(--border-width-1) var(--border-style-solid) var(--color-border-subtle)`).

The four names, light and dark, are an explicit exclusion list, same idea as `EXCLUDED` in `plan-primitives.ts`. A new `$type` under `theme`, `layout`, or `control` that is not on that list fails the plan. Nothing is dropped quietly.

## Sync behavior

Follow `figma-plugin/src/sync-primitives.ts`. Semantic sync is a sibling, `sync-semantic.ts`. It does not call the primitives sync and it does not change primitive variables.

The plan module, `plan-semantic.ts`, stays free of Figma APIs, like `plan-primitives.ts`. It stores primitive **names**. The sync resolves names to ids in the live file, looking only inside the collection named `primitiveCollection`.

### Before any write

These checks run for a dry run and for a real sync. On failure the plugin throws, `code.ts` shows `Camellia Sync failed: …`, and nothing has been written. This matches the 2B preflight (duplicate collections, wrong mode count, duplicate names, type conflicts).

1. More than one collection named `Semantic`.
2. `Semantic` already exists, and its modes are not exactly `Light` then `Dark`. That includes one mode, an extra mode, the names swapped, or a renamed column. The sync does not rename, reorder, or delete modes on a collection it did not just create. Reordering would swap what every layer shows. `removeMode` is not used.
3. Two variables in `Semantic` share a name.
4. An existing semantic variable has a different `resolvedType` than the plan. Figma cannot change a variable's type in place (the 2B error text stays).
5. Any pointer target is missing from `Primitives`, or its type disagrees with the row. The error lists every missing name, so one gap does not hide the next.

The plan's own failures (one-sided theme token, a value that is not a single reference, a reference that is not a primitive, disagreeing extensions, an unexpected `$type`) throw before this, with no file access.

### Writes

1. If `Semantic` is absent, create it, rename the first mode to `Light`, and `addMode("Dark")`. Then create variables. Both columns exist before any row is added.
2. Create a variable that is missing. Set both mode pointers, scopes, WEB code syntax, and description.
3. When the variable exists, compare each column's alias id, the scopes, the code syntax, and the description. Write only the fields that differ. Keep the variable id. The updated line names the fields and the id, for example `color/action/primary [Dark value] (VariableID:…)`.
4. Variables in `Semantic` whose names are not in the plan are listed as `In Figma but not in JSON (left untouched)` and are not deleted (**Approved** 2026-10-13).
5. A throw while creating or updating one variable is recorded under Errors. The loop continues with the others, as in the 2B test `an error on one variable is reported without stopping the others`. The next successful run finishes the rows that failed.

Dry run builds the same report and calls none of the write APIs. The test counts `createVariableCollection`, `addMode`, `createVariable`, and `setValueForMode`.

### Running it twice

After a successful run, a second run reports Created 0 and Updated 0, and the write counters stay still. That is acceptance criterion 4.

It holds because the second read sees the same alias ids, scopes, code syntax, and description the plan asked for. Two columns pointing at the same primitive are equal to the plan, so they are not "updates."

### If you edited the file in Figma

The JSON wins on the next sync of that field. Phase 3 is the approved place to review an exploration before it becomes canonical. Until then:

| What you did | Next Sync Semantic |
|---|---|
| Pointed a column at a different variable, or replaced the pointer with a raw color or number | Puts the JSON pointer back. Reported as an update. The variable id stays, so a bound layer keeps the binding and shows the restored color. |
| Changed scopes, code syntax, or the description | Puts the plan back. Same id. |
| Typed a description | Clears it. These tokens have no `$description` today. |
| Renamed a variable | The old name is reported as not in the JSON and left in place, bindings included. The JSON name is created as a new variable. This is the rename gap. 2C does not close it. |
| Added a variable | Left in place and reported. |
| Deleted a variable | The next sync creates it again, with a new id. Bindings Figma already removed stay removed. |
| Edited a primitive's raw value | Semantic sync does not touch `Primitives`. Layers follow the pointer, so they show your edit until you run Sync Primitives. |

### If a run stops halfway

- Preflight failures write nothing.
- A failure on one variable leaves the earlier rows written. The next run updates or creates whatever is still wrong. It does not rebuild the collection.
- If the plugin dies after creating `Semantic` and before `addMode("Dark")`, the next run hits preflight check 2 and writes nothing. Recovery, if that collection has no variables you need: delete it in Figma yourself, then sync again. The plugin will not delete it. If it already has variables, stop and read the error; do not delete it to get past the check.

## Verification

Terminal checks prove the planner and the sync against a fake. Figma desktop proves Figma. The [implement/verify handoff](../verification.md#implementverify-handoff) applies to each implementation pull request: one agent implements, a different agent checks the diff and re-runs the commands, and CJ runs anything in Figma.

### Tests against the fake

New files, same style as the 2B tests (`node:test`, plain `.mjs`, no new dependency). `npm test` already runs `figma-plugin/tests/*.test.mjs`, so `package.json` stays unchanged.

`figma-plugin/tests/plan-semantic.test.mjs`

- Collection `Semantic`, modes `Light` then `Dark`, 41 variables, unique names.
- Every row in the tables above: type, both pointer names, scopes, code syntax, empty description.
- Every `var(--…)` is declared in `src/styles/tokens.css`.
- The four composite borders are absent, and the test names them.
- A one-sided theme token, a raw value, a reference that is not in the primitives plan, a group extension that disagrees with the root, and an unexpected `$type` each throw.

`figma-plugin/tests/sync-semantic.test.mjs`

The fake is a sibling of the one in `sync-primitives.test.mjs`, extended with `addMode` and with alias values stored as `{ type: "VARIABLE_ALIAS", id }`. It keeps the 32-bit number rounding for raw values. The semantic tests do not rewrite the primitives fake.

Each test starts by running the real `syncPrimitives` so `Primitives` is actually there.

Deterministic cases:

- Dry run on an empty semantic collection reports 41 creates and performs no writes.
- First sync creates one `Semantic` collection, modes `Light` then `Dark`, 41 variables, alias ids pointing at the right primitives, including the four dark alpha targets and `expression/pink` pointing at the same id twice.
- Second sync: Created 0, Updated 0, write counters unchanged.
- Changing a token's reference updates that column on the same variable id.
- A raw color sitting in Figma is replaced by the pointer.
- Drifted scopes, code syntax, and description are repaired.
- An extra semantic variable is reported and kept.
- Primitive ids and values are unchanged, and the primitive write counter does not move.
- A missing primitive, a type conflict, a duplicate `Semantic` collection, and each wrong mode shape throw before any semantic write.
- One `createVariable` throw is reported and the other variables are still created.

### Randomized test

In the same file, one test, no library. A small seeded generator (`mulberry32`, fixed master seed, the failing seed printed on failure) draws 40 starting states. `Math.random()` is not used, so a failure replays.

A state is **reachable** here when the sync is willing to repair it:

- Exactly one `Primitives` collection, built by `syncPrimitives` and then left alone.
- Semantic side is one of: no collection; an empty collection that already has `Light` then `Dark`; a correct full sync; a random subset of the rows with the right pointers; that subset with a random sample then broken by a same-type wrong pointer, a raw value of the right type, or drifted scopes, code syntax, or description; any of those plus one to three orphan variables whose names are not in the plan.

For every draw:

1. One sync makes `Semantic` match the plan (names, types, alias ids per mode, scopes, code syntax, descriptions). Orphans are still there, with the same ids. Variable ids that existed before and are still in the plan are unchanged. The `Primitives` snapshot is unchanged.
2. A second sync reports Created 0 and Updated 0, its write counters do not move, and a snapshot of both collections equals the snapshot after the first sync.

So from those states, syncing twice matches syncing once, and that result matches the tokens (the plan tests are what tie the plan to the JSON).

Separate deterministic tests cover the states that must throw: wrong mode shape, missing primitives, type conflicts. Those are not fed to the generator.

What this does not prove: Figma's alias resolver, the mode picker, a Starter-plan rejection, a crash between two API calls, or a file that fails preflight. The crash-between-modes case is the recovery note above, not a randomized scenario.

**TLA+ is out of scope.** A TLA+ check would need the TLA+ tools, which are a Java program, and adding that runtime is a dependency CJ has not approved. The seeded test above is the idempotency check `npm test` can run.

`docs/verification.md` currently says `npm test` reports `pass 27`. The pull request that adds these tests updates that count to the number the run actually prints.

### What only Figma desktop can show

The feature file added with the menu commands (`.cursor/skills/verify-camellia/features/figma-semantic-sync.md`) carries this checklist, in the same shape as `figma-primitives-sync.md`. CJ runs it. An agent does not.

Preconditions: `npm run figma:build` on the revision under test, the Camellia file open, console open. Leave rectangle `61:117` bound to `feedback/success` and `radius/xl`. Use a new rectangle for the semantic binding test.

1. **Two modes are allowed.** If the first sync fails inside `addMode`, stop. The file's plan cannot hold Light and Dark. **Unknown** until this is tried.
2. **Inventory.** `Primitives` has 110 variables and mode `Value`. No `Semantic` collection yet.
3. **Dry run.** `Sync Semantic — dry run`. Toast: `Camellia · Semantic (dry run) · Would create 41 · Would update 0 · Unchanged 0 · Not in JSON 0 · Errors 0`. Inventory is unchanged.
4. **Sync.** `Sync Semantic`. `Created 41`, `Errors 0`. Collection `Semantic`, modes `Light`, `Dark`, with Light first.
5. **Idempotency.** Run `Sync Semantic` again. `Created 0`, `Updated 0`.
6. **Spot checks** in Local variables:
   - `color/action/primary` Light shows a link to `color/primitive/blue/600`; Dark shows a link to `color/primitive/blue/400`. The cells show variable names, not a pasted hex.
   - Dark `color/border/subtle` links to `color/primitive/alpha/blue-400/18`, and the swatch is translucent. Same idea for `color/border/default`, `color/border/strong`, and `color/functional/surface`.
   - `layout/content-gap/md` links to `space/4` in both modes.
   - Dev Mode shows `var(--color-action-primary)` and `var(--layout-content-gap-md)`.
   - `color/text/primary` appears in the text fill picker. `color/surface/primary` appears for frame fills. `color/primitive/blue/600` stays hidden. `feedback/success` stays visible.
   - `control/padding-inline/md` in the padding fields and in the gap field. Record which pickers list it.
7. **Binding survival**, on the new rectangle:
   1. Bind its fill to `color/action/primary`. Switch the layer between Light and Dark and confirm the color follows.
   2. Change that token's light reference in the JSON, run `npm run figma:build`, dry run, then sync. The console lists `color/action/primary` under Updated with the same `VariableID` as before.
   3. The rectangle stays bound and shows the new color.
   4. Revert the JSON, rebuild, and sync. The original color is back, still bound.
   5. `git status` is clean apart from the intended work.
8. **Orphan.** Add a variable by hand inside `Semantic`. The next sync lists it under `In Figma but not in JSON (left untouched)` and it still exists.
9. **Primitives untouched.** Inventory still shows 110 primitive variables, and a spot-checked primitive value is unchanged. Rectangle `61:117` is still bound as before.

Phase 2C is complete when this checklist has been run and reported. A green `npm test` is not that report.

## Implementation pull requests

Three pull requests, in order, each small enough to implement and review in one sitting. Each uses the implement/verify handoff. None of them edits the token JSON, `tokens.css`, `package.json`, the lockfile, or `AGENTS.md`. None of them authorizes an agent to write to Figma.

The feature map stays unchanged until the menu exists. `scripts/docs/check-feature-map.mjs` requires every manifest command to be named in the map and every command the map names to exist in the manifest, so the menu and the feature file land in the same pull request.

### PR 1 — Plan the rows

Files: `figma-plugin/src/dtcg.ts`, `figma-plugin/src/plan-semantic.ts`, `figma-plugin/tests/plan-semantic.test.mjs`.

`figmaTargets` also returns `semanticCollection` and `semanticModes`, read from the existing JSON. The planner implements the mapping in this document, including the composite-border exclusion.

Acceptance: the plan tests above pass; `npm test` and `npm run figma:build` pass; no menu change.

Verified by those commands. There is nothing to run in Figma yet.

### PR 2 — Sync against the fake

Files: `figma-plugin/src/sync-semantic.ts`, `figma-plugin/tests/sync-semantic.test.mjs`, and the `npm test` pass count in `docs/verification.md`.

Acceptance: the deterministic sync tests and the 40-draw randomized test pass; a preflight failure performs no writes; primitive variables are unchanged.

Verified by `npm test` and `npm run figma:build`. Still no menu, so still no Figma run.

### PR 3 — Menu, report text, and the checklist

Files: `figma-plugin/manifest.json`, `figma-plugin/code.ts`, `.cursor/skills/verify-camellia/features/figma-semantic-sync.md`, the index link in `features/README.md`, and the bundle-size sentence in the verify-camellia skill if `dist/code.js` is no longer about 76 KB.

`code.ts` gains the two commands next to `syncPrimitivesCommand`. The toast matches the primitives shape: `Camellia · Semantic` plus created, updated, unchanged, not in JSON, and errors. Updated rows in the console include the variable id.

Acceptance: the menu strings are the ones CJ approved; the feature-map check passes; `npm run figma:build` passes; the feature file's driving section is the checklist above.

Verified by `npm test`, `npm run figma:build`, and `node scripts/docs/check-feature-map.mjs`. Then CJ runs the checklist. The "last verified" line of the feature map records the Figma date only after that run.

## Risks and unknowns

| Item | Label | Notes |
|---|---|---|
| The file may be on a Figma plan that allows only one mode | **Unknown** | Checklist step 1. A failure here blocks 2C until the plan changes. |
| Alpha aliases draw as translucent swatches | **Unknown** | Pointers are determined (four dark targets, **Observed** in the JSON). Pixels are checklist step 6. |
| Padding fields list `GAP` variables | **Unknown** | `GAP` is the only spacing scope in the API (**Observed** on `VariableScope`). Checklist step 6 records the pickers. |
| The variables panel shows a link to a hidden primitive | **Inferred** | Scopes affect pickers, not alias storage. Checklist step 6 confirms the link. |
| Choosing Semantic Dark leaves Primitives on `Value` | **Inferred** | Modes are per collection. With one primitive mode, the pointer still resolves. Confirm the mode picker looks like that during the checklist. |
| A later Light/Dark column on `Primitives` would change resolution | **Inferred** | The pointer does not store a primitive mode. Extra primitive modes are not part of 2C. |
| Empty descriptions get cleared on sync | **Observed** rule, **Observed** empty strings | JSON wins, and these tokens have no `$description`. Surprise-prone if you annotate in Figma. |
| A crash between create-collection and `addMode` sticks until the empty collection is deleted by hand | **Inferred** from the preflight | Rare (two API calls). Documented under halfway stops. The sync will not delete the collection. |
| Renaming a token or a Figma variable orphans bindings | **Approved** gap | Roadmap open question 1. Unchanged by 2C. |
| This plan's scope table is wrong for how you design | **Proposal** | Decision 2. Fixing scopes later reuses variable ids. |
| The fake does not execute Figma | **Observed** limit | Same limit as 2B, stated in `docs/verification.md`. |

## Code this follows

| Already in the repo | Role in 2C |
|---|---|
| `tokens/camellia.tokens.json` | The only source. `targets.figma`, `theme`, `layout`, `control`. |
| `scripts/tokens/build-css.mjs` (`cssVarName`) | The hyphen names that WEB code syntax must match. |
| `src/styles/tokens.css` | The declaration check. Generated; not edited. |
| `figma-plugin/src/dtcg.ts` | `collectTokens`, `isReference`, `figmaTargets`. |
| `figma-plugin/src/plan-primitives.ts` | Planner shape, and the `EXCLUDED` rows that name 2C. |
| `figma-plugin/src/sync-primitives.ts` | Preflight, in-place update, orphan report, per-variable errors. |
| `figma-plugin/tests/sync-primitives.test.mjs` | The fake to copy and extend. |
| `figma-plugin/code.ts`, `figma-plugin/manifest.json` | Where PR 3 adds commands. |
| `.cursor/skills/verify-camellia/features/figma-primitives-sync.md` | The checklist shape PR 3 copies. |
