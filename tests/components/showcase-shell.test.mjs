import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import * as esbuild from "esbuild";
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { SHOWCASE_BLOCKS } from "../../src/showcase/catalog.js";
import {
  closeMotion,
  columnCount,
  expandedFrame,
  feedColumnCount,
  isMobileWidth,
  masonrySpan,
  mobileFrame,
  motionFromStyle,
  openPanelDelay,
  overlapWindow,
  uniformScale,
} from "../../src/showcase/layout.js";
import { draggedSliderValue } from "../../src/components/hex-color-picker/model.js";

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
let HexPickerControls;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "showcase-shell-"));
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: {
      Showcase: "src/showcase/Showcase.jsx",
      picker: "src/components/hex-color-picker/HexColorPicker.jsx",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    outdir: dir,
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
  ({ Showcase } = await import(pathToFileURL(join(dir, "Showcase.js")).href));
  ({ HexPickerControls } = await import(pathToFileURL(join(dir, "picker.js")).href));
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
      document.documentElement.classList.remove("showcase-scroll-lock");
      document.documentElement.removeAttribute("data-showcase-feed");
      document.body.style.top = "";
      document.body.style.paddingRight = "";
    },
  };
}

function restoreViewport(previous) {
  window.innerWidth = previous.innerWidth;
  window.innerHeight = previous.innerHeight;
  window.scrollY = previous.scrollY;
  window.pageYOffset = previous.scrollY;
  globalThis.__showcaseScrollbar = previous.scrollbar;
  globalThis.__showcaseFitWidth = previous.fitWidth;
}

function rememberViewport() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    scrollbar: globalThis.__showcaseScrollbar,
    fitWidth: globalThis.__showcaseFitWidth,
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
  assert.equal(feedColumnCount(620, 640, 588, 24, 128), 1);
  assert.equal(feedColumnCount(640, 640, 608, 24, 128), 3);
  assert.equal(isMobileWidth(639, 640), true);
  assert.equal(isMobileWidth(640, 640), false);
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

  const band = expandedFrame({ width: 800, height: 800 }, WIDE);
  assert.equal(band.axis, "y");
  assert.equal(band.card.w, 480);
  const phone = mobileFrame({ width: 390, height: 844 }, WIDE);
  assert.equal(phone.card.w, 358);
  assert.equal(phone.card.h, 366);
  assert.equal(phone.panel.y - (phone.card.y + phone.card.h), WIDE.space4);
  assert.equal(phone.panel.y + phone.panel.h, 844 - WIDE.space4);
  const inset = mobileFrame({ width: 390, height: 844 }, WIDE, { top: 47, right: 0, bottom: 34, left: 0 });
  assert.equal(inset.card.y, 63);
  assert.equal(inset.panel.y + inset.panel.h, 844 - (34 + WIDE.space4));
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
  assert.match(source, /translate\(-50%, -50%\) scale\(\$\{scale\}\)/);
  assert.match(source, /fitTransform\(placed\.scale\)/);
  assert.match(source, /fitTransform\(1\)/);
  assert.match(
    css,
    /\.showcase-card\[data-open\] \.showcase-card-fit \{[^}]*top:\s*50%;[^}]*left:\s*50%;/,
  );
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

