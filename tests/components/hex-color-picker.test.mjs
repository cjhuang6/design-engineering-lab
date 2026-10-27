import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  buildPalette,
  cellAtPoint,
  contrastRatio,
  cssDurationMs,
  formatHex,
  layoutMetrics,
  moveSelection,
  pickMarkColor,
  placeCells,
  proximityFalloff,
  proximityPaint,
  relativeLuminance,
} from "../../src/components/hex-color-picker/model.js";

const COLUMN = { colX: null, colId: null };
const DROPPED = [
  "--color-primitive-ice-50",
  "--color-primitive-blue-50",
  "--color-primitive-green-50",
  "--color-primitive-pink-50",
  "--color-primitive-ice-950",
  "--color-primitive-blue-950",
  "--color-base-black",
];
const WEDGES = {
  ice: { 1: [100, 200], 2: [300, 400, 500], 3: [600, 700, 800, 900] },
  blue: { 1: [100], 2: [200, 300, 400], 3: [500, 600, 700, 800, 900] },
  green: { 1: [100, 200], 2: [300, 400, 500], 3: [600, 700, 800, 900] },
  pink: { 1: [100], 2: [200, 300, 400], 3: [500, 600, 700, 800, 900] },
};

function tokenHex(css, name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `${name} should be a hex in tokens.css`);
  return match[1];
}

function neighborDistance(a, b) {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

const cells = buildPalette();
const metrics = layoutMetrics(40, 3);
const placed = placeCells(cells, 40, 3);
const byToken = new Map(placed.map((cell) => [cell.token, cell]));

test("the honeycomb is 37 Camellia color tokens in the decided wedges", async () => {
  assert.equal(cells.length, 37);
  assert.equal(new Set(cells.map((cell) => cell.token)).size, 37);
  const lengths = [];
  for (const cell of cells) lengths[cell.row] = (lengths[cell.row] ?? 0) + 1;
  assert.deepEqual(lengths, [4, 5, 6, 7, 6, 5, 4]);

  const center = cells.find((cell) => cell.ring === 0);
  assert.equal(center.token, "color.base.white");
  assert.equal(center.label, "White");
  assert.equal(center.cssVar, "--color-base-white");

  for (const [hue, rings] of Object.entries(WEDGES)) {
    for (const [ring, steps] of Object.entries(rings)) {
      const actual = cells
        .filter((cell) => cell.hue === hue && cell.ring === Number(ring))
        .sort((a, b) => a.ang - b.ang)
        .map((cell) => cell.step);
      assert.deepEqual(actual, steps, `${hue} ring ${ring}`);
    }
  }

  assert.equal(cells.find((cell) => cell.token === "color.primitive.blue.300").label, "Blue 300");

  const css = await readFile("src/styles/tokens.css", "utf8");
  for (const cell of cells) {
    assert.match(css, new RegExp(`${cell.cssVar}:`));
    if (cell.hue === "white") continue;
    assert.equal(cell.token, `color.primitive.${cell.hue}.${cell.step}`);
    assert.equal(cell.cssVar, `--color-primitive-${cell.hue}-${cell.step}`);
  }
  for (const name of DROPPED) {
    assert.equal(cells.some((cell) => cell.cssVar === name), false);
    assert.match(css, new RegExp(`${name}:`));
  }
});

test("cells sit on a pointy-top hex grid and clicks hit the nearest center", () => {
  const center = byToken.get("color.base.white");
  assert.ok(Math.abs(center.cx - metrics.gridWidth / 2) < 0.001);
  assert.ok(Math.abs(center.cy - metrics.gridHeight / 2) < 0.001);

  const neighbors = placed.filter(
    (cell) => cell !== center && Math.abs(neighborDistance(cell, center) - metrics.pitchX) < 1,
  );
  assert.equal(neighbors.length, 6);
  assert.ok(neighbors.every((cell) => cell.ring === 1));

  assert.equal(cellAtPoint(placed, center.cx, center.cy, metrics.height).token, center.token);
  assert.equal(cellAtPoint(placed, -100, -100, metrics.height), null);

  for (const cell of placed) {
    const around = placed.filter(
      (other) => other !== cell && Math.abs(neighborDistance(cell, other) - metrics.pitchX) < 1,
    );
    assert.ok(around.length >= 3 && around.length <= 6, cell.token);
  }
});

test("arrow keys move to a hex neighbor and up or down keeps the column", () => {
  const pitchX = metrics.pitchX;
  const middle = placed.filter((cell) => cell.row === 3).sort((a, b) => a.indexInRow - b.indexInRow);
  const right = moveSelection(placed, middle[2].token, "ArrowRight", COLUMN, pitchX);
  assert.equal(right.token, middle[3].token);
  const left = moveSelection(placed, middle[2].token, "ArrowLeft", COLUMN, pitchX);
  assert.equal(left.token, middle[1].token);
  assert.equal(moveSelection(placed, middle[0].token, "ArrowLeft", COLUMN, pitchX).token, middle[0].token);
  assert.equal(moveSelection(placed, middle[2].token, "Home", COLUMN, pitchX).token, middle[0].token);
  assert.equal(moveSelection(placed, middle[2].token, "End", COLUMN, pitchX).token, middle[middle.length - 1].token);
  assert.equal(moveSelection(placed, middle[2].token, "Enter", COLUMN, pitchX).token, middle[2].token);

  for (const cell of placed) {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      const step = moveSelection(placed, cell.token, key, COLUMN, pitchX);
      const next = byToken.get(step.token);
      if (next.token === cell.token) continue;
      assert.ok(Math.abs(neighborDistance(cell, next) - pitchX) < 1, `${cell.token} ${key}`);
      if (key === "ArrowLeft" || key === "ArrowRight") assert.equal(next.row, cell.row);
      else assert.equal(Math.abs(next.row - cell.row), 1);
    }

    let token = cell.token;
    let memory = COLUMN;
    let walked = 0;
    for (let i = 0; i < 8; i += 1) {
      const down = moveSelection(placed, token, "ArrowDown", memory, pitchX);
      if (down.token === token) break;
      token = down.token;
      memory = down.memory;
      walked += 1;
    }
    for (let i = 0; i < walked; i += 1) {
      const up = moveSelection(placed, token, "ArrowUp", memory, pitchX);
      token = up.token;
      memory = up.memory;
    }
    assert.equal(token, cell.token, `${cell.token} should return up the same column`);
  }

  const bottom = placed.filter((cell) => cell.row === 6);
  for (const cell of bottom) {
    assert.equal(moveSelection(placed, cell.token, "ArrowDown", COLUMN, pitchX).token, cell.token);
  }
});

