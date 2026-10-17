# Figma Primitives sync

CJ makes the Figma `Primitives` collection match the primitive tokens in the token JSON: 110 variables in one `Value` mode, named by token path (e.g. `color/primitive/blue/600`), with scopes, a WEB code syntax of `var(--…)` and descriptions. A dry run reports what would change without writing anything. The real sync creates missing variables and updates differing ones in place, keeping their IDs, so layers bound to them stay bound. Variables that exist only in Figma are reported, never deleted.

## Sub-features

- `sync-dry-run` reports Would create, Would update, Unchanged, Not in JSON and Errors, and writes nothing.
- `sync-create` creates missing variables. On an empty file it creates 110.
- `sync-idempotent` makes no writes on a second run without JSON changes.
- `sync-update-in-place` updates a changed token's value under the same variable ID.
- `sync-binding-survival` keeps a bound layer on the same variable while it shows the new value.
- `sync-orphans` reports Figma-only variables as Not in JSON without deleting them.
- `sync-stops-safely` stops before writing when there are duplicate collections, a mode count other than 1, duplicate names, or a type conflict.
- `sync-visibility` hides primitive colors from pickers while feedback colors stay visible. Opacity shows as a percentage.

## How to get to it (user POV)

- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Primitives — dry run`.
- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Primitives`.

## Driving it with Figma desktop (CJ)

Preconditions:

- `npm run figma:build` succeeded on the revision under test.
- The console is open: Plugins → Development → `Show/Hide console`.
- For binding survival, a layer is bound to a primitive. The established layer is rectangle `61:117`: fill bound to `feedback/success`, corners bound to `radius/xl`.

- **Dry run.** Choose `Sync Primitives — dry run`. The toast reads `Camellia · Primitives (dry run) · Would create N · Would update N · Unchanged N · Not in JSON N · Errors N`. Nothing in the file changes.
- **Sync.** Choose `Sync Primitives`. The counts match the dry run. On an empty file: `Created 110` and `Errors 0`.
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

## Gotchas

- Figma runs the bundle, not the source. Forgetting `npm run figma:build` after a JSON change makes the sync look like it ignored the change.
- Figma stores numbers at 32-bit precision. The sync compares with a tolerance, so tiny float differences don't count as updates.
- Renaming a token in the JSON looks like a delete plus an add: the old variable becomes Not in JSON and bindings stay on it. There is no rename workflow yet.
- A failure that stops the whole run shows a toast starting with `Camellia Sync failed:`. Nothing was written when the stop came from a preflight check.