test("below the breakpoint the feed is one column", async () => {
  const previous = rememberViewport();
  globalThis.__showcaseFitWidth = 80;
  window.innerWidth = 620;
  const blocks = [sampleBlock(), { ...sampleBlock(), id: "other", name: "Other block" }];
  const view = await mount(blocks);
  try {
    const grid = document.querySelector(".showcase-grid");
    assert.equal(document.documentElement.hasAttribute("data-showcase-feed"), true);
    assert.equal(grid.style.gridTemplateColumns, "repeat(1, minmax(0, 1fr))");
    assert.equal(document.querySelector(".showcase-panel"), null);
    for (const slot of grid.querySelectorAll("[data-showcase-slot]")) {
      assert.equal(slot.style.gridRowEnd, "span 476");
    }

    window.innerWidth = 900;
    await act(async () => {
      window.dispatchEvent(new window.Event("resize"));
    });
    assert.equal(document.documentElement.hasAttribute("data-showcase-feed"), false);
    assert.equal(grid.style.gridTemplateColumns, "repeat(3, minmax(0, 1fr))");
    assert.equal(grid.querySelector("[data-showcase-slot]").style.gridRowEnd, "span 484");
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

test("an open phone pins the card and only the controls list scrolls", async () => {
  const previous = rememberViewport();
  window.innerWidth = 390;
  window.innerHeight = 844;
  const view = await mount([
    {
      ...sampleBlock(),
      controls: createElement(
        "div",
        { className: "hex-picker-controls" },
        createElement("div", { className: "hex-picker-controls-head" }, createElement("h4", null, "Controls")),
        createElement(
          "div",
          { "data-showcase-scroll": "" },
          createElement("div", { className: "hex-picker-slider" }, "Offset"),
          createElement("div", { style: { height: "800px" } }, "Tall controls"),
        ),
      ),
    },
  ]);
  try {
    assert.equal(document.querySelector(".showcase-panel"), null);
    await openDetails();
    const layer = document.querySelector(".showcase-layer");
    const card = document.querySelector(".showcase-card[data-open]");
    const panel = document.querySelector(".showcase-panel");
    const list = layer.querySelector("[data-showcase-scroll]");
    const frame = mobileFrame({ width: 390, height: 844 }, WIDE);
    assert.equal(layer.getAttribute("data-mode"), "mobile");
    assert.equal(card.style.width, `${frame.card.w}px`);
    assert.equal(card.style.height, `${frame.card.h}px`);
    assert.equal(card.style.top, `${frame.card.y}px`);
    assert.equal(panel.style.top, `${frame.panel.y}px`);
    assert.equal(panel.style.height, `${frame.panel.h}px`);
    assert.equal(panel.style.width, card.style.width);
    assert.equal(layer.scrollTop, 0);

    const before = {
      cardTop: card.getBoundingClientRect().top,
      cardHeight: card.getBoundingClientRect().height,
      panelTop: panel.getBoundingClientRect().top,
      panelHeight: panel.getBoundingClientRect().height,
    };
    list.scrollTop = 240;
    list.dispatchEvent(new window.Event("scroll", { bubbles: true }));
    assert.equal(card.getBoundingClientRect().top, before.cardTop);
    assert.equal(card.getBoundingClientRect().height, before.cardHeight);
    assert.equal(panel.getBoundingClientRect().top, before.panelTop);
    assert.equal(panel.getBoundingClientRect().height, before.panelHeight);
    assert.equal(card.style.top, `${frame.card.y}px`);
    assert.equal(panel.style.top, `${frame.panel.y}px`);
    assert.equal(layer.scrollTop, 0);

    const onStage = new window.Event("touchmove", { bubbles: true, cancelable: true, touches: [{}] });
    document.querySelector(".showcase-stage").dispatchEvent(onStage);
    assert.equal(onStage.defaultPrevented, true);

    const onList = new window.Event("touchmove", { bubbles: true, cancelable: true, touches: [{}] });
    list.dispatchEvent(onList);
    assert.equal(onList.defaultPrevented, false);

    const onSlider = new window.Event("touchmove", { bubbles: true, cancelable: true, touches: [{}] });
    layer.querySelector(".hex-picker-slider").dispatchEvent(onSlider);
    assert.equal(onSlider.defaultPrevented, false);
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

test("scroll lock restores the page, and Escape, the scrim, and Close return focus", async () => {
  const previous = rememberViewport();
  window.innerWidth = 390;
  window.innerHeight = 844;
  window.scrollY = 180;
  globalThis.__showcaseScrollbar = 12;
  const view = await mount();
  try {
    await openDetails();
    assert.equal(document.documentElement.classList.contains("showcase-scroll-lock"), true);
    assert.equal(document.body.style.top, "-180px");
    assert.equal(document.body.style.paddingRight, "12px");

    await act(async () => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, trigger());
    assert.equal(document.documentElement.classList.contains("showcase-scroll-lock"), false);
    assert.equal(document.body.style.top, "");
    assert.equal(document.body.style.paddingRight, "");
    assert.equal(window.scrollY, 180);

    await openDetails();
    await act(async () => {
      document.querySelector(".showcase-scrim").click();
    });
    assert.equal(document.activeElement, trigger());
    assert.equal(window.scrollY, 180);
    assert.equal(document.documentElement.classList.contains("showcase-scroll-lock"), false);

    await openDetails();
    await act(async () => {
      document.querySelector('[aria-label="Close"]').click();
    });
    assert.equal(document.activeElement, trigger());
    assert.equal(window.scrollY, 180);
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

test("a wide viewport still opens the side-by-side frame", async () => {
  const previous = rememberViewport();
  window.innerWidth = 1280;
  window.innerHeight = 800;
  const view = await mount();
  try {
    await openDetails();
    const frame = expandedFrame({ width: 1280, height: 800 }, WIDE);
    const card = document.querySelector(".showcase-card[data-open]");
    const panel = document.querySelector(".showcase-panel");
    assert.equal(document.querySelector(".showcase-layer").getAttribute("data-mode"), "desktop");
    assert.equal(card.style.left, `${frame.card.x}px`);
    assert.equal(card.style.top, `${frame.card.y}px`);
    assert.equal(card.style.width, `${frame.card.w}px`);
    assert.equal(card.style.height, `${frame.card.h}px`);
    assert.equal(panel.style.left, `${frame.panel.x}px`);
    assert.equal(panel.style.width, `${frame.panel.w}px`);
    assert.equal(panel.style.height, `${frame.panel.h}px`);
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

test("the safe-area inset moves the pinned card and the panel still fills to the bottom", async () => {
  const previous = rememberViewport();
  window.innerWidth = 390;
  window.innerHeight = 844;
  const view = await mount([sampleBlock()]);
  try {
    await openDetails();
    const probe = document.querySelector(".showcase-safe-probe");
    probe.style.paddingTop = "47px";
    probe.style.paddingBottom = "34px";
    await act(async () => {
      window.dispatchEvent(new window.Event("resize"));
    });
    const frame = mobileFrame({ width: 390, height: 844 }, WIDE, { top: 47, right: 0, bottom: 34, left: 0 });
    const card = document.querySelector(".showcase-card[data-open]");
    const panel = document.querySelector(".showcase-panel");
    assert.equal(card.style.top, `${frame.card.y}px`);
    assert.equal(card.style.height, `${frame.card.h}px`);
    assert.equal(panel.style.top, `${frame.panel.y}px`);
    assert.equal(panel.style.height, `${frame.panel.h}px`);
    assert.equal(frame.panel.y + frame.panel.h, 844 - (34 + WIDE.space4));
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

function ControlsHarness() {
  const [radius, setRadius] = useState(80);
  const [scale, setScale] = useState(1.15);
  const [darken, setDarken] = useState(0.12);
  return createElement(HexPickerControls, {
    radius,
    scaleHover: scale,
    darken,
    onRadius: setRadius,
    onScale: setScale,
    onDarken: setDarken,
    onReset() {
      setRadius(80);
      setScale(1.15);
      setDarken(0);
    },
  });
}

test("Reset sits in the Controls row, restores values, and a touch drag moves a slider", async () => {
  assert.equal(draggedSliderValue(80, 100, 200, 40, 160, 1), 140);
  assert.equal(draggedSliderValue(1.15, 50, 100, 1, 1.4, 0.01), 1.35);
  assert.equal(draggedSliderValue(80, 10000, 200, 40, 160, 1), 160);
  assert.equal(draggedSliderValue(80, -10000, 200, 40, 160, 1), 40);

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(ControlsHarness));
  });
  try {
    const head = document.querySelector(".hex-picker-controls-head");
    const reset = head.querySelector("button");
    assert.equal(head.querySelector("h4").textContent, "Controls");
    assert.equal(reset.textContent, "Reset");
    assert.equal(reset.getAttribute("aria-label"), "Reset controls");
    assert.equal(reset.parentElement, head);
    assert.equal(head.querySelector("h4").parentElement, head);
    const radius = [...document.querySelectorAll(".hex-picker-slider input")].find(
      (input) => input.getAttribute("aria-valuetext") === "80px",
    );
    assert.equal(radius.type || radius.getAttribute("type"), "range");
    assert.equal(radius.tabIndex >= 0, true);
    assert.equal(radius.min || radius.getAttribute("min"), "40");
    assert.equal(radius.max || radius.getAttribute("max"), "160");
    assert.equal(radius.step || radius.getAttribute("step"), "1");

    const slider = radius.closest(".hex-picker-slider");
    await act(async () => {
      slider.dispatchEvent(
        new window.Event("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
          clientX: 0,
          clientY: 0,
          pointerId: 3,
        }),
      );
      slider.dispatchEvent(
        new window.Event("pointermove", {
          bubbles: true,
          pointerType: "mouse",
          clientX: 80,
          clientY: 0,
          pointerId: 3,
        }),
      );
    });
    assert.equal(radius.getAttribute("aria-valuetext"), "80px");

    await act(async () => {
      slider.dispatchEvent(
        new window.Event("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: 0,
          clientY: 0,
          pointerId: 4,
        }),
      );
      slider.dispatchEvent(
        new window.Event("pointermove", {
          bubbles: true,
          pointerType: "touch",
          clientX: 4,
          clientY: 30,
          pointerId: 4,
        }),
      );
    });
    assert.equal(radius.getAttribute("aria-valuetext"), "80px");

    await act(async () => {
      slider.dispatchEvent(
        new window.Event("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: 0,
          clientY: 0,
          pointerId: 5,
        }),
      );
      slider.dispatchEvent(
        new window.Event("pointermove", {
          bubbles: true,
          pointerType: "touch",
          clientX: 40,
          clientY: 1,
          pointerId: 5,
        }),
      );
    });
    assert.equal(draggedSliderValue(80, 40, slider.clientWidth, 40, 160, 1), 120);
    assert.equal(radius.getAttribute("aria-valuetext"), "120px");

    await act(async () => {
      reset.click();
    });
    assert.equal(radius.getAttribute("aria-valuetext"), "80px");
    const shown = [...document.querySelectorAll(".hex-picker-slider-value")].map((node) => node.textContent);
    assert.deepEqual(shown, ["80px", "1.15×", "0.00"]);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }

  const previous = rememberViewport();
  window.innerWidth = 1280;
  window.innerHeight = 800;
  const view = await mount(null);
  try {
    const button = document.querySelector('[data-showcase-trigger="hex-color-picker"]');
    await act(async () => {
      button.click();
    });
    const head = document.querySelector(".showcase-panel .hex-picker-controls-head");
    assert.equal(head.querySelector("h4").textContent, "Controls");
    assert.equal(head.querySelector("button").getAttribute("aria-label"), "Reset controls");
    assert.equal(document.querySelector(".showcase-panel .hex-picker-reset").textContent, "Reset");
  } finally {
    await view.unmount();
    restoreViewport(previous);
  }
});

test("mobile shell rules use the breakpoint token, dvh, and safe-area insets", async () => {
  const css = await readFile(join(ROOT, "src/showcase/showcase.css"), "utf8");
  const picker = await readFile(join(ROOT, "src/components/hex-color-picker/HexColorPicker.css"), "utf8");
  const page = await readFile(join(ROOT, "index.html"), "utf8");
  assert.match(page, /viewport-fit=cover/);
  assert.match(css, /html\[data-showcase-feed\] \.showcase-card \{[^}]*padding-inline:\s*var\(--space-4\);/);
  assert.match(css, /html\[data-showcase-feed\] \.showcase-grid \{[^}]*column-gap:\s*var\(--space-4\);/);
  assert.match(css, /\.showcase-layer\[data-mode='mobile'\] \{[^}]*overflow:\s*hidden;[^}]*100dvh;/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /html\.showcase-scroll-lock body \{[^}]*position:\s*fixed;/);
  assert.match(css, /\[data-showcase-scroll\] \{[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.showcase-layer\[data-mode='mobile'\] \.hex-picker-slider \{[^}]*flex:\s*none;/);
  assert.match(css, /@media \(hover: none\) \{[^}]*\.showcase-actions \{[^}]*opacity:\s*var\(--opacity-full\);/);
  assert.match(
    picker,
    /button\.hex-picker-reset \{[^}]*border-radius:\s*var\(--radius-full\);[^}]*background:\s*transparent;/,
  );
  assert.match(
    picker,
    /button\.hex-picker-reset:hover,\s*button\.hex-picker-reset:focus-visible,\s*button\.hex-picker-reset:active \{[^}]*background:\s*var\(--color-surface-secondary\);/,
  );
  assert.match(picker, /touch-action:\s*pan-y;/);
  assert.match(picker, /\.hex-picker-slider input \{[^}]*pointer-events:\s*none;/);
  assert.match(picker, /button\.hex-picker-reset:focus-visible \{[^}]*outline:\s*var\(--border-focus\);/);
});
