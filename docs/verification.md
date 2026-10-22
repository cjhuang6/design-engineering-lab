# Verification

What each check proves and can't prove, the automated guardrails, and how implementation and verification are handed off. Step-by-step recipes for driving each feature live in the [verify-camellia skill](../.cursor/skills/verify-camellia/SKILL.md) and its [feature map](../.cursor/skills/verify-camellia/features/README.md). Reporting rules are in [AGENTS.md](../AGENTS.md#reporting-evidence).

## Prerequisites

- Node.js 22.18 or later (`package.json` `engines`). The tests import `.ts` files directly, which relies on Node's built-in TypeScript type stripping, on by default since 22.18. Last checked with Node 22.23.3.
- Dependencies installed with `npm ci`. Don't add or upgrade packages without CJ's approval.
- For Figma: the Figma desktop app (the browser version can't load local plugins) and edit access to the Camellia file (`QT8VkiGlF7xo4Ky5TAliOh`).

## Check inventory

| Command | Expected result | Can't prove |
|---|---|---|
| `npm run tokens:build` | `PASS — all 11 checks passed`, exit code 0 | That the CSS looks right in a browser, or that the token values are good design |
| `git diff --exit-code src/styles/tokens.css` (after the build) | Exit code 0: the committed CSS matches the JSON | Anything beyond freshness |
| `npm test` | `pass 99`, `fail 0` | Real Figma behavior. The sync tests run against a hand-written fake of the Figma variables API |
| `npm run figma:build` | Type check, tests, then `dist/code.js` (about 130 KB). Stops before bundling on any failure | That the bundle works in Figma |
| `npm run lint` | Exit code 0 | Anything about `.ts` or `.mjs` files: ESLint only covers `.js` and `.jsx` |
| `npm run build` | Vite build succeeds | That the demo app renders correctly |
| `node scripts/docs/check-feature-map.mjs` | `PASS`, exit code 0 | That the feature descriptions are accurate. It checks names, links, paths and structure only |
| `node --test tests/guardrails/*.test.mjs` | `pass 17`, `fail 0` | Real GitHub behavior for the approval tests. GitHub is simulated with a fake `gh` and throwaway repositories. Three further tests check that the demo only references generated custom properties; they do not open a browser |
| `git status --short` | Only the intended changes | Run it before and after checks to show nothing else changed |

**Figma behavior is proven only in Figma.** That means the Figma recipes in the feature map, run by CJ, or read-only inspection through the Figma MCP when the task authorizes it. Compilation and fake-Figma tests are never evidence of Figma behavior. Semantic sync's desktop proof is the [Semantic checklist](../.cursor/skills/verify-camellia/features/figma-semantic-sync.md): both modes, translucent dark aliases, spacing pickers, and a rename that keeps the binding. Primitive permanent ids are proved in Figma by the [Primitives checklist](../.cursor/skills/verify-camellia/features/figma-primitives-sync.md): a dry run that updates 110 and creates 0, a second run that changes nothing, and rectangle `61:117` still bound. `npm test` does not run those checklists.

## Guardrails

Automated checks that catch recurring mistakes. Each one names the failure it prevents and its limits.

### CI (`.github/workflows/ci.yml`)

Runs on every pull request and on pushes to `main`: `npm ci`, `tokens:build`, the `tokens.css` freshness diff, `figma:build`, `lint`, `build`, the feature-map check, and the AGENTS.md approval check's regression tests.

- **Prevents:** merging a change that breaks a build or a test, a hand-edited or stale `tokens.css`, and a feature map that names commands, scripts or files that no longer exist.
- **Limits:**
  - It can't run anything in Figma.
  - It never blocks merging: branch protection isn't available for this repository (see [GitHub settings](#github-settings)). A red ❌ is a warning that CJ treats as "don't merge."

### Feature map drift check (`scripts/docs/check-feature-map.mjs`)

- **Checks:**
  - every plugin menu command in `figma-plugin/manifest.json` is named in the map;
  - every `npm run <script>` in the map exists in `package.json`;
  - every repository path in the map exists;
  - the index links every feature file and nothing else;
  - each feature file has the four required headings, in order.
- **Prevents:** a map that silently drifts away from the code.
- **Limits:**
  - It can't tell whether a description is still true.
  - A new feature with no new menu command or path goes unnoticed until someone updates the map.

### AGENTS.md protection

The [protection policy](../AGENTS.md#protection-of-this-file) is enforced in two places:

1. **The written policy, locally.** Agents must not edit `AGENTS.md`; they propose the exact diff and CJ applies it. Nothing on CJ's computer blocks an edit. CJ decided on 2026-10-17 to remove the earlier Cursor hook, because its false positives interrupted autonomous runs and it could be bypassed.
2. **A CI check (`.github/workflows/agents-md-approval.yml`).**
   - It fails any pull request that changes `AGENTS.md` unless `cjhuang6` has approved **the exact version** in the pull request's current head.
   - A version is identified by its Git blob SHA, a fingerprint of the file's content: any edit gives a new fingerprint, and the same content always gives the same one.
   - On every run, whatever the event (opened, reopened, synchronize, edited, labeled, unlabeled, ready for review), it recomputes the fingerprint and looks for a matching approval comment. Nothing depends on removing a label or on what an earlier run did.
   - A push that changes only other files keeps the approval. A push that changes `AGENTS.md` needs a new approval, and approving version B never approves version C.
   - If it can't read the commits or the comments, or a comment has an unexpected shape, the check fails.
   - It runs on `pull_request_target`, so GitHub always uses the copy of the workflow and script on `main`. A pull request can't edit the check to skip itself, and its code is fetched for diffing but never run. The job only has read permissions.
   - **How CJ approves a version:**
     1. When the check fails, its log shows the diff command and the exact approval line, e.g. `/approve-agents-md 3b18e512dba79e4c8300dd08aeb37f8e728b8dad`.
     2. CJ reviews the diff and posts that line, on its own line, as a pull request comment.
     3. CJ re-runs the failed check from the Checks tab, or adds or removes any label to trigger it.
   - **Deleting the file** needs the line `/approve-agents-md deleted`.
   - **Only CJ resolves a failure.** The failure message tells agents not to post the approval comment, re-run the check to get around it, or change the check. This matters for pstack's autopilot, which tries to clear failing checks.

**Limits.** This is a guardrail, not a security boundary.

- Nothing blocks a local edit. Cursor reads `AGENTS.md` from the working folder, so an unapproved local edit changes the instructions for agents in that checkout right away, before any pull request. It shows up in `git status` and can't reach `main` without CJ's approval.
- An approval comment counts if `cjhuang6` posted or edited it. Anything using CJ's GitHub credentials can post one. Approval follows content, so reverting to a previously approved version is approved again. The approval line counts wherever it stands on its own line in CJ's comment, including inside a quoted or code block.
- A failing check doesn't block the Merge button. GitHub only shows "Some checks were not successful." CJ is the only one who merges and treats a red ❌ as "don't merge."
- Approval covers the head version of `AGENTS.md`, not the merge result. If `main` changes the file while the pull request is open, the merge can differ. Before merging an approved `AGENTS.md` change, CJ updates the branch from `main` if GitHub offers "Update branch," which re-runs the check.
- Because the check runs from `main`, a pull request that changes the check itself still runs `main`'s copy. The change takes effect only after merge.
- Changes committed and pushed directly to `main` skip both checks, and nothing on GitHub prevents that. Every change reaches `main` through a pull request, including CJ's own small edits.
- Anything acting with CJ's GitHub credentials looks like CJ.

### GitHub settings

**No branch protection.** The repository is private on GitHub's free plan, which doesn't offer branch protection rules or rulesets for private repositories (observed 2026-10-17: the API answered "Upgrade to GitHub Pro or make this repository public to enable this feature"). CJ chose not to upgrade or make the repository public. The checks still run on every pull request; they just can't block merging.

If that changes (GitHub Pro, or a public repository), protect `main` under Settings → Branches → Add branch protection rule:

- require a pull request before merging;
- require the status checks `checks` (CI) and `approval` (AGENTS.md approval) to pass. They appear in the list after each has run once;
- require branches to be up to date before merging.

No label is needed. Approval is a comment, and labels only serve as an optional way to re-trigger the check.

## Implement/verify handoff

For substantive changes, implementation and verification are done by different agents. Trivial changes may skip this; the report must say so.

1. **Implementer.**
   - Starts from a task brief: phase, scope, acceptance criteria, verification plan. For Phase 2C, the [roadmap brief](token-pipeline-roadmap.md#phase-2c-task-brief).
   - Implements, runs the relevant checks above, and hands off a report in the [AGENTS.md format](../AGENTS.md#reporting-evidence).
2. **Verifier.** A fresh agent with no stake in the implementation. It receives the task brief, the diff, and the implementer's report, then:
   - reads the diff against each acceptance criterion;
   - runs the relevant checks itself rather than trusting the report;
   - exercises the behavior with the matching feature recipe. For Figma, it asks CJ to run the Figma recipe;
   - reports pass or fail for each criterion, with evidence.
3. **Fixes go back to the implementer.** The verifier never edits the work under review, and never weakens a criterion or a test to make it pass.
4. **CJ decides.** CJ receives both reports and decides whether to accept, request fixes, or open the PR.

A starting prompt for the verifier:

> You are the independent verifier. Read `AGENTS.md`, then `docs/verification.md`. Here are the task brief, the diff and the implementer's report: … Check each acceptance criterion against the diff, run the relevant checks yourself, and exercise the behavior with `.cursor/skills/verify-camellia`. Report pass or fail per criterion, with the evidence. Do not edit the code under review.
