import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(".github/scripts/check-agents-md-approval.sh");
const APPROVER = "cjhuang6";

let dir;
let work;
let bin;
const commits = {};

const git = (...args) => execFileSync("git", args, { cwd: work }).toString().trim();
const write = (name, content) => writeFileSync(join(work, name), content);
const commit = (message) => {
  git("add", "-A");
  git("commit", "-qm", message);
  return git("rev-parse", "HEAD");
};
const blob = (sha) => git("rev-parse", `${sha}:AGENTS.md`);
const approval = (login, body) => ({ user: { login }, body });

before(() => {
  dir = mkdtempSync(join(tmpdir(), "agents-md-approval-"));
  work = join(dir, "repo");
  bin = join(dir, "bin");
  mkdirSync(work);
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
echo "$*" >> "$FAKE_GH_LOG"
if [ -n "\${FAKE_GH_FAIL:-}" ]; then echo "HTTP 502: Bad Gateway" >&2; exit 1; fi
page=$(sed -E 's/.*[?&]page=([0-9]+).*/\\1/' <<<"$2")
file="$FAKE_GH_PAGES/page-$page.json"
if [ -f "$file" ]; then cat "$file"; else echo "[]"; fi
`);
  chmodSync(join(bin, "gh"), 0o755);

  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  write("AGENTS.md", "base\n");
  write("other.txt", "1\n");
  commits.base = commit("base");

  write("AGENTS.md", "version A\n");
  commits.versionA = commit("version A");
  write("other.txt", "2\n");
  commits.versionAPlusOther = commit("unrelated change after A");
  write("AGENTS.md", "version B\n");
  commits.versionB = commit("version B");

  git("checkout", "-q", "-b", "other-only", commits.base);
  write("other.txt", "only this\n");
  commits.otherOnly = commit("unrelated only");

  git("checkout", "-q", "-b", "rewritten", commits.base);
  write("other.txt", "rewritten history\n");
  write("AGENTS.md", "version A\n");
  commits.rewrittenSameA = commit("force-pushed rewrite with version A content");

  git("checkout", "-q", "-b", "deleted", commits.base);
  git("rm", "-q", "AGENTS.md");
  commits.deleted = commit("delete");
});

after(() => rmSync(dir, { recursive: true, force: true }));

function run({ head, base = commits.base, pages = [], ghFail = false, rawPages, action = "synchronize" }) {
  const pagesDir = mkdtempSync(join(dir, "pages-"));
  const log = join(pagesDir, "gh.log");
  const contents = rawPages ?? pages.map((page) => JSON.stringify(page));
  contents.forEach((content, index) => writeFileSync(join(pagesDir, `page-${index + 1}.json`), content));
  const result = spawnSync("bash", [SCRIPT], {
    cwd: work,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      REPO: "owner/repo",
      PR: "7",
      BASE: base,
      HEAD: head,
      APPROVER,
      ACTION: action,
      FAKE_GH_PAGES: pagesDir,
      FAKE_GH_LOG: log,
      ...(ghFail ? { FAKE_GH_FAIL: "1" } : {}),
    },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    ghCalls: existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [],
  };
}

test("a pull request that doesn't change AGENTS.md passes without needing any evidence", () => {
  const result = run({ head: commits.otherOnly, ghFail: true });
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(result.ghCalls, []);
});

test("CJ's approval of the current version passes", () => {
  const result = run({ head: commits.versionA, pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
  assert.equal(result.status, 0, result.output);
});

test("version A approved, then version B pushed, fails", () => {
  const result = run({ head: commits.versionB, pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, new RegExp(`/approve-agents-md ${blob(commits.versionB)}`));
  assert.match(result.output, /Agents must not post this comment/);
});

test("a stale approval stays rejected on reopened and unrelated label events, and labels are never consulted", () => {
  for (const action of ["reopened", "labeled", "unlabeled", "edited"]) {
    const result = run({ action, head: commits.versionB, pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
    assert.equal(result.status, 1, `${action}: ${result.output}`);
    assert.ok(result.ghCalls.every((call) => !/labels|events/.test(call)), result.ghCalls.join("\n"));
  }
});

test("a later push that changes only unrelated files keeps the approval", () => {
  const result = run({ head: commits.versionAPlusOther, pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
  assert.equal(result.status, 0, result.output);
});

test("CJ freshly approving version B passes", () => {
  const result = run({
    head: commits.versionB,
    pages: [[
      approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`),
      approval(APPROVER, `Reviewed again.\r\n/approve-agents-md ${blob(commits.versionB)}  \r\n`),
    ]],
  });
  assert.equal(result.status, 0, result.output);
});

test("an approval line from anyone other than CJ is ignored", () => {
  const result = run({ head: commits.versionB, pages: [[approval("some-bot", `/approve-agents-md ${blob(commits.versionB)}`)]] });
  assert.equal(result.status, 1, result.output);
});

test("the approval must be its own line, not part of a sentence", () => {
  const result = run({
    head: commits.versionB,
    pages: [[approval(APPROVER, `I will post /approve-agents-md ${blob(commits.versionB)} after lunch`)]],
  });
  assert.equal(result.status, 1, result.output);
});

test("an approval on a later page of comments is found", () => {
  const noise = Array.from({ length: 100 }, (_, i) => approval("someone", `comment ${i}`));
  const result = run({ head: commits.versionB, pages: [noise, [approval(APPROVER, `/approve-agents-md ${blob(commits.versionB)}`)]] });
  assert.equal(result.status, 0, result.output);
});

test("a force-push that rewrites history but keeps the approved content passes", () => {
  const result = run({ head: commits.rewrittenSameA, pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
  assert.equal(result.status, 0, result.output);
});

test("a head commit that is unavailable after a force-push fails", () => {
  const result = run({ head: "1234567890abcdef1234567890abcdef12345678", pages: [[approval(APPROVER, `/approve-agents-md ${blob(commits.versionA)}`)]] });
  assert.equal(result.status, 1, result.output);
});

test("an unavailable base commit fails", () => {
  const result = run({ base: "1234567890abcdef1234567890abcdef12345678", head: commits.versionA });
  assert.equal(result.status, 1, result.output);
});

test("unavailable approval evidence fails", () => {
  const cases = {
    "API error": { ghFail: true },
    "malformed JSON": { rawPages: ["[{\"user\":"] },
    "not a list": { rawPages: [JSON.stringify({ message: "Not Found" })] },
    "comment without an author": { rawPages: [JSON.stringify([{ body: `/approve-agents-md ${blob(commits.versionB)}` }])] },
  };
  for (const [name, options] of Object.entries(cases)) {
    const result = run({ head: commits.versionB, ...options });
    assert.equal(result.status, 1, `${name}: ${result.output}`);
  }
});

test("deleting AGENTS.md needs an explicit deletion approval", () => {
  assert.equal(run({ head: commits.deleted }).status, 1);
  assert.equal(run({ head: commits.deleted, pages: [[approval(APPROVER, "/approve-agents-md deleted")]] }).status, 0);
});
