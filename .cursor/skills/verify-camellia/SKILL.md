---
name: verify-camellia
description: Verify the Camellia design-token pipeline the way a user exercises it. Covers the terminal (CSS token build and check, Figma plugin build and tests, demo app) and the Camellia Figma Sync plugin in the Figma desktop app. Use it to prove a change works, to verify another agent's work, or before reporting completion.
---

# Verify Camellia

The feature checklists live in [docs/verification/](../../../docs/verification/README.md). That directory is the only copy. Read the index, then the feature file for the feature you are verifying.

What each check proves, and how implementation hands off to verification, is in [docs/verification.md](../../../docs/verification.md).

Run this read-only check before driving a feature, from the repository root:

```sh
node -v && git rev-parse --short HEAD && git status --short && npm run tokens:check
```

Terminal recipes are commands. Figma recipes are menu paths CJ runs in the Figma desktop app. He reports the console lines. An agent does not write to Figma unless the task explicitly authorizes it.
