import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const SCRIPT = resolve("scripts/guardrails/check-no-new-comments.mjs");
const FIX =
  "Remove the comment and make the code say it (a clearer name, a named constant, a test). If it's a legal notice, a tooling directive, or an outside constraint the code can't show, use the allowed form: `external: <the outside thing>`.";
const EXTERNAL = "External-constraint comments for CJ to review";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "no-new-comments-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  return dir;
}

function write(dir, path, content) {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", message]);
  return git(dir, ["rev-parse", "HEAD"]).trim();
}

function run(dir, base, env = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, base], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function withRepo(fn) {
  const dir = initRepo();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function addFile(dir, path, content) {
  write(dir, "seed.js", "export const seed = 1;\n");
  const base = commitAll(dir, "base");
  write(dir, path, content);
  commitAll(dir, "add");
  return run(dir, base);
}

function changeFile(dir, path, before, after) {
  write(dir, path, before);
  const base = commitAll(dir, "base");
  write(dir, path, after);
  commitAll(dir, "change");
  return run(dir, base);
}

test("a // line comment is caught in JavaScript source", () => {
  for (const ext of [".js", ".mjs", ".cjs", ".jsx", ".ts"]) {
    const result = withRepo((dir) => addFile(dir, `file${ext}`, "// Explains the binding.\nexport const value = 1;\n"));
    assert.equal(result.status, 1, `${ext}\n${result.stdout}${result.stderr}`);
    assert.match(result.stdout, new RegExp(`file\\${ext}:1`));
    assert.match(result.stdout, /Explains the binding/);
    assert.ok(result.stdout.includes(FIX));
  }
});

test("a block comment is caught", () => {
  const result = withRepo((dir) => addFile(dir, "file.js", "/* Explains the block. */\nexport const value = 1;\n"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /file\.js:1/);
  assert.match(result.stdout, /Explains the block/);
});

test("a doc comment is caught", () => {
  const result = withRepo((dir) => addFile(dir, "file.ts", "/** Explains the function. */\nexport function read() {\n  return 1;\n}\n"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /Explains the function/);
});

test("a jsx comment is caught", () => {
  const result = withRepo((dir) =>
    addFile(dir, "file.tsx", "export function Field() {\n  return <div>{/* explains the label */}</div>;\n}\n"),
  );
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /file\.tsx:2/);
  assert.match(result.stdout, /explains the label/);
});

test("an html comment is caught", () => {
  const result = withRepo((dir) => addFile(dir, "file.html", "<!-- explains the layout -->\n<div></div>\n"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /file\.html:1/);
  assert.match(result.stdout, /explains the layout/);
});

test("a yaml hash comment is caught", () => {
  for (const ext of [".yml", ".yaml"]) {
    const result = withRepo((dir) => addFile(dir, `file${ext}`, "name: ci\n# explains the job\njobs: {}\n"));
    assert.equal(result.status, 1, `${ext}\n${result.stdout}`);
    assert.match(result.stdout, new RegExp(`file\\${ext}:2`));
    assert.match(result.stdout, /explains the job/);
  }
});

test("a shell hash comment is caught and a shebang is not", () => {
  const result = withRepo((dir) => addFile(dir, "run.sh", "#!/usr/bin/env bash\n# explains the deploy\necho ready\n"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /run\.sh:2/);
  assert.match(result.stdout, /explains the deploy/);
  assert.equal(result.stdout.includes("#!/usr/bin/env bash"), false);
});

test("a shell file that is only a shebang passes", () => {
  const result = withRepo((dir) => addFile(dir, "run.sh", "#!/usr/bin/env bash\necho ready\n"));
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout, "");
});

test("strings, template strings, and urls are not flagged", () => {
  const source = [
    'const url = "https://example.com/a";',
    "const url2 = 'https://example.com/b';",
    "const url3 = `https://example.com/${id}`;",
    "const block = `",
    "// inside template",
    "`;",
    'const note = "not a // comment";',
    "const note2 = 'not a // comment';",
    "const value = `${id}`;",
    "export const total = url.length;",
    "",
  ].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 0, result.stdout);
});

test("a comment inside a template interpolation is caught", () => {
  const result = withRepo((dir) => addFile(dir, "file.js", "const value = `${/* explains the slot */ 1}`;\n"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /explains the slot/);
});

test("regex literals and division are not flagged", () => {
  const source = [
    "const re = /https?:\\/\\//;",
    "const slashes = /\\/\\//;",
    "const n = total / count;",
    "export const pattern = re;",
    "",
  ].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("an unquoted css url is not flagged and a css line comment is", () => {
  const url = withRepo((dir) => addFile(dir, "file.css", ".a { background: url(https://example.com/a.png); }\n"));
  assert.equal(url.status, 0, url.stdout);
  const note = withRepo((dir) => addFile(dir, "file.css", ".a { color: red; }\n// explains the color\n"));
  assert.equal(note.status, 1, note.stdout);
  assert.match(note.stdout, /explains the color/);
});

test("hash marks inside shell and yaml strings are not comments", () => {
  const shell = withRepo((dir) =>
    addFile(dir, "run.sh", "#!/usr/bin/env bash\necho \"not a # comment\"\necho 'not a # comment'\necho $#\necho ${#count}\n"),
  );
  assert.equal(shell.status, 0, shell.stdout);
  const yaml = withRepo((dir) => addFile(dir, "file.yaml", "url: \"https://example.com/#section\"\nname: ci\n"));
  assert.equal(yaml.status, 0, yaml.stdout);
});

test("tooling directives are allowed and @ts-ignore is not", () => {
  const allowed = [
    "// eslint-disable-next-line no-console",
    "/* eslint-disable no-console */",
    "// eslint-enable no-console",
    "export const kept = 1; // eslint-disable-line no-console",
    "// @ts-expect-error narrowed",
    "// prettier-ignore",
    "/* istanbul ignore next */",
    "/* c8 ignore next */",
    "/* stylelint-disable length-zero-no-unit */",
    "//# sourceMappingURL=app.js",
    "export const value = 1;",
    "",
  ].join("\n");
  const pass = withRepo((dir) => addFile(dir, "file.ts", allowed));
  assert.equal(pass.status, 0, pass.stdout);
  const fail = withRepo((dir) => addFile(dir, "file.ts", "// @ts-ignore silenced\nexport const value = 1;\n"));
  assert.equal(fail.status, 1, fail.stdout);
  assert.match(fail.stdout, /@ts-ignore silenced/);
  assert.ok(fail.stdout.includes(FIX));
});

test("a license or copyright header is allowed", () => {
  const source = [
    "/*",
    " * Copyright 2026 CJ Huang",
    " * SPDX-License-Identifier: MIT",
    " */",
    "export const value = 1;",
    "// See the License for terms.",
    "",
  ].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 0, result.stdout);
});

test("external: comments pass and are printed for review", () => {
  const source = [
    "/* external: WebKit drops the prefix */",
    "// external: Figma API returns a stale id",
    "export const value = 1;",
    "",
  ].join("\n");
  const summary = join(tmpdir(), `summary-${Date.now()}.md`);
  const result = withRepo((dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    const base = commitAll(dir, "base");
    write(dir, "file.js", source);
    commitAll(dir, "add");
    return run(dir, base, { GITHUB_STEP_SUMMARY: summary });
  });
  try {
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, new RegExp(EXTERNAL));
    assert.match(result.stdout, /file\.js:1/);
    assert.match(result.stdout, /external: WebKit drops the prefix/);
    assert.match(result.stdout, /file\.js:2/);
    assert.match(result.stdout, /external: Figma API returns a stale id/);
    assert.equal(result.stdout.includes(FIX), false);
    const written = readFileSync(summary, "utf8");
    assert.match(written, new RegExp(EXTERNAL));
    assert.match(written, /external: WebKit drops the prefix/);
  } finally {
    rmSync(summary, { force: true });
  }
});

test("the external marker has to be exact", () => {
  const source = ["// externally: not the marker", "// external : spaced", "export const value = 1;", ""].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /externally: not the marker/);
  assert.match(result.stdout, /external : spaced/);
});

test("a violation still lists external comments", () => {
  const source = ["// external: Figma API returns a stale id", "// explains the binding", "export const value = 1;", ""].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /explains the binding/);
  assert.ok(result.stdout.includes(FIX));
  assert.match(result.stdout, new RegExp(EXTERNAL));
  assert.match(result.stdout, /external: Figma API returns a stale id/);
});

test("a block comment opened on an added line includes its continuation", () => {
  const source = ["export const value = 1;", "/*", "still a comment without a marker", "*/", ""].join("\n");
  const result = withRepo((dir) => addFile(dir, "file.js", source));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /file\.js:2/);
  assert.match(result.stdout, /still a comment without a marker/);
});

