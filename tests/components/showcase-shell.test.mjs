import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import * as esbuild from "esbuild";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { SHOWCASE_BLOCKS } from "../../src/showcase/catalog.js";
import {
  closeMotion,
  columnCount,
  expandedFrame,
  masonrySpan,
  motionFromStyle,
  openPanelDelay,
  overlapWindow,
  uniformScale,
} from "../../src/showcase/layout.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WIDE = {
  space4: 16,
  space6: 24,
  space8: 32,
  space24: 96,
  contentSm: 640,
  contentMd: 960,
};

let Showcase;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "showcase-shell-"));
  const outfile = join(dir, "Showcase.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/showcase/Showcase.jsx"],
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
  ({ Showcase } = await import(pathToFileURL(outfile).href));
});

function sampleBlock() {
  return {
    id: "sample",
    name: "Sample block",
    description: "Details for the sample.",
    content: createElement("p", { className: "sample-content" }, "Sample"),
    controls: createElement("p", null, "Sample controls"),
  };
}

async function mount(blocks = [sampleBlock()]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Showcase, { blocks }));
  });
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
      document.documentElement.style.overflow = "";
    },
  };
}

function trigger() {
  return document.querySelector('[data-showcase-trigger="sample"]');
}

async function openDetails() {
  const button = trigger();
  await act(async () => {
    button.click();
  });
  return button;
}

test("columns and masonry spans follow the available width", () => {
  assert.equal(columnCount(1100, 24, 280), 3);
  assert.equal(columnCount(700, 24, 280), 2);
  assert.equal(columnCount(400, 24, 280), 1);
  assert.equal(columnCount(0, 24, 280), 1);
  assert.equal(columnCount(2000, 24, 100, 3), 3);
  assert.equal(masonrySpan(460, 24, 1), 484);
  assert.equal(masonrySpan(10, 24, 8), 4);
  assert.equal(masonrySpan(0, 0, 0), 1);
});

test("every component opens to the same viewport frame", () => {
  const wide = expandedFrame({ width: 1280, height: 800 }, WIDE);
  assert.deepEqual(wide, expandedFrame({ width: 1280, height: 800 }, WIDE));
  assert.equal(wide.axis, "x");
  assert.deepEqual(wide.card, { x: 261, y: 128, w: 461, h: 544 });
  assert.equal(wide.panel.x - (wide.card.x + wide.card.w), WIDE.space4);
  assert.equal(wide.panel.y, wide.card.y);
  assert.equal(wide.panel.h, wide.card.h);

  const narrow = expandedFrame({ width: 400, height: 700 }, WIDE);
  assert.equal(narrow.axis, "y");
  assert.equal(narrow.panel.y - (narrow.card.y + narrow.card.h), WIDE.space4);
  assert.equal(narrow.panel.x, narrow.card.x);
  assert.equal(narrow.card.w, 368);
  assert.ok(narrow.card.h < wide.card.h);
});

test("the component scales by one factor and is not stretched", () => {
  assert.equal(uniformScale({ w: 200, h: 100 }, { w: 100, h: 100 }), 0.5);
  assert.equal(uniformScale({ w: 100, h: 200 }, { w: 100, h: 100 }), 0.5);
  assert.equal(uniformScale({ w: 0, h: 10 }, { w: 10, h: 10 }), 1);
});

test("a card that would cross the panel waits, and close runs at 0.8×", () => {
  const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
  const clear = overlapWindow(
    { x: 40, y: 40, w: 200, h: 200 },
    { x: 80, y: 80, w: 300, h: 300 },
    { x: 520, y: 80, w: 280, h: 300 },
    250,
    easing,
  );
  assert.equal(clear, null);
  assert.equal(openPanelDelay(100, clear), 100);

  const crossing = overlapWindow(
    { x: 900, y: 80, w: 200, h: 220 },
    { x: 80, y: 80, w: 420, h: 480 },
    { x: 516, y: 80, w: 300, h: 480 },
    250,
    easing,
  );
  assert.ok(crossing);
  assert.ok(openPanelDelay(100, crossing) > 100);

  assert.deepEqual(closeMotion(100, 150, 250, 0.8, null), {
    panelDuration: 120,
    panelDelay: 0,
    cardDuration: 200,
    cardDelay: 72,
    scrimDuration: 200,
    scrimDelay: 72,
  });
  const delayed = closeMotion(100, 150, 250, 0.8, { first: 10, last: 40 });
  assert.equal(delayed.panelDelay, 0);
  assert.ok(delayed.cardDelay > 72);
  assert.equal(delayed.cardDelay, delayed.scrimDelay);
});

