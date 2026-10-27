import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { buildPalette, cellAtPoint, layoutMetrics, moveSelection, placeCells } from "../../src/components/hex-color-picker/model.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const COLUMN = { colX: null, colId: null };
const TARGET = "color.primitive.blue.800";
const NEIGHBOR = "color.primitive.blue.300";

let HexColorPicker;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-picker-hit-"));
  const outfile = join(dir, "HexColorPicker.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/hex-color-picker/HexColorPicker.jsx"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    outfile,
    plugins: [
      {
        name: "shim-imports",
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, () => ({ path: "empty.css", namespace: "css-empty" }));
          build.onLoad({ filter: /.*/, namespace: "css-empty" }, () => ({
            contents: "export {}",
            loader: "js",
          }));
          build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
            path: import.meta.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });
  ({ HexColorPicker } = await import(pathToFileURL(outfile).href));
});

function selectedToken() {
  return document.querySelector('.hex-picker-cell[aria-checked="true"]')?.getAttribute("data-token") ?? null;
}

function cellBox(token) {
  const node = document.querySelector(`[data-token="${token}"]`);
  const width = Number.parseFloat(node.style.width);
  const height = Number.parseFloat(node.style.height);
  const x = Number.parseFloat(node.style.left);
  const y = Number.parseFloat(node.style.top);
  return { node, width, height, cx: x + width / 2, cy: y + height / 2 };
}