test("pre-existing comments are ignored", () => {
  const result = withRepo((dir) =>
    changeFile(dir, "file.js", "// already explained\nexport const value = 1;\n", "// already explained\nexport const value = 2;\n"),
  );
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout.includes("already explained"), false);
});

test("an unchanged trailing comment on an edited line is not new", () => {
  const result = withRepo((dir) =>
    changeFile(
      dir,
      "file.js",
      "export const value = 1; // stays put\n",
      "export const value = 2; // stays put\nexport const other = 3; // freshly added\n",
    ),
  );
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /freshly added/);
  assert.equal(result.stdout.includes("stays put"), false);
});

test("a line added inside an existing block comment is not a new comment", () => {
  const result = withRepo((dir) =>
    changeFile(
      dir,
      "file.js",
      "/*\nexisting note\n*/\nexport const value = 1;\n",
      "/*\nexisting note\nadded inside the old note\n*/\nexport const value = 1;\n",
    ),
  );
  assert.equal(result.status, 0, result.stdout);
});

test("a code-only change passes", () => {
  const result = withRepo((dir) => changeFile(dir, "file.js", "export const value = 1;\n", "export const value = 2;\n"));
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout, "");
});

test("a PLACEHOLDER comment is allowed only when a guardrail script reads it", () => {
  const result = withRepo((dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    const base = commitAll(dir, "base");
    write(dir, "src/a.css", "/* PLACEHOLDER - from the fixture */\n.a { color: red; }\n");
    commitAll(dir, "marker");
    const blocked = run(dir, base);
    write(dir, "tests/guardrails/read-marker.mjs", 'const marker = "PLACEHOLDER - from the fixture";\nexport const has = (source) => source.includes(marker);\n');
    commitAll(dir, "reader");
    const allowed = run(dir, base);
    write(dir, "src/b.css", "/* PLACEHOLDER - not read */\n.b { color: blue; }\n");
    commitAll(dir, "other");
    const still = run(dir, base);
    return { blocked, allowed, still };
  });
  assert.equal(result.blocked.status, 1, result.blocked.stdout);
  assert.match(result.blocked.stdout, /PLACEHOLDER - from the fixture/);
  assert.equal(result.allowed.status, 0, result.allowed.stdout);
  assert.equal(result.still.status, 1, result.still.stdout);
  assert.match(result.still.stdout, /PLACEHOLDER - not read/);
  assert.equal(result.still.stdout.includes("PLACEHOLDER - from the fixture"), false);
});

