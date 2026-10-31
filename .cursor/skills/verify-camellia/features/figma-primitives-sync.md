# Figma Primitives sync

CJ makes the Figma `Primitives` collection match the primitive tokens in the token JSON: 118 variables in one `Value` mode, named by token path (e.g. `color/primitive/blue/600`), with scopes, a WEB code syntax of `var(--…)` and descriptions. Each primitive token has a permanent id, so renaming that token in the JSON renames the same Figma variable and a shape bound to it stays bound. A dry run reports what would change without writing anything. The real sync creates missing variables and updates differing ones in place, keeping their IDs. Variables that exist only in Figma are reported, never deleted. On a file synced before these ids existed, the first sync tags the 110 variables and creates none.

## Sub-features

- `sync-dry-run` reports Would create, Would update, Unchanged, Not in JSON and Errors, and writes nothing.
- `sync-create` creates missing variables. On an empty file it creates 118.
- `sync-idempotent` makes no writes on a second run without JSON changes.
- `sync-update-in-place` updates a changed token's value under the same variable ID.
- `sync-binding-survival` keeps a bound layer on the same variable while it shows the new value.
- `sync-orphans` reports Figma-only variables as Not in JSON without deleting them.
- `sync-stops-safely` stops before writing when there are duplicate collections, a mode count other than 1, duplicate names, or a type conflict.
- `sync-visibility` hides primitive colors from pickers while feedback colors stay visible. Opacity shows as a percentage.
- `sync-id-migration` tags the 110 variables that were matched by name, creates none, and deletes none.
- `sync-json-rename` renames the same variable when the JSON path changes and the id stays, so a bound shape stays bound.

## How to get to it (user POV)

- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Primitives — dry run`.
- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Primitives`.

## Driving it with Figma desktop (CJ)

Preconditions:

- `npm run figma:build` succeeded on the revision under test.
- The console is open: Plugins → Development → `Show/Hide console`.
- For binding survival, a layer is bound to a primitive. The established layer is rectangle `61:117`: fill bound to `feedback/success`, corners bound to `radius/xl`.

- **Dry run.** Choose `Sync Primitives — dry run`. The toast reads `Camellia · Primitives (dry run) · Would create N · Would update N · Unchanged N · Not in JSON N · Errors N`. Nothing in the file changes. On the file from 2026-10-13, follow **Permanent ids** below: that dry run creates 0 and updates 110.
- **Sync.** Choose `Sync Primitives`. The counts match the dry run. On an empty file: `Created 118` and `Errors 0`.
- **Idempotency.** Choose `Sync Primitives` again. `Created 0` and `Updated 0`.
- **Spot checks.** In Local variables:
  - names are grouped by `/`;
  - primitive colors don't appear in the fill picker, but `feedback/*` colors do;
  - Dev Mode shows `var(--…)` code syntax;
  - `opacity/64` shows as 64%.
- **Binding survival.**
  1. Change the value of `feedback/success` in the JSON and run `npm run figma:build`.
  2. Run the dry run, then the sync. The console lists `feedback/success [value] (VariableID:…)` under Updated, with the same ID as before.
  3. Rectangle `61:117` stays bound to `feedback/success` and shows the new color.
  4. Revert the JSON, rebuild and sync again. The original color returns, still bound.
  5. `git status` is clean apart from the intended work.
- **Orphans.** If any variable in `Primitives` isn't in the JSON, the console lists it under `In Figma but not in JSON (left untouched)` and it still exists after the sync.
- **Permanent ids, on the file that already has Primitives.** The file from 2026-10-13 has 110 variables and no permanent id. This build tags them. A **permanent id** is a short code stored on the token (`prim-` plus 6 hex characters). It is not the name you see in the variables table. **Shared plugin data** is a note Figma keeps on the variable, readable by plugins, including after this plugin is published. **Migration** is the first sync that writes that note onto the variables you already have, instead of making new ones. **Idempotent** means a second run, with no JSON change, reports no creates and no updates.

  1. Choose `Inventory (read-only)`. The console includes `Collection "Primitives": 110 variables, modes: Value`. Select rectangle `61:117`. Its fill is `feedback/success` and its corners are `radius/xl`. Leave it that way.
  2. Choose `Sync Primitives — dry run`. The toast is `Camellia · Primitives (dry run) · Would create 0 · Would update 110 · Unchanged 0 · Not in JSON 0 · Errors 0`. The console lists 110 lines under `Would update`, each like `feedback/success [token id] (VariableID:…)`. Close and reopen Local variables. Nothing was written: names and values are unchanged, and the rectangle is still bound.
  3. Choose `Sync Primitives`. The toast has `Created 0` and `Updated 110`. Copy the `VariableID` from the `feedback/success` line and from the `radius/xl` line.
  4. Choose `Sync Primitives` again. The toast has `Created 0` and `Updated 0`. The console does not list Created or Updated.
  5. Rectangle `61:117` is still bound to `feedback/success` and `radius/xl`. The fill is not a loose hex, and the corners are not unbound. A binding stores the variable's id, so staying bound means it is the same variable.
  6. Optional, after step 4. In `tokens/camellia.tokens.json`, rename one primitive by moving the whole object, including `$extensions`, and keep its `id`. Update every semantic `$value` that named the old path, for example `{color.primitive.blue.600}`, to the new path. Change no color and no number. Rebuild with `npm run figma:typecheck` and then `npm run figma:bundle`. Do not run `npm run figma:build` while the name is changed: that command runs the tests, and the tests expect the old name. Choose `Sync Primitives`. The console lists one Updated line for the new name, with `[name, code syntax]` and the same `VariableID` the variable had before the rename. There is no second variable and no leftover under the old name. `Created 0`. The rectangle stays bound. Put the token back, run `npm run figma:build`, and sync again. The old name returns, the `VariableID` is the same, and the rectangle is still bound. `git status` does not list `tokens/camellia.tokens.json`.

If this file has no `Primitives` collection yet, skip the migration: the first real sync creates the 118 with ids already. The dry run then says `Would create 118` and `Would update 0`.

## Gotchas

- Figma runs the bundle, not the source. Forgetting `npm run figma:build` after a JSON change makes the sync look like it ignored the change.
- Figma stores numbers at 32-bit precision. The sync compares with a tolerance, so tiny float differences don't count as updates.
- The permanent id is shared plugin data. That works in the Figma desktop app and through the connector, and it stays if the plugin id changes. Private plugin data does neither. Other plugins can read the id. It is not a secret.
- Renaming a primitive in the JSON renames the same Figma variable when its id is already stored on that variable. Do that only after the migration sync. If you rename the JSON before that migration, the old variable is left in place and a new one is created. The steps are in **Permanent ids, on the file that already has Primitives**. Revert the JSON and the rectangle when you are done.
- `npm run figma:build` fails while a primitive is temporarily renamed, because the tests expect the old name. Use `npm run figma:typecheck` and `npm run figma:bundle` for that experiment, then `npm run figma:build` after you revert.
- A failure that stops the whole run shows a toast starting with `Camellia Sync failed:`. Nothing was written when the stop came from a preflight check.