test("computed CSS times become milliseconds, including the browser's second shorthand", () => {
  assert.equal(cssDurationMs(".2s"), 200);
  assert.equal(cssDurationMs(".6s"), 600);
  assert.equal(cssDurationMs("2.4s"), 2400);
  assert.equal(cssDurationMs("11s"), 11000);
  assert.equal(cssDurationMs("200ms"), 200);
  assert.equal(cssDurationMs("11000ms"), 11000);
  assert.equal(cssDurationMs("  0.6s "), 600);
  assert.equal(cssDurationMs(""), 0);
  assert.equal(Math.round(11000 / 2400), 5);
});

test("proximity falloff is a smoothstep that is full at the pointer and gone at the radius", () => {
  assert.equal(proximityFalloff(0, 80), 1);
  assert.equal(proximityFalloff(-4, 80), 1);
  assert.equal(proximityFalloff(40, 80), 0.5);
  assert.equal(proximityFalloff(60, 80), 0.15625);
  assert.equal(proximityFalloff(80, 80), 0);
  assert.equal(proximityFalloff(81, 80), 0);
  assert.equal(proximityFalloff(10, 0), 0);

  let previous = Infinity;
  for (const distance of [0, 10, 20, 40, 60, 79, 80, 120]) {
    const effect = proximityFalloff(distance, 80);
    assert.ok(effect <= previous);
    assert.ok(effect >= 0 && effect <= 1);
    previous = effect;
  }
});

test("placeholder values are the component defaults and are not tokens", async () => {
  const css = await readFile("src/components/hex-color-picker/HexColorPicker.css", "utf8");
  const expected = {
    "--hex-picker-duration-grow": "200ms",
    "--hex-picker-duration-idle": "2400ms",
    "--hex-picker-delay-idle": "600ms",
    "--hex-picker-duration-autostop": "11000ms",
    "--hex-picker-ease-overshoot": "cubic-bezier(0.34, 1.56, 0.64, 1)",
    "--hex-picker-ease-sine": "cubic-bezier(0.37, 0, 0.63, 1)",
    "--hex-picker-scale-press": "0.94",
    "--hex-picker-scale-hover": "1.15",
    "--hex-picker-darken": "0",
    "--hex-picker-radius": "80px",
    "--hex-picker-mark-size": "35%",
    "--hex-picker-scale-idle": "1.12",
    "--hex-picker-white-hairline": "1px",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.match(css, new RegExp(`${name}:\\s*${value.replace(/[().]/g, "\\$&")};`));
  }
  const tokens = await readFile("src/styles/tokens.css", "utf8");
  assert.equal(tokens.includes("--hex-picker-"), false);
});

test("darken 0 paints growth without a brightness filter", () => {
  assert.deepEqual(proximityPaint(1, 1.15, 0), { transform: "scale(1.1500)", filter: "" });
  assert.deepEqual(proximityPaint(0, 1.15, 0.3), { transform: "", filter: "" });
  assert.equal(proximityPaint(1, 1.15, 0.12).filter, "brightness(0.8800)");
  assert.equal(proximityPaint(0.5, 1.4, 0.3).transform, "scale(1.2000)");
  assert.equal(proximityPaint(0.5, 1.4, 0.3).filter, "brightness(0.8500)");
});

