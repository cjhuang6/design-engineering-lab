# Figma Semantic sync

CJ makes the Figma `Semantic` collection match the semantic tokens: 41 variables, with modes `Light` and `Dark` (Light first). Each value is a link to a primitive, not a copied color or number. Each semantic token has a permanent id, so renaming that token in the JSON renames the same Figma variable and a shape bound to it stays bound. A dry run reports what would change and writes nothing. The real sync creates what is missing and updates what differs. A variable that exists only in Figma is listed and left alone. On a file synced before these ids existed, the first sync retags the 41 variables and creates none.

## Sub-features

- `semantic-dry-run` reports Would create, Would update, Unchanged, Not in JSON and Errors, and writes nothing.
- `semantic-create` creates the `Semantic` collection and 41 variables when none exist.
- `semantic-modes` gives that collection exactly `Light` then `Dark`.
- `semantic-idempotent` makes no changes on a second run.
- `semantic-alpha` links the dark border and surface colors at translucent primitives.
- `semantic-scopes` offers spacing variables in the gap field, and records whether padding fields list them too.
- `semantic-rename-restore` puts a renamed semantic variable's name back on the same variable, so a bound shape stays bound.
- `semantic-binding-survival` keeps a bound shape on the same variable when a token's reference changes.
- `semantic-id-migration` retags the 41 variables that were stored under their names, creates none, and deletes none.
- `semantic-json-rename` renames the same variable when the JSON path changes and the id stays, so a bound shape stays bound.
- `semantic-orphans` lists a Figma-only variable under Not in JSON and does not delete it.
- `semantic-primitives-untouched` does not change the `Primitives` collection.

## How to get to it (user POV)

- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Semantic — dry run`.
- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Semantic`.

Run `Sync Primitives` first when this file does not already have the primitive variables. Semantic sync only reads `Primitives`. It does not create them.

## Driving it with Figma desktop (CJ)

Preconditions:

- You are on a Mac, in the Figma desktop app. The browser at figma.com cannot load this plugin.
- The Camellia file is open, and you can edit it.
- In Terminal, from the repository folder, `npm run figma:build` finished on the revision you are testing. The last lines show the test summary and `figma-plugin/dist/code.js`. If that command prints an error, stop and send the output. Do not run the plugin.
- Import the plugin once: menu bar → Plugins → Development → Import plugin from manifest… → choose `figma-plugin/manifest.json` in the repository. If you already imported that file, skip this. Figma reads `figma-plugin/dist/code.js` each time you run a command. If the menu has no `Sync Semantic`, import the manifest again.
- Open the console: Plugins → Development → `Show/Hide console`. The plugin's report is in that window, not in Terminal. The short line at the bottom of Figma is the toast.
- Leave rectangle `61:117` as it is: fill bound to `feedback/success`, corners bound to `radius/xl`. Use a new rectangle for every semantic check below.

Words used below: a **collection** is the variables table. A **mode** is a column (`Light`, `Dark`). An **alias** is a link to another variable. The cell should show that variable's name, not a pasted hex or a plain number.

