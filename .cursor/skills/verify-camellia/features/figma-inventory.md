# Figma Inventory

CJ runs a read-only command in Figma that lists every local variable collection (its variable count and mode names) and the number of local variables and text, effect and paint styles. It never changes the file.

## Sub-features

- `inventory-collections` lists each collection with its variable count and modes.
- `inventory-styles` reports the text, effect and paint style counts.
- `inventory-read-only` leaves the file unchanged, and repeated runs give identical output.

## How to get to it (user POV)

- Figma desktop → Plugins → Development → Camellia Figma Sync → `Inventory (read-only)`.
- Running the plugin without choosing a command also runs Inventory.

## Driving it with Figma desktop (CJ)

Preconditions:

- `npm run figma:build` succeeded on the revision under test.
- The console is open: Plugins → Development → `Show/Hide console`.

- **Run inventory.** Choose `Inventory (read-only)`. The console starts with `Camellia Figma Sync — read-only inventory`, then lists each collection, e.g. `Collection "Primitives": 110 variables, modes: Value`, then the variable and style counts. The toast reads `Camellia Sync ready · N collections, N variables, N text, N effect, N paint styles`.
- **Read-only.** Choose Edit → Undo. There's nothing from the plugin to undo.
- **Repeatable.** Run it again. The console output is identical.

## Gotchas

- Output appears in the Figma console, not in the Mac Terminal.
- The browser version of Figma can't run local development plugins.
- The `File:` line shows which file the plugin is running in. Check it before trusting the counts.
