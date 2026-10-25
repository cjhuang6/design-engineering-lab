# Figma Text Style sync

CJ makes Figma's local text styles match the 13 typography tokens. A dry run prints what it would create, what it would update, and what it would leave alone, and it does not change the file. The real sync creates what is missing and updates what differs. Running it again, before anyone edits the file, changes nothing. A text style that exists only in Figma is listed and kept.

Run this on a duplicate or other scratch file. Leave the original Camellia file alone.

## Sub-features

- `text-style-dry-run` reports Would create, Would update, Unchanged, Not in JSON and Errors, and writes nothing.
- `text-style-create` creates the 13 named text styles when none of them exist.
- `text-style-idempotent` makes no changes on a second run.
- `text-style-names` uses the 13 approved names, grouped under `Camellia`.
- `text-style-binding` links family and weight to the font variables, or keeps the plain font name if Figma drops the link. Which one the file shows is still an open assumption.
- `text-style-line-height` stores line height in pixels. Whether the type panel shows those pixels is still an open assumption.
- `text-style-tracking` stores letter spacing as a percent, so `-0.02em` becomes `-2%`. Whether the type panel shows `-2%` is still an open assumption.
- `text-style-font-style` asks the font for `Regular`, `Medium`, or `SemiBold`. Whether those are the names Geist registers is still an open assumption.
- `text-style-orphans` lists a Figma-only text style under Not in JSON and does not delete it.

## How to get to it (user POV)

- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Text Styles — dry run`.
- Figma desktop → Plugins → Development → Camellia Figma Sync → `Sync Text Styles`.

Run `Sync Primitives` first when the scratch file does not already have the `Primitives` collection. Text style sync only reads the font variables in that collection. It does not create them, and it does not change `Semantic`.

## Driving it with Figma desktop (CJ)

Preconditions:

- You are on a Mac, in the Figma desktop app. The browser at figma.com cannot load this plugin.
- A duplicate or other scratch file is open, and you can edit it. Do not run these commands on the original Camellia file. The original file's id is `QT8VkiGlF7xo4Ky5TAliOh`.
- The scratch file has the `Primitives` collection, including `font/family/sans`, `font/family/mono`, `font/weight/regular`, `font/weight/medium`, and `font/weight/semibold`. A duplicate of the Camellia file already has them. On an empty scratch file, choose `Sync Primitives` first and expect `Created 110` and `Errors 0`.
- None of the 13 names below exist yet. If Inventory's text-style count is not 0, use a file that does not already contain these styles, or write down the styles that are already there before you start.
- In Terminal, from the repository folder, `npm run figma:build` finished on the revision you are testing. The last lines show the test summary and `figma-plugin/dist/code.js`. If that command prints an error, stop and send the output. Do not run the plugin.
- Import the plugin once: menu bar → Plugins → Development → Import plugin from manifest… → choose `figma-plugin/manifest.json` in the repository. If you already imported that file, the new lines still may be missing until you import it again. Figma reads `figma-plugin/dist/code.js` each time you run a command, but it reads the menu from the manifest. If the menu has no `Sync Text Styles — dry run`, import the manifest again.
- Open the console: Plugins → Development → `Show/Hide console`. The plugin's report is in that window, not in Terminal. The short line at the bottom of Figma is the toast.
- Geist and Geist Mono are installed on this Mac. Installing a font is a machine setup step. It is not a token change. If they are missing, the dry run says so and you stop there.

Words used below. A **text style** is Figma's package of a font, a size, a line height, and letter spacing. A text layer can use that package by name. The name is the whole string, for example `Camellia/Display/LG`. Slashes also group styles into folders. A **dry run** asks the plugin what it would change, and the plugin writes nothing. **Unchanged** means the style is already right, so the sync skips it. **Not in JSON** means the style exists only in Figma; the sync skips it and does not delete it. **Idempotent** means a second run creates no duplicates and changes nothing. A **binding** is a live link from the style's font family or weight to a variable. Change the variable, and the field follows. The **toast** is the one-line summary at the bottom of Figma. The **console** is the longer report.

- **Confirm the file.** Choose `Inventory (read-only)`. The console line `File:` is the scratch file's name, not the original. Write down `Text styles:` and the `Primitives` and `Semantic` collection lines. On a duplicate of the file checked on 2026-10-22, expect `Collection "Primitives": 110 variables, modes: Value`, a `Semantic` collection with 41 variables, and `Text styles:   0` unless you have added other styles.
- **Dry run.** Choose `Sync Text Styles — dry run`. On a file that has the font variables and none of the 13 styles, the toast is `Camellia · Text Styles (dry run) · Would create 13 · Would update 0 · Unchanged 0 · Not in JSON 0 · Errors 0`. The console says `Camellia · Sync Text Styles — DRY RUN, nothing changed`, then `Would create (13):` and the 13 names. Read that list before you sync. If `Errors` is not 0, stop. Do not run the real sync. The Errors lines name the family and the style that failed, and they list the style names that family does have. Send those lines. Nothing was written. No other font was substituted.
- **Nothing was written.** Choose `Inventory (read-only)` again. `Text styles:` is the same number as before the dry run. Choose Edit → Undo. There is nothing from the dry run to undo. `Primitives` and `Semantic` are unchanged.
- **Sync.** Choose `Sync Text Styles`. The toast has `Created 13` and `Errors 0`. The counts match the dry run, with "Would create" now reading "Created".
- **The 13 names.** Open the local text styles. One way: draw a text layer, and in the Text section of the right sidebar open the style menu. These 13 names are there, and no second copy of any of them:

  `Camellia/Display/LG`, `Camellia/Display/SM`, `Camellia/Heading/XL`, `Camellia/Heading/LG`, `Camellia/Heading/MD`, `Camellia/Heading/SM`, `Camellia/Body/LG`, `Camellia/Body/MD`, `Camellia/Body/SM`, `Camellia/Label/MD`, `Camellia/Label/SM`, `Camellia/Code/MD`, `Camellia/Code/SM`.

- **Open assumptions.** These four have not been seen in the Figma desktop app. The plugin writes them. Write down what the type panel actually shows. A different number or a dropped link is a finding, not a mistake in how you ran the checklist.

  1. **Font family and weight binding.** **Unknown** until you look. `Camellia/Display/LG` should be bound to `font/family/sans` and `font/weight/semibold`. `Camellia/Code/SM` should be bound to `font/family/mono` and `font/weight/regular`. `Camellia/Label/MD` should be bound to `font/family/sans` and `font/weight/medium`. `Camellia/Body/MD` should be bound to `font/family/sans` and `font/weight/regular`. If Figma drops the binding, the plain value stays: Geist or Geist Mono, and the style name from the next item. Report which one you see, the variable link or the plain value. Either result is the point of this check. Do not treat a dropped binding as a failed sync. Bring the screenshot back.
  2. **Pixel line heights.** **Unknown** until the type panel shows a unit. The plugin writes pixels, not a percent of the font size. `Camellia/Display/LG` is 52, `Camellia/Label/MD` is 20, `Camellia/Body/MD` is 24, and `Camellia/Code/SM` is 16. The full list, if you check the rest: Display/SM 44, Heading/XL 38, Heading/LG 34, Heading/MD 30, Heading/SM 26, Body/LG 28, Body/SM 20, Label/SM 16, Code/MD 20. Sizes next to those are 48, 40, 32, 28, 24, 20, 18, 16, 14, 14, 12, 14, and 12, in the same order as the names above.
  3. **Letter spacing from `-0.02em` to `-2%`.** **Unknown** until the type panel shows a number. The token's tracking is an em ratio. `-0.02em` means 2% tighter than the font's normal spacing. The plugin writes that as a percent: `-2` for tight, and `0` for normal. `Camellia/Display/LG` is the tight check (`-2%`). `Camellia/Body/MD`, `Camellia/Label/MD`, and `Camellia/Code/SM` are normal (`0%`). Display/SM, Heading/XL, and Heading/LG are also tight. The rest are normal. If the panel shows a different number, such as `-0.96` or `-0.02`, the percent scale was wrong. Send that number.
  4. **Weight style names.** **Unknown** until the font loads on this Mac. The plugin asks Geist for `Regular`, `Medium`, and `SemiBold`, and Geist Mono for `Regular`. `Camellia/Body/MD` is Regular, `Camellia/Label/MD` is Medium, `Camellia/Display/LG` is SemiBold, and `Camellia/Code/SM` is Geist Mono Regular. If those are not the names the font registers, the dry run already stopped you: its Errors lines list the names that family does have. Send that list. The sync does not switch to Inter or to a CSS fallback.

- **Second run.** Choose `Sync Text Styles` again, before you edit anything. The toast has `Created 0` and `Updated 0`. The console does not list Created or Updated. It says `Unchanged: 13`. The 13 styles are still one each. This is the no-op check.
- **A style that exists only in Figma.** Create a text style by hand named `Camellia/Scratch`. Choose `Sync Text Styles`. The console lists `Camellia/Scratch` under `In Figma but not in JSON (left untouched)`. It still exists. The 13 styles are not duplicated. Delete `Camellia/Scratch` yourself when you are done. The plugin will not delete it.
- **Variables untouched.** Choose `Inventory (read-only)`. The `Primitives` and `Semantic` lines match what you wrote down at the start. Text style sync does not write variables.

**What to send back**

If a step matches this list, one line is enough: the step name and the toast. If something does not match, send:

- the step you were on;
- the `File:` line, so it is clear this was the scratch file;
- the full toast, especially when it starts with `Camellia Sync failed:`;
- the console summary, and any Would create, Would update, Updated, or Errors lines;
- for the four open assumptions, what the type panel showed: variable link or plain font name, the line-height number and unit, the letter-spacing number and unit, and the style name (`Regular`, `Medium`, `SemiBold`, or whatever the panel used);
- a screenshot of `Camellia/Display/LG` and `Camellia/Code/SM` when the binding, the line height, or the letter spacing looks different from this list.

Do not delete the 13 styles to get a clean retry. Do not run this on the original file to get a clean retry.

## Gotchas

- Figma runs `figma-plugin/dist/code.js`, not the TypeScript you read in the repo. A checkout without `npm run figma:build` is not the plugin you are testing.
- New menu lines come from `figma-plugin/manifest.json`. If the menu still ends at `Sync Semantic`, import the manifest again.
- Dry run writes nothing, including no new text styles and no rename. After a dry run the file should look the same.
- The second `Sync Text Styles`, before any experiment, is the no-change check. A later run can show an update because you edited a style. That update is the repair. The run after the repair should again report no changes.
- A toast that starts with `Camellia Sync failed:` means the run stopped before writing. The usual cause on a scratch file is no `Primitives` collection, or font variables without their ids. Run `Sync Primitives` on that scratch file, then start again at the dry run.
- A missing Geist or Geist Mono fails the styles that need it and does not substitute another family. Install the font, reopen the desktop app, and run the dry run again.
- The four open assumptions are not proved by `npm test`. Those tests run against a fake Figma. Only this checklist, on a real file, shows what Figma keeps.
- The permanent id on a text style is shared plugin data. You do not need to read it for this checklist. Other plugins can read it. It is not a secret.
