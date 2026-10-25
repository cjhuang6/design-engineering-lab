import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { catalogFromCss, parseTokenCss } from "../../src/parseTokenCss.js";

const TOKEN_CSS = "src/styles/tokens.css";
const DEMO_ROOT = "src";
const PICKER_CSS = "src/components/hex-color-picker/HexColorPicker.css";
const PLACEHOLDER_MARKER = "PLACEHOLDER - candidate token, see color-picker-brief.md";
const PLACEHOLDER_NAMES = [
  "--hex-picker-duration-grow",
  "--hex-picker-duration-idle",
  "--hex-picker-delay-idle",
  "--hex-picker-duration-autostop",
  "--hex-picker-ease-overshoot",
  "--hex-picker-ease-sine",
  "--hex-picker-scale-press",
  "--hex-picker-scale-hover",
  "--hex-picker-darken",
  "--hex-picker-radius",
  "--hex-picker-mark-size",
  "--hex-picker-scale-idle",
  "--hex-picker-white-hairline",
];

function placeholderBody(source) {
  const markerAt = source.indexOf(PLACEHOLDER_MARKER);
  if (markerAt < 0) return null;
  const open = source.lastIndexOf("{", markerAt);
  const close = source.indexOf("}", markerAt);
  if (open < 0 || close < 0 || open > markerAt) return null;
  return source.slice(open + 1, close);
}

function withoutPlaceholderBody(source) {
  const body = placeholderBody(source);
  if (body == null) return source;
  const markerAt = source.indexOf(PLACEHOLDER_MARKER);
  const open = source.lastIndexOf("{", markerAt);
  const close = source.indexOf("}", markerAt);
  return `${source.slice(0, open + 1)}${source.slice(close)}`;
}

function placeholderNames(source) {
  const body = placeholderBody(source);
  if (body == null) return [];
  return [...body.matchAll(/(--hex-picker-[\w-]+)\s*:/g)].map((match) => match[1]);
}

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
  const placeholders = new Set(placeholderNames(await readFile(PICKER_CSS, "utf8")));
  const files = await sourceFiles(DEMO_ROOT);
  assert.equal(files.some((path) => path.includes("ProfileCard")), false);
  assert.equal(existsSync("src/components/ProfileCard"), false);
  const missing = [];
  for (const path of files) {
    const source = stripComments(await readFile(path, "utf8"));
    for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (defined.has(match[1]) || placeholders.has(match[1])) continue;
      missing.push(`${path} uses ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("demo source does not hardcode colors or absolute lengths", async () => {
  const files = await sourceFiles(DEMO_ROOT);
  const problems = [];
  for (const path of files) {
    let source = await readFile(path, "utf8");
    if (path === PICKER_CSS) source = withoutPlaceholderBody(source);
    source = stripComments(source);
    for (const [name, pattern] of FORBIDDEN) {
      if (pattern.test(source)) problems.push(`${path} contains a ${name}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("hex picker placeholders are the only custom properties outside the token file", async () => {
  const files = await sourceFiles(DEMO_ROOT);
  const picker = await readFile(PICKER_CSS, "utf8");
  assert.equal(picker.split(PLACEHOLDER_MARKER).length - 1, 1);
  for (const path of files) {
    if (path === PICKER_CSS) continue;
    const source = await readFile(path, "utf8");
    assert.equal(source.includes(PLACEHOLDER_MARKER), false, path);
  }
  const body = placeholderBody(picker);
  assert.ok(body);
  const declarations = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("/*") && !line.startsWith("*"));
  assert.deepEqual(
    declarations.map((line) => line.slice(0, line.indexOf(":"))),
    PLACEHOLDER_NAMES,
  );
  for (const line of declarations) assert.match(line, /^--hex-picker-[\w-]+:\s*[^;]+;$/);
  assert.equal(body.includes("#"), false);
  const tokens = await readFile(TOKEN_CSS, "utf8");
  const component = await readFile("src/components/hex-color-picker/HexColorPicker.jsx", "utf8");
  const outside = withoutPlaceholderBody(picker);
  for (const name of PLACEHOLDER_NAMES) {
    assert.equal(tokens.includes(name), false);
    assert.ok(outside.includes(name) || component.includes(name), `${name} is unused`);
  }
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