- **Inventory.** Choose `Inventory (read-only)`. The console includes `Collection "Primitives": 110 variables, modes: Value`. There is no `Semantic` collection yet. If `Primitives` is missing, run `Sync Primitives` and expect `Created 110` and `Errors 0`, then continue. If `Primitives` is already there from before primitive ids, run the migration in [Figma Primitives sync](./figma-primitives-sync.md) first. That dry run shows `Would create 0` and `Would update 110`. After that migration, `Sync Primitives` shows `Created 0` and `Updated 0`. Semantic sync only reads `Primitives`.
- **Two modes, discovered on the first real sync.** If the toast starts with `Camellia Sync failed:` and the text mentions `addMode` or `Limited to` modes, stop. This file's Figma plan cannot hold both `Light` and `Dark`. Send the toast and the console text. Do not keep retrying. If the error says an empty `Semantic` collection may now exist with only its first mode, you may delete that empty collection yourself. Do not delete a `Semantic` collection that already has variables.
- **Dry run.** Choose `Sync Semantic — dry run`. The toast is `Camellia · Semantic (dry run) · Would create 41 · Would update 0 · Unchanged 0 · Not in JSON 0 · Errors 0`. The console says `DRY RUN, nothing changed`. Close the variables dialog and reopen it: still no `Semantic` collection, and `Primitives` is unchanged.
- **Sync.** Choose `Sync Semantic`. The toast has `Created 41` and `Errors 0`. Open Local variables (the variables dialog). Collection `Semantic` exists. Its columns are `Light` then `Dark`, with `Light` first. That is check (a): both modes exist, Light first.
- **Second run.** Choose `Sync Semantic` again, before you edit anything. The toast has `Created 0` and `Updated 0`. The console does not list Created or Updated.
- **Spot checks** in Local variables. These are what tests cannot see.
  - `color/action/primary`: Light links to `color/primitive/blue/600`. Dark links to `color/primitive/blue/400`. The cells show those names, not a hex.
  - Check (b), translucent dark colors. Dark `color/border/subtle` links to `color/primitive/alpha/blue-400/18`, and the swatch looks translucent, not a solid blue. Same for Dark `color/border/default` (`color/primitive/alpha/blue-400/30`), Dark `color/border/strong` (`color/primitive/alpha/blue-400/50`), and Dark `color/functional/surface` (`color/primitive/alpha/green-400/12`). Write down whether each swatch looks translucent or solid.
  - `layout/content-gap/md` links to `space/4` in both modes.
  - With a selected layer, Dev Mode shows `var(--color-action-primary)` on `color/action/primary` and `var(--layout-content-gap-md)` on `layout/content-gap/md`.
  - `color/text/primary` appears in the text color picker. `color/surface/primary` appears for a frame fill. `color/primitive/blue/600` does not appear in those pickers. `feedback/success` still does.
  - Check (c), spacing scopes. On a frame that has auto layout, open the variable picker for the padding fields and for the gap field. Look for `control/padding-inline/md`. Write down which of those fields list it. `GAP` is the scope the plugin sets. Figma has no separate padding scope, so a padding field might or might not list it. Either result is worth reporting.
- **Rename, check (d).** On a new rectangle, not `61:117`:
  1. Bind its fill to `color/action/primary`. Switch that layer between Semantic `Light` and `Dark`. The color follows. `Primitives` can stay on `Value`.
  2. In Local variables, rename `color/action/primary` to `color/action/primary-renamed`. The rectangle stays filled by that variable under the new name.
  3. Choose `Sync Semantic`. The console lists an Updated line `color/action/primary [name] (VariableID:…)`. Copy that id. The name in the table is `color/action/primary` again. There is no second variable and no leftover `color/action/primary-renamed`.
  4. The rectangle is still bound to `color/action/primary`. The fill is not a loose hex, and it is not unbound. A binding stores the variable's id, so staying bound means it is the same variable.
  5. Choose `Sync Semantic` again. `Created 0` and `Updated 0`.
- **Binding after a token change.** Still on that new rectangle:
  1. In `tokens/camellia.tokens.json`, under `theme` → `light` → `color` → `action` → `primary`, change `"$value"` from `{color.primitive.blue.600}` to `{color.primitive.blue.700}`. Change nothing else.
  2. Run `npm run figma:build` again.
  3. Choose `Sync Semantic — dry run`, then `Sync Semantic`. The console lists `color/action/primary` under Updated, with `[Light value]` and the same `VariableID` you copied above.
  4. The rectangle stays bound and shows the new light color.
  5. Put the `$value` back to `{color.primitive.blue.600}`. Run `npm run figma:build`, then `Sync Semantic`. The original color is back, and the rectangle is still bound.
  6. `git status` does not list `tokens/camellia.tokens.json`.
