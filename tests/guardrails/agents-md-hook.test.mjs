import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const HOOK = resolve(".cursor/hooks/protect-agents-md.mjs");
const ROOT = "/workspace/camellia";

function decide(input) {
  const output = execFileSync("node", [HOOK], { input: JSON.stringify({ workspace_roots: [ROOT], ...input }) });
  return JSON.parse(output.toString()).permission;
}

const shell = (command) => decide({ hook_event_name: "beforeShellExecution", command });
const edit = (file_path) => decide({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { file_path } });

function expectAll(expected, commands) {
  for (const command of commands) assert.equal(shell(command), expected, command);
}

test("ordinary reads of AGENTS.md stay allowed", () => {
  expectAll("allow", [
    "cat AGENTS.md",
    "head -n 20 AGENTS.md",
    "tail -n 5 AGENTS.md",
    "wc -l AGENTS.md",
    "ls -la AGENTS.md",
    'rg -n "Protection of this file" AGENTS.md',
    "rg -C 2 -e pstack AGENTS.md",
    "rg --ignore-case --context=3 pstack AGENTS.md",
    "rg -- --pre AGENTS.md",
    "grep -n pstack AGENTS.md",
    "git diff AGENTS.md",
    "git diff --stat main -- AGENTS.md",
    "git diff --no-index AGENTS.md /tmp/AGENTS.proposed.md",
    "git log --oneline -5 -- AGENTS.md",
    "git show --stat HEAD -- AGENTS.md",
    "git status --short AGENTS.md",
    "git blame AGENTS.md",
    `cd ${ROOT} && git diff AGENTS.md`,
  ]);
});

test("explicitly permitted staging stays allowed", () => {
  expectAll("allow", ["git add AGENTS.md", "git add AGENTS.md docs/verification.md"]);
});

test("commands that don't mention AGENTS.md are not inspected", () => {
  expectAll("allow", ["npm test", "git commit -m 'docs: update roadmap'"]);
});

test("direct edits of AGENTS.md stay blocked", () => {
  assert.equal(edit(`${ROOT}/AGENTS.md`), "deny");
  assert.equal(edit("agents.md"), "deny");
  expectAll("deny", [
    "cat x > AGENTS.md",
    "echo hi >> AGENTS.md",
    "sed -i '' s/a/b/ AGENTS.md",
    "mv AGENTS.md x",
    "rm AGENTS.md",
    "cp /tmp/x AGENTS.md",
    "git checkout -- AGENTS.md",
    `cd ${ROOT} && rm AGENTS.md`,
    "cd nonexistentdir>AGENTS.md && ls",
    "cd x>>AGENTS.md && cat AGENTS.md",
    "cd x<AGENTS.md && ls",
    "cd $(touch AGENTS.md) && ls",
    "cd 'x>AGENTS.md' && ls",
    "git diff AGENTS.md && rm AGENTS.md",
    "cat AGENTS.md | tee AGENTS.md",
  ]);
});

test("rg --pre, which runs an external program, is blocked in every form", () => {
  expectAll("deny", [
    "rg --pre ./preprocessor instructions AGENTS.md",
    "rg --pre=./preprocessor instructions AGENTS.md",
    "rg -n --pre ./preprocessor instructions AGENTS.md",
    "rg instructions AGENTS.md --pre ./preprocessor",
    "rg --pre-glob '*.md' --pre ./preprocessor instructions AGENTS.md",
    'rg "--pre=./preprocessor" instructions AGENTS.md',
    "rg -z instructions AGENTS.md",
    "rg -nz instructions AGENTS.md",
    "rg --search-zip instructions AGENTS.md",
  ]);
});

test("other execution-capable or uncertain forms are blocked", () => {
  expectAll("deny", [
    "git diff --output=AGENTS.md",
    "git diff --output AGENTS.md",
    "git diff --ext-diff AGENTS.md",
    "git show --textconv HEAD:AGENTS.md",
    "git -c diff.external=./x diff AGENTS.md",
    "GIT_EXTERNAL_DIFF=./x git diff AGENTS.md",
    "RIPGREP_CONFIG_PATH=./x rg foo AGENTS.md",
    "less AGENTS.md",
    "tail -f AGENTS.md",
    "find . -name AGENTS.md -exec rm {} +",
    "xargs rm < list AGENTS.md",
    "node -e \"require('fs').writeFileSync('AGENTS.md','')\"",
    "rg $(cat cmd) AGENTS.md",
    "rg `cat cmd` AGENTS.md",
    "rg 'unterminated AGENTS.md",
    "/usr/bin/rg foo AGENTS.md",
    "git add -p AGENTS.md",
  ]);
});

test("edits to other files, including a nested AGENTS.md, stay allowed", () => {
  assert.equal(edit(`${ROOT}/docs/verification.md`), "allow");
  assert.equal(edit(`${ROOT}/foo/AGENTS.md`), "allow");
});