test("the cell focus ring paints only for :focus-visible", async () => {
  const css = await readFile("src/components/hex-color-picker/HexColorPicker.css", "utf8");
  assert.match(css, /\.hex-picker-cell:focus-visible \.hex-picker-focus \{\s*opacity:\s*1;\s*\}/);
  assert.equal(/\.hex-picker-cell:focus\s+\.hex-picker-focus/.test(css), false);
  assert.match(css, /\.hex-picker-cell\[aria-checked='true'\] \.hex-picker-mark \{\s*scale:\s*1;/);
});

test("the card width follows the grid and the readout keeps its full text", async () => {
  const css = await readFile("src/components/hex-color-picker/HexColorPicker.css", "utf8");
  const source = await readFile("src/components/hex-color-picker/HexColorPicker.jsx", "utf8");
  const shell = await readFile("src/showcase/blocks.jsx", "utf8");
  assert.match(css, /\.hex-picker-label,\s*\.hex-picker-readout\s*\{[^}]*width:\s*0;[^}]*min-width:\s*100%;/);
  assert.match(css, /text-overflow:\s*ellipsis;/);
  assert.match(css, /white-space:\s*nowrap;/);
  assert.match(source, /title=\{selectedCell \? selectedCell\.label : 'No color selected'\}/);
  assert.match(source, /title=\{selectedCell\.token\}/);
  assert.match(source, /hexRef\.current\.title = nextHex/);
  assert.match(source, /const RADIUS_DEFAULT = 80/);
  assert.match(source, /const SCALE_DEFAULT = 1\.15/);
  assert.match(source, /const DARKEN_DEFAULT = 0/);
  assert.match(source, /min=\{40\}/);
  assert.match(source, /max=\{160\}/);
  assert.match(source, /max=\{1\.4\}/);
  assert.match(source, /max=\{0\.3\}/);
  assert.match(source, /step=\{0\.01\}/);
  assert.match(shell, /radius=\{radius\}/);
  assert.match(shell, /scaleHover=\{scaleHover\}/);
  assert.match(shell, /darken=\{darken\}/);
  assert.match(shell, /setRadius\(RADIUS_DEFAULT\)/);
  assert.match(shell, /setScaleHover\(SCALE_DEFAULT\)/);
  assert.match(shell, /setDarken\(DARKEN_DEFAULT\)/);
  assert.match(
    source,
    /A honeycomb of Camellia's solid color tokens\. Cells near the pointer grow as it passes, and the selected color breathes gently until you move on\. Use the controls to tune how far the effect reaches, how much cells grow, and whether they darken\./,
  );
  assert.equal(source.includes("grow and darken"), false);
});

test("the inner mark picks whichever of white or ice 900 has more contrast", async () => {
  const css = await readFile("src/styles/tokens.css", "utf8");
  const white = tokenHex(css, "--color-base-white");
  const dark = tokenHex(css, "--color-primitive-ice-900");
  assert.equal(pickMarkColor(white, white, dark), "dark");
  assert.equal(pickMarkColor(dark, white, dark), "white");
  assert.equal(pickMarkColor(tokenHex(css, "--color-primitive-ice-100"), white, dark), "dark");
  assert.equal(pickMarkColor(tokenHex(css, "--color-primitive-blue-900"), white, dark), "white");
  assert.equal(pickMarkColor(tokenHex(css, "--color-primitive-green-100"), white, dark), "dark");
  assert.equal(pickMarkColor(tokenHex(css, "--color-primitive-pink-900"), white, dark), "white");
  assert.equal(pickMarkColor("#808080", "#ffffff", "#ffffff"), "white");
  assert.equal(pickMarkColor("not a color", white, dark), "dark");

  const blue600 = tokenHex(css, "--color-primitive-blue-600");
  assert.equal(formatHex(blue600), blue600.toUpperCase());
  assert.equal(formatHex("#fff"), "#FFFFFF");
  assert.equal(formatHex("rgb(63, 110, 235)"), formatHex(blue600));
  assert.equal(formatHex("rgb(63 110 235)"), formatHex(blue600));
  assert.equal(pickMarkColor(blue600, "#fff", dark), "white");
  assert.equal(contrastRatio(relativeLuminance(white), relativeLuminance(white)), 1);

  for (const cell of cells) {
    const hex = tokenHex(css, cell.cssVar);
    const choice = pickMarkColor(hex, white, dark);
    const onWhite = contrastRatio(relativeLuminance(hex), relativeLuminance(white));
    const onDark = contrastRatio(relativeLuminance(hex), relativeLuminance(dark));
    assert.equal(choice, onWhite >= onDark ? "white" : "dark", cell.token);
    assert.equal(pickMarkColor(formatHex(hex).toLowerCase(), white, dark), choice);
  }
});
