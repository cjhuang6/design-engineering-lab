import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { catalogFromCss, parseTokenCss } from "../../src/parseTokenCss.js";

const TOKEN_CSS = "src/styles/tokens.css";
const DEMO_ROOT = "src";

const FORBIDDEN = [
  ["hex color", /#[0-9a-fA-F]{3,8}\b/],
  ["rgb color", /\brgba?\(/],
  ["hsl color", /\bhsla?\(/],
  ["px length", /\d+px\b/],
  ["rem length", /\d+rem\b/],
  ["em length", /\d+em\b/],
];

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(css|jsx|js)$/.test(entry.name) && path !== TOKEN_CSS) files.push(path);
  }
  return files;
}

function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/^\s*\/\/.*$/gm, "");
}

test("demo source uses only custom properties defined in tokens.css", async () => {
  const css = await readFile(TOKEN_CSS, "utf8");
  const defined = new Set(parseTokenCss(css).light.map((token) => token.name));
  assert.ok(defined.size > 0);
  const files = await sourceFiles(DEMO_ROOT);
  assert.equal(files.some((path) => path.includes("ProfileCard")), false);
  assert.equal(existsSync("src/components/ProfileCard"), false);
  const missing = [];
  for (const path of files) {
    const source = stripComments(await readFile(path, "utf8"));
    for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!defined.has(match[1])) missing.push(`${path} uses ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("demo source does not hardcode colors or absolute lengths", async () => {
  const files = await sourceFiles(DEMO_ROOT);
  const problems = [];
  for (const path of files) {
    const source = stripComments(await readFile(path, "utf8"));
    for (const [name, pattern] of FORBIDDEN) {
      if (pattern.test(source)) problems.push(`${path} contains a ${name}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the token catalog is derived from the generated CSS", async () => {
  const css = await readFile(TOKEN_CSS, "utf8");
  const { light, dark } = parseTokenCss(css);
  const sections = catalogFromCss(css);
  const names = sections.flatMap((section) =>
    section.subgroups.flatMap((group) => group.tokens.map((token) => token.name)),
  );
  assert.equal(names.length, light.length);
  assert.deepEqual([...names].sort(), light.map((token) => token.name).sort());
  assert.ok(names.includes("--color-action-primary"));
  assert.ok(names.includes("--space-4"));
  assert.ok(names.includes("--radius-lg"));
  assert.ok(names.includes("--body-md"));
  const canvas = sections
    .flatMap((section) => section.subgroups.flatMap((group) => group.tokens))
    .find((token) => token.name === "--color-background-canvas");
  assert.equal(canvas.darkValue, "var(--color-base-black)");
  const space = sections
    .flatMap((section) => section.subgroups.flatMap((group) => group.tokens))
    .find((token) => token.name === "--space-4");
  assert.equal(space.darkValue, null);
  for (const token of dark) assert.ok(names.includes(token.name));
  assert.ok(sections.some((section) => section.id === "color"));
  assert.ok(sections.some((section) => section.id === "spacing"));
  assert.ok(sections.some((section) => section.id === "radius"));
  assert.ok(sections.some((section) => section.id === "typography"));
});