function present(scale) {
  const grid = document.querySelector(".hex-picker-grid");
  const layoutW = Number.parseFloat(grid.style.width);
  const layoutH = Number.parseFloat(grid.style.height);
  const width = layoutW * scale;
  const height = layoutH * scale;
  const left = 297.5 - width / 2;
  const top = 152 - height / 2;
  const rect = {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
  grid.getBoundingClientRect = () => rect;
  return { grid, rect, scale, layoutW, layoutH };
}

function visual(cell, view) {
  return {
    x: view.rect.left + cell.cx * view.scale,
    y: view.rect.top + cell.cy * view.scale,
  };
}

async function point(type, x, y, init = {}) {
  const root = document.querySelector(".hex-color-picker");
  await act(async () => {
    root.dispatchEvent(
      new window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        detail: type === "click" ? 1 : 0,
        pointerType: "mouse",
        pointerId: 1,
        ...init,
      }),
    );
    if (type === "pointermove") await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(HexColorPicker, { label: "Camellia color" }));
  });
  return {
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

test("a click on a cell center selects that cell at rest, expanded on desktop, and expanded at 390px", async () => {
  const view = await mount();
  try {
    const grid = document.querySelector(".hex-picker-grid");
    const target = cellBox(TARGET);
    const neighbor = cellBox(NEIGHBOR);
    const gap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-1"));
    const placed = placeCells(buildPalette(), target.width, gap);
    assert.equal(grid.getAttribute("role"), "radiogroup");
    assert.equal(target.node.getAttribute("role"), "radio");
    assert.equal(target.node.getAttribute("aria-label"), "Blue 800");
    assert.equal(neighbor.node.getAttribute("aria-label"), "Blue 300");
    assert.equal(target.width, 40);
    assert.equal(selectedToken(), null);

    const resting = present(1);
    await point("pointermove", visual(target, resting).x, visual(target, resting).y);
    assert.equal(target.node.style.transform, "scale(1.1500)");
    await point("click", visual(neighbor, resting).x, visual(neighbor, resting).y);
    assert.equal(selectedToken(), NEIGHBOR);
    assert.notEqual(document.activeElement, neighbor.node);
    assert.equal(neighbor.node.tabIndex, 0);
    assert.equal(target.node.tabIndex, -1);

    const cases = [
      { name: "desktop 1280", scale: 1.27578, hit: target, hover: neighbor },
      { name: "phone 390", scale: 0.766498, hit: neighbor, hover: target },
    ];
    for (const { name, scale, hit, hover } of cases) {
      const scaled = present(scale);
      const aimed = visual(hit, scaled);
      const ignored = cellAtPoint(placed, hit.cx * scale, hit.cy * scale, hit.height);
      assert.notEqual(ignored?.token, hit.node.getAttribute("data-token"));
      await point("pointermove", visual(hover, scaled).x, visual(hover, scaled).y);
      await point("click", aimed.x, aimed.y);
      assert.equal(selectedToken(), hit.node.getAttribute("data-token"), name);
      assert.notEqual(document.activeElement, hit.node);
      assert.equal(hit.node.tabIndex, 0);
      assert.equal(hit.node.getAttribute("aria-checked"), "true");
      assert.equal(hover.node.style.transform, "scale(1.1500)", name);
      assert.equal(hover.node.getAttribute("role"), "radio");
    }

    const step = moveSelection(placed, NEIGHBOR, "ArrowRight", COLUMN, layoutMetrics(target.width, gap).pitchX);
    neighbor.node.focus();
    await act(async () => {
      neighbor.node.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    assert.equal(selectedToken(), step.token);
    assert.notEqual(step.token, NEIGHBOR);
    assert.equal(document.activeElement?.getAttribute("data-token"), step.token);
    assert.equal(document.activeElement.tabIndex, 0);
  } finally {
    await view.unmount();
  }
});

test("pointer and touch selection do not focus a cell; the keyboard does", async () => {
  const view = await mount();
  try {
    const grid = document.querySelector(".hex-picker-grid");
    const target = cellBox(TARGET);
    const neighbor = cellBox(NEIGHBOR);
    const resting = present(1);
    const aimed = visual(neighbor, resting);

    await point("pointerdown", aimed.x, aimed.y, { pointerType: "touch" });
    await point("click", aimed.x, aimed.y, { pointerType: "touch" });
    assert.equal(selectedToken(), NEIGHBOR);
    assert.equal(neighbor.node.getAttribute("aria-checked"), "true");
    assert.equal(neighbor.node.querySelector(".hex-picker-mark") instanceof window.Element, true);
    assert.equal(neighbor.node.querySelector(".hex-picker-focus") instanceof window.Element, true);
    assert.equal(grid.contains(document.activeElement), false);
    assert.equal(neighbor.node.tabIndex, 0);
    assert.equal(
      [...grid.querySelectorAll(".hex-picker-cell")].filter((cell) => cell.tabIndex === 0).length,
      1,
    );

    neighbor.node.focus();
    await act(async () => {
      neighbor.node.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    assert.equal(document.activeElement, neighbor.node);
    await act(async () => {
      neighbor.node.dispatchEvent(new window.KeyboardEvent("keyup", { key: " ", bubbles: true }));
    });
    assert.equal(selectedToken(), NEIGHBOR);
    assert.equal(document.activeElement, neighbor.node);

    await point("click", visual(target, resting).x, visual(target, resting).y);
    assert.equal(selectedToken(), TARGET);
    assert.equal(grid.contains(document.activeElement), false);
    assert.equal(target.node.tabIndex, 0);
    assert.equal(neighbor.node.tabIndex, -1);

    target.node.focus();
    const gap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-1"));
    const step = moveSelection(
      placeCells(buildPalette(), target.width, gap),
      TARGET,
      "ArrowRight",
      COLUMN,
      layoutMetrics(target.width, gap).pitchX,
    );
    await act(async () => {
      target.node.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    assert.equal(document.activeElement.getAttribute("data-token"), step.token);
    assert.equal(selectedToken(), step.token);
    assert.equal(document.activeElement.tabIndex, 0);

    const focused = document.activeElement;
    await act(async () => {
      focused.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      focused.dispatchEvent(new window.KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    });
    assert.equal(document.activeElement, focused);
    assert.equal(selectedToken(), step.token);
  } finally {
    await view.unmount();
  }
});
