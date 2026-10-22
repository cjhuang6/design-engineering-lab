# CSS tokens

A developer generates `src/styles/tokens.css` from `tokens/camellia.tokens.json`, then validates the result. Light-mode and mode-independent tokens land in `:root` and dark overrides in `[data-theme="dark"]`. References become `var(--…)`, and Frost and expression recipes are composed into ready-to-use values. The generated file is committed and never edited by hand.

## Sub-features

- `css-build` writes `tokens.css` deterministically from the JSON.
- `css-build-fails-loudly` stops with an error for a token type with no serializer, a missing reference, or a top-level group with no output section.
- `css-check` independently re-derives the expected CSS and runs 11 checks.
- `css-check-fails` exits with code 1 and names the problem when the CSS is wrong.
- `css-committed` means the committed `tokens.css` matches a fresh build.

## How to get to it (user POV)

- `npm run tokens:build` builds, then checks.
- `npm run tokens:css` builds only.
- `npm run tokens:check` checks the committed file.
- `node scripts/tokens/check-css.mjs <file.css>` checks any CSS file.

## Driving it with the terminal

Preconditions:

- Dependencies are installed and the working tree is clean apart from the intended changes.

- **Build and check.** Run `npm run tokens:build`. The output shows `✓ Generated src/styles/tokens.css`, 11 ✔ check lines, then `PASS — all 11 checks passed`. Exit code `0`.
- **Committed file matches.** Right after the build, run `git diff --exit-code src/styles/tokens.css`. Exit code `0`, no output.
- **Check can fail.** Copy `src/styles/tokens.css` to `/tmp/camellia-broken.css`, delete one `--color-` declaration from the copy, then run `node scripts/tokens/check-css.mjs /tmp/camellia-broken.css`. The output contains ✖ lines naming the missing variable. Exit code `1`. Delete the copy afterwards.

## Gotchas

- Editing `tokens.css` by hand passes nothing durable: the next build overwrites it. Change the JSON instead.
- The check reads the JSON and the CSS only. It can't tell whether the CSS looks right in a browser or whether the values are good design.
- Running the build changes `tokens.css` whenever the JSON changed. Commit both together.