test("generated css, dist, json, and lockfiles are skipped", () => {
  const result = withRepo((dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    const base = commitAll(dir, "base");
    write(dir, "src/styles/tokens.css", "/* explains a generated token */\n");
    write(dir, "src/extra.css", "/**\n * Do not edit directly, this file was auto-generated.\n */\n/* explains too */\n");
    write(dir, "dist/app.js", "// explains the bundle\n");
    write(dir, "figma-plugin/dist/code.js", "// explains the plugin bundle\n");
    write(dir, "data.json", "{ \"note\": \"// explains\" }\n");
    write(dir, "pnpm-lock.yaml", "# explains the lock\n");
    commitAll(dir, "generated");
    return run(dir, base);
  });
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout, "");
});

test("the step summary stays empty when there is no external comment", () => {
  const summary = join(tmpdir(), `summary-empty-${Date.now()}.md`);
  writeFileSync(summary, "");
  const result = withRepo((dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    const base = commitAll(dir, "base");
    write(dir, "file.js", "// explains the binding\n");
    commitAll(dir, "add");
    return run(dir, base, { GITHUB_STEP_SUMMARY: summary });
  });
  try {
    assert.equal(result.status, 1, result.stdout);
    assert.equal(readFileSync(summary, "utf8"), "");
  } finally {
    rmSync(summary, { force: true });
  }
});
