---
name: verify-camellia
description: Verify the Camellia design-token pipeline the way a user exercises it. Covers the terminal (CSS token build and check, Figma plugin build and tests, demo app) and the Camellia Figma Sync plugin in the Figma desktop app. Use it to prove a change works, to verify another agent's work, or before reporting completion.
---

# Verify Camellia

Camellia has two surfaces. The **terminal** is fully drivable by an agent. **Figma** is driven by CJ in the Figma desktop app: an agent can't run the plugin's menu commands. An agent may read the file through the Figma MCP only when the task explicitly authorizes it.

Read [the feature map](features/README.md) first, then the feature file you're verifying. Command limits and the review process live in [docs/verification.md](../../../docs/verification.md).

## Launch

- Install dependencies with `npm ci` (no changes to the manifest or lockfile).
- **Terminal:** nothing to keep running. Each check is a one-shot command run from the repository root.
- **Figma:** run `npm run figma:build`. Ready means the output ends with `figma-plugin/dist/code.js` and a size of about 112 KB. Then CJ runs the plugin from Figma desktop → Plugins → Development → Camellia Figma Sync.
- **Demo app:** `npm run dev` serves at the URL Vite prints. Stop it with Ctrl+C when done.

## Doctor

Run this read-only check first, and again whenever anything looks off:

```sh
node -v && git rev-parse --short HEAD && git status --short && npm run tokens:check
```

Worth driving when Node is 22.18 or later, the revision is the one under test, `git status` shows only the intended changes, and the check ends with `PASS — all 11 checks passed`. For Figma, CJ confirms that the console shows the expected plugin and file before any sync.

## Drive

Use the `Driving it with …` section of each [feature file](features/README.md). Terminal recipes are exact commands. Figma recipes are exact menu paths and console lines for CJ to run and report back.

## Evidence

- **Terminal:** the command, its stdout or summary lines, and its exit code.
- **Figma:** the console summary line, the per-variable lines for anything updated (including variable IDs), and CJ's confirmation of what changed in the file.
- **Every report:** the revision tested and whether the working tree had uncommitted changes.
- Exercise the real path. Tests against the fake Figma prove logic only; they are never evidence of Figma behavior.
- Keep evidence in the report or in a scratch directory outside the repository, e.g. `/tmp/camellia-verify-<date>/`.

## Cleanup

- Revert any temporary JSON change used for a binding-survival test, rebuild, and confirm `git status` is clean apart from the intended work.
- Delete temporary CSS copies used for failure testing.
- Stop only processes this run started, such as a dev server.
- Keep the evidence.

## Helpers

- `node scripts/tokens/check-css.mjs <file.css>` validates any CSS file against the token JSON. Use a broken copy to prove the check can fail.
- `node scripts/docs/check-feature-map.mjs` checks that this feature map still matches the code (see [docs/verification.md](../../../docs/verification.md#guardrails)).
