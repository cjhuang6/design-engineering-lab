import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let SegmentedControl;
let SlotCodeControls;
let useSlotCodeBlock;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "showcase-controls-"));
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: {
      controls: "src/showcase/controls.jsx",
      slot: "src/showcase/slot-controls.jsx",
      blocks: "src/showcase/blocks.jsx",
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
  ({ SegmentedControl } = await import(pathToFileURL(join(dir, "controls.js")).href));
  ({ SlotCodeControls } = await import(pathToFileURL(join(dir, "slot.js")).href));
  ({ useSlotCodeBlock } = await import(pathToFileURL(join(dir, "blocks.js")).href));
});

const OPTIONS = [
  { value: "retro", label: "Retro" },
  { value: "smooth", label: "Smooth" },
];

function Harness() {
  const [value, setValue] = useState("retro");
  return createElement(SegmentedControl, { label: "Fill style", value, options: OPTIONS, onChange: setValue });
}

async function mount(node) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function option(value) {
  return document.querySelector(`[data-value="${value}"]`);
}

test("pointer selection moves the segment without focusing it, and arrows do both", async () => {
  const css = await readFile("src/showcase/showcase.css", "utf8");
  assert.match(css, /button\.showcase-segment:focus \{[^}]*outline:\s*none;/);
  assert.match(css, /button\.showcase-segment:focus-visible \{[^}]*outline:\s*var\(--border-focus\);/);
  assert.match(css, /@media \(pointer: coarse\) \{[^}]*button\.showcase-segment \{[^}]*min-height:\s*var\(--showcase-hit\);[^}]*min-width:\s*var\(--showcase-hit\);/s);
  const view = await mount(createElement(Harness));
  try {
    assert.equal(option("retro").getAttribute("aria-checked"), "true");
    assert.equal(option("retro").getAttribute("tabindex"), "0");
    assert.equal(option("smooth").getAttribute("tabindex"), "-1");
    assert.equal(document.querySelector("[role='radiogroup']").getAttribute("aria-labelledby") != null, true);

    const before = document.activeElement;
    const event = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
    await act(async () => {
      option("smooth").dispatchEvent(event);
    });
    assert.equal(event.defaultPrevented, true);
    assert.equal(option("smooth").getAttribute("aria-checked"), "true");
    assert.equal(option("retro").getAttribute("aria-checked"), "false");
    assert.equal(option("smooth").getAttribute("tabindex"), "0");
    assert.equal(document.activeElement, before);

    option("smooth").focus();
    await act(async () => {
      option("smooth").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    assert.equal(option("retro").getAttribute("aria-checked"), "true");
    assert.equal(document.activeElement, option("retro"));

    await act(async () => {
      option("retro").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    assert.equal(option("smooth").getAttribute("aria-checked"), "true");
    assert.equal(document.activeElement, option("smooth"));

    await act(async () => {
      option("smooth").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    assert.equal(document.activeElement, option("retro"));
    assert.equal(option("retro").getAttribute("aria-checked"), "true");
  } finally {
    await view.unmount();
  }
});

function ControlsHarness() {
  const [fillStyle, setFillStyle] = useState("retro");
  const [countdown, setCountdown] = useState(5);
  return createElement(SlotCodeControls, {
    fillStyle,
    countdown,
    onFillStyle: setFillStyle,
    onCountdown: setCountdown,
    onReset() {
      setFillStyle("retro");
      setCountdown(5);
    },
  });
}

test("retro leaves the countdown slider in place and disabled, and reset restores both", async () => {
  const view = await mount(createElement(ControlsHarness));
  try {
    const slider = document.querySelector(".showcase-slider");
    const input = slider.querySelector("input");
    assert.equal(slider.hasAttribute("hidden"), false);
    assert.equal(input.hasAttribute("disabled"), true);
    assert.equal(input.value, "5");
    const retroHeight = slider.offsetHeight;

    await act(async () => {
      option("smooth").dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    });
    assert.equal(input.hasAttribute("disabled"), false);
    assert.equal(slider.offsetHeight, retroHeight);
    await act(async () => {
      input.value = "12";
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(input.value, "12");

    await act(async () => {
      document.querySelector(".showcase-reset").click();
    });
    assert.equal(option("retro").getAttribute("aria-checked"), "true");
    assert.equal(input.hasAttribute("disabled"), true);
    assert.equal(input.value, "5");
    assert.equal(slider.offsetHeight, retroHeight);
    assert.equal(document.querySelector(".showcase-reset").getAttribute("aria-label"), "Reset controls");
  } finally {
    await view.unmount();
  }
});

function BlockHarness() {
  const block = useSlotCodeBlock();
  return block.controls;
}

test("the security code block starts on Smooth at 5 seconds, and reset returns there", async () => {
  const view = await mount(createElement(BlockHarness));
  try {
    const slider = document.querySelector(".showcase-slider");
    const input = slider.querySelector("input");
    assert.equal(option("smooth").getAttribute("aria-checked"), "true");
    assert.equal(input.hasAttribute("disabled"), false);
    assert.equal(input.value, "5");
    assert.equal(input.getAttribute("aria-valuetext"), "5 seconds");
    const smoothHeight = slider.offsetHeight;

    await act(async () => {
      option("retro").dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    });
    assert.equal(input.hasAttribute("disabled"), true);
    assert.equal(slider.offsetHeight, smoothHeight);

    await act(async () => {
      document.querySelector(".showcase-reset").click();
    });
    const restored = document.querySelector(".showcase-slider");
    assert.equal(option("smooth").getAttribute("aria-checked"), "true");
    assert.equal(restored.querySelector("input").hasAttribute("disabled"), false);
    assert.equal(restored.textContent.includes("5s"), true);
    assert.equal(restored.querySelector("input").getAttribute("aria-valuetext"), "5 seconds");
    assert.equal(restored.offsetHeight, smoothHeight);
  } finally {
    await view.unmount();
  }
});