test("shell motion reads tokens, and the card surface is not a placeholder", async () => {
  const css = await readFile(join(ROOT, "src/showcase/showcase.css"), "utf8");
  const source = await readFile(join(ROOT, "src/showcase/Showcase.jsx"), "utf8");
  const motion = motionFromStyle({
    getPropertyValue(name) {
      const values = {
        "--showcase-panel-scale-from": "0.97",
        "--showcase-close-rate": "0.8",
        "--showcase-card-move": "250ms",
        "--duration-fast": "100ms",
        "--showcase-panel-duration": "150ms",
        "--ease-enter": "cubic-bezier(0.16, 1, 0.3, 1)",
        "--duration-normal": "200ms",
      };
      return values[name] ?? "";
    },
  });
  assert.equal(motion.card, 250);
  assert.equal(motion.panelDelay, 100);
  assert.equal(motion.panelDuration, 150);
  assert.equal(motion.panelFrom, 0.97);
  assert.equal(motion.closeRate, 0.8);
  assert.equal(motion.ease, "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.equal(motion.fade, 200);

  assert.equal(css.includes("PLACEHOLDER - showcase shell, no token fits"), true);
  for (const declaration of [
    "--showcase-masonry-row: 1px;",
    "--showcase-hit: 44px;",
    "--showcase-card-move: 250ms;",
    "--showcase-panel-duration: 150ms;",
    "--showcase-panel-scale-from: 0.97;",
    "--showcase-close-rate: 0.8;",
  ]) {
    assert.equal(css.includes(declaration), true, declaration);
  }
  assert.match(
    css,
    /\.showcase-card \{[^}]*background-color:\s*var\(--color-surface-subtle\);[^}]*opacity:\s*var\(--opacity-full\);[^}]*filter:\s*none;[^}]*transition:\s*none;/,
  );
  assert.match(css, /color-mix\(in srgb, var\(--color-base-black\) calc\(var\(--opacity-muted\) \* 100%\), transparent\)/);
  assert.match(css, /\.showcase-actions\[hidden\]\s*\{[^}]*display:\s*none;/);

  const frames = source.slice(source.indexOf("function cardFrames"), source.indexOf("function panelFrames"));
  assert.equal(frames.includes("opacity"), false);
  assert.equal(frames.includes("background"), false);
  assert.equal(source.includes("scaleX"), false);
  assert.equal(source.includes("scaleY"), false);
  assert.match(source, /scale\(\$\{placed\.scale\}\)/);
});

test("the shipped catalog is the hex color picker and nothing else", () => {
  assert.deepEqual(
    SHOWCASE_BLOCKS.map((block) => block.name),
    ["Hex color picker"],
  );
});

test("the card name is text, and the open button carries it", async () => {
  const view = await mount();
  try {
    const name = document.querySelector(".showcase-name");
    assert.equal(name.tagName, "SPAN");
    assert.equal(name.getAttribute("aria-hidden"), "true");
    assert.equal(name.hasAttribute("tabindex"), false);
    assert.equal(name.textContent, "Sample block");
    const before = document.activeElement;
    name.focus();
    assert.equal(document.activeElement, before);

    const button = trigger();
    assert.equal(button.tagName, "BUTTON");
    assert.equal(button.getAttribute("aria-label"), "Open Sample block details");
    button.focus();
    assert.equal(document.activeElement, button);
  } finally {
    await view.unmount();
  }
});

test("Escape, the scrim, and Close dismiss the dialog and return focus", async () => {
  const view = await mount();
  try {
    await openDetails();
    const dialog = document.querySelector('[role="dialog"]');
    assert.equal(dialog.getAttribute("aria-modal"), "true");
    assert.equal(dialog.getAttribute("aria-labelledby"), dialog.querySelector("h2").id);
    assert.equal(dialog.querySelector("h2").textContent, "Sample block");
    assert.equal(
      document.getElementById(dialog.getAttribute("aria-describedby")).textContent,
      "Details for the sample.",
    );
    assert.equal(document.activeElement, dialog.querySelector("h2"));
    assert.equal(dialog.querySelector(".showcase-scrim").querySelector("button"), null);
    const slot = document.querySelector('[data-showcase-slot="sample"]');
    assert.equal(slot.style.height, "460px");
    assert.equal(slot.querySelector(".showcase-card"), null);

    await act(async () => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, trigger());

    await openDetails();
    await act(async () => {
      document.querySelector(".showcase-scrim").click();
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, trigger());

    await openDetails();
    await act(async () => {
      document.querySelector('[aria-label="Close"]').click();
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, trigger());
  } finally {
    await view.unmount();
  }
});