- **Figma-only variable.** In `Semantic`, create a color variable by hand named `color/scratch`. Choose `Sync Semantic`. The console lists `color/scratch` under `In Figma but not in JSON (left untouched)`. It still exists. Delete `color/scratch` yourself when you are done. The plugin will not delete it.
- **Permanent ids, on a file that already has Semantic.** Do this after the steps above, or on the file you already synced with the previous plugin. That file's 41 variables are tagged with their names. This build tags them with a permanent id instead. If this file has no `Semantic` collection yet, skip to the rename steps after the first sync: that sync creates the 41 with ids already, so there is nothing to migrate.
  1. Choose `Sync Semantic — dry run`. The toast is `Camellia · Semantic (dry run) · Would create 0 · Would update 41 · Unchanged 0 · Not in JSON 0 · Errors 0`. The console lists 41 lines under `Would update`, each like `color/action/primary [token id, legacy token] (VariableID:…)`. Close and reopen Local variables. Nothing was written: the collection is unchanged.
  2. Choose `Sync Semantic`. The toast has `Created 0` and `Updated 41`. Copy the `VariableID` from the `color/action/primary` line.
  3. Choose `Sync Semantic` again. The toast has `Created 0` and `Updated 0`. The console does not list Created or Updated.
  4. Select rectangle `61:117`. Its fill is `feedback/success` and its corners are `radius/xl`. Write that down. Bind the fill to `color/action/primary`. Leave the corners on `radius/xl`. The fill follows Light and Dark.
  5. In `tokens/camellia.tokens.json`, rename `theme.light.color.action.primary` to `theme.light.color.action.main`, and rename `theme.dark.color.action.primary` to `theme.dark.color.action.main`. Move the whole object, including `$extensions`. Change no `$value`. The light and dark `id` stay the same, and they stay equal to each other.
  6. Rebuild the plugin without the test suite. From the repository folder run `npm run figma:typecheck` and then `npm run figma:bundle`. Do not run `npm run figma:build` while the token is renamed: that command also runs the tests, and the tests expect the name `color/action/primary`.
  7. Choose `Sync Semantic`. The console lists one Updated line, `color/action/main [name, code syntax] (VariableID:…)`, and that id is the one you copied. There is no second variable and no leftover `color/action/primary`. `Created 0`. Rectangle `61:117` is still bound to that variable. The fill is not a loose hex, and it is not unbound.
  8. Put both objects back to `primary`. Run `npm run figma:build`. Choose `Sync Semantic`. The name is `color/action/primary` again, the `VariableID` is the same, and the rectangle is still bound. Put the rectangle's fill back to `feedback/success`. `git status` does not list `tokens/camellia.tokens.json`.
- **Primitives untouched.** Inventory still shows `Collection "Primitives": 110 variables, modes: Value`. Spot-check one primitive value you already know. Rectangle `61:117` is still bound to `feedback/success` and `radius/xl`.

**What to send back**

If a step matches this list, one line is enough: the step name and the toast. If something does not match, send:

- the step you were on;
- the full toast, especially when it starts with `Camellia Sync failed:`;
- the console summary, and any Updated or Errors lines, including the `VariableID`;
- for (a), the mode names and which one is first;
- for (b), whether each of the four dark swatches looked translucent or solid;
- for (c), which fields listed `control/padding-inline/md` (padding, gap, both, or neither);
- for (d), the `VariableID`, whether the name came back, and whether the rectangle stayed bound;
- a screenshot of the `Semantic` collection when the modes or names look wrong.

Do not delete `Semantic` to get a clean retry, unless the failure is the empty one-mode collection described above.

## Gotchas

- Figma runs `figma-plugin/dist/code.js`, not the TypeScript you read in the repo. A JSON edit does nothing in Figma until `npm run figma:build` succeeds.
- Dry run writes nothing. After a dry run the file should look the same, including no new plugin data on the variables.
- The permanent id is shared plugin data. That works in the Figma desktop app and through the connector, and it stays if the plugin id changes. Private plugin data does neither. Other plugins can read the id. It is not a secret.
- The second `Sync Semantic`, before any experiment, is the no-change check. A later run can show an update because you renamed a variable or edited the JSON. That update is the repair. The run after the repair should again report no changes.
- Typing a description on a semantic variable in Figma does not stick. These tokens have no description in the JSON, so the next sync clears it.
- Renaming a semantic token in the JSON renames the same Figma variable when its id stays on the token. Do that only after the migration sync, on a file that already has the ids. If you rename the JSON before that migration, the old variable is left in place and a new one is created. The steps are in **Permanent ids, on a file that already has Semantic**. Revert the JSON and the rectangle when you are done.
- `npm run figma:build` fails while `color/action/primary` is temporarily renamed, because the tests expect that name. Use `npm run figma:typecheck` and `npm run figma:bundle` for that experiment, then `npm run figma:build` after you revert.
- A toast that starts with `Camellia Sync failed:` means the run stopped before writing, except for the rare case where `Semantic` was created and adding `Dark` then failed. The error text says which one it is.
