import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let ToggleChip;
let ToggleChipDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "toggle-chip-"));
  const outfile = join(dir, "ToggleChip.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/toggle-chip/ToggleChip.jsx"],
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
  ({ ToggleChip, ToggleChipDemo } = await import(pathToFileURL(outfile).href));
});

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

function buttonNamed(host, name) {
  return [...host.querySelectorAll("button")].find(
    (item) => item.querySelector(".camellia-toggle-chip-label")?.textContent === name,
  );
}

function pressKey(target, key, type = "keydown") {
  const event = new window.KeyboardEvent(type, { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
}

function icon() {
  return createElement("svg", { viewBox: "0 0 16 16" }, createElement("path", { d: "M2 2h12v12H2z" }));
}

function mediaBlock(source, header) {
  const start = source.indexOf(header);
  assert.ok(start >= 0, header);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, body: source.slice(start, index + 1) };
    }
  }
  assert.fail(`unclosed ${header}`);
}

describe("toggle chip", { concurrency: false }, () => {
  test("a missing, blank, or non-string label throws", async () => {
    await assert.rejects(() => mount(createElement(ToggleChip)), /requires a visible label/);
    await assert.rejects(() => mount(createElement(ToggleChip, null, "  ")), /requires a visible label/);
    await assert.rejects(() => mount(createElement(ToggleChip, null, 1)), /requires a visible label/);
  });

  test("a native button takes its name from the label and starts unpressed", async () => {
    const view = await mount(
      createElement(
        ToggleChip,
        { className: "extra", id: "clear", "aria-label": "Ignored", "aria-labelledby": "elsewhere", "aria-pressed": "true", icon: icon() },
        "Clear",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.getAttribute("role"), null);
      assert.equal(button.getAttribute("type"), "button");
      assert.equal(button.id, "clear");
      assert.equal(button.className, "camellia-toggle-chip extra");
      assert.equal(button.getAttribute("aria-pressed"), "false");
      assert.equal(button.hasAttribute("aria-label"), false);
      assert.equal(button.hasAttribute("aria-labelledby"), false);
      assert.equal(button.querySelector(".camellia-toggle-chip-label").textContent, "Clear");
      assert.equal(button.querySelector(".camellia-toggle-chip-label").hasAttribute("aria-hidden"), false);
      assert.equal(button.textContent.trim(), "Clear");
      const mark = button.querySelector(".camellia-toggle-chip-mark");
      const glyph = button.querySelector(".camellia-toggle-chip-icon");
      assert.equal(mark.getAttribute("aria-hidden"), "true");
      assert.ok(mark.querySelector(".camellia-toggle-chip-dot"));
      assert.equal(glyph.getAttribute("aria-hidden"), "true");
      assert.ok(glyph.querySelector("svg"));
    } finally {
      await view.unmount();
    }
  });

  test("an uncontrolled chip toggles on click and reports the next state", async () => {
    const changes = [];
    let clicks = 0;
    const view = await mount(
      createElement(
        ToggleChip,
        {
          defaultPressed: true,
          onPressedChange: (next) => changes.push(next),
          onClick: () => { clicks += 1; },
        },
        "Clear",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.ok(button.querySelector(".camellia-toggle-chip-mark svg"));
      await act(async () => {
        button.click();
      });
      assert.equal(button.getAttribute("aria-pressed"), "false");
      assert.ok(button.querySelector(".camellia-toggle-chip-dot"));
      assert.deepEqual(changes, [false]);
      assert.equal(clicks, 1);
      await act(async () => {
        button.click();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.deepEqual(changes, [false, true]);
    } finally {
      await view.unmount();
    }
  });

  test("a controlled chip reports the next state and keeps the pressed prop", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        ToggleChip,
        { pressed: false, defaultPressed: true, onPressedChange: (next) => changes.push(next) },
        "Clear",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.getAttribute("aria-pressed"), "false");
      await act(async () => {
        button.click();
      });
      assert.deepEqual(changes, [true]);
      assert.equal(button.getAttribute("aria-pressed"), "false");
    } finally {
      await view.unmount();
    }
  });

  test("a controlled parent updates aria-pressed", async () => {
    function Harness() {
      const [pressed, setPressed] = useState(false);
      return createElement(ToggleChip, { pressed, onPressedChange: setPressed }, "Clear");
    }
    const view = await mount(createElement(Harness));
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.getAttribute("aria-pressed"), "false");
      await act(async () => {
        button.click();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      await act(async () => {
        button.click();
      });
      assert.equal(button.getAttribute("aria-pressed"), "false");
    } finally {
      await view.unmount();
    }
  });

  test("Enter and Space leave the browser activation alone, and the click toggles once", async () => {
    const changes = [];
    const view = await mount(
      createElement(ToggleChip, { onPressedChange: (next) => changes.push(next) }, "Clear"),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      const enter = pressKey(button, "Enter");
      const enterUp = pressKey(button, "Enter", "keyup");
      assert.equal(enter.defaultPrevented, false);
      assert.equal(enterUp.defaultPrevented, false);
      await act(async () => {
        button.click();
      });
      assert.deepEqual(changes, [true]);
      const space = pressKey(button, " ");
      const spaceUp = pressKey(button, " ", "keyup");
      assert.equal(space.defaultPrevented, false);
      assert.equal(spaceUp.defaultPrevented, false);
      await act(async () => {
        button.click();
      });
      assert.deepEqual(changes, [true, false]);
    } finally {
      await view.unmount();
    }
  });

  test("native disabled leaves the tab order and does not toggle", async () => {
    const changes = [];
    let clicks = 0;
    const view = await mount(
      createElement(
        ToggleChip,
        { disabled: true, defaultPressed: true, onPressedChange: (next) => changes.push(next), onClick: () => { clicks += 1; } },
        "Later",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Later");
      assert.equal(button.hasAttribute("disabled"), true);
      assert.equal(button.getAttribute("aria-pressed"), "true");
      button.focus();
      assert.notEqual(document.activeElement, button);
      const enter = pressKey(button, "Enter");
      const space = pressKey(button, " ");
      await act(async () => {
        button.click();
      });
      assert.equal(enter.defaultPrevented, false);
      assert.equal(space.defaultPrevented, false);
      assert.deepEqual(changes, []);
      assert.equal(clicks, 0);
      assert.equal(button.getAttribute("aria-pressed"), "true");
    } finally {
      await view.unmount();
    }
  });

  test("aria-disabled stays focusable and blocks click, Enter, and Space", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        ToggleChip,
        { "aria-disabled": "true", onPressedChange: (next) => changes.push(next) },
        "Clear",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.hasAttribute("disabled"), false);
      assert.equal(button.getAttribute("aria-disabled"), "true");
      button.focus();
      assert.equal(document.activeElement, button);
      const enter = pressKey(button, "Enter");
      const space = pressKey(button, " ");
      const enterUp = pressKey(button, "Enter", "keyup");
      const spaceUp = pressKey(button, " ", "keyup");
      await act(async () => {
        button.click();
      });
      assert.equal(enter.defaultPrevented, true);
      assert.equal(space.defaultPrevented, true);
      assert.equal(enterUp.defaultPrevented, true);
      assert.equal(spaceUp.defaultPrevented, true);
      assert.deepEqual(changes, []);
      assert.equal(button.getAttribute("aria-pressed"), "false");
    } finally {
      await view.unmount();
    }
  });

  test("type and other button attributes pass through", async () => {
    let clicks = 0;
    const view = await mount(
      createElement(
        ToggleChip,
        { type: "submit", name: "reason", "data-kind": "reason", onClick: () => { clicks += 1; } },
        "Clear",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Clear");
      assert.equal(button.getAttribute("type"), "submit");
      assert.equal(button.getAttribute("name"), "reason");
      assert.equal(button.getAttribute("data-kind"), "reason");
      await act(async () => {
        button.click();
      });
      assert.equal(clicks, 1);
      assert.equal(button.getAttribute("aria-pressed"), "true");
    } finally {
      await view.unmount();
    }
  });

  test("the gallery is a labeled group, and only an enabled chip toggles", async () => {
    const view = await mount(createElement(ToggleChipDemo));
    try {
      const group = view.host.querySelector("[role='group']");
      assert.equal(group.getAttribute("aria-labelledby"), "toggle-chip-demo-reasons");
      assert.equal(view.host.querySelector("#toggle-chip-demo-reasons").textContent, "Reasons");
      assert.equal(buttonNamed(view.host, "Clear").getAttribute("aria-pressed"), "true");
      assert.equal(buttonNamed(view.host, "Useful").getAttribute("aria-pressed"), "false");
      assert.equal(buttonNamed(view.host, "Specific").getAttribute("aria-pressed"), "false");
      assert.ok(buttonNamed(view.host, "Useful").querySelector(".camellia-toggle-chip-icon[aria-hidden='true'] svg"));
      assert.equal(buttonNamed(view.host, "Clear").querySelector(".camellia-toggle-chip-icon"), null);
      const later = buttonNamed(view.host, "Later");
      assert.equal(later.hasAttribute("disabled"), true);
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Selected Clear.");
      await act(async () => {
        buttonNamed(view.host, "Useful").click();
      });
      assert.equal(buttonNamed(view.host, "Useful").getAttribute("aria-pressed"), "true");
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Selected Clear and Useful.");
      await act(async () => {
        buttonNamed(view.host, "Clear").click();
        later.click();
      });
      assert.equal(buttonNamed(view.host, "Clear").getAttribute("aria-pressed"), "false");
      assert.equal(later.getAttribute("aria-pressed"), "false");
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Selected Useful.");
    } finally {
      await view.unmount();
    }
  });

  test("styles use tokens, and the press fill is not lighter than hover", async () => {
    const css = await readFile(join(ROOT, "src/components/toggle-chip/ToggleChip.css"), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
    assert.equal(/\d+px\b/.test(css), false);
    assert.equal(/\brgba?\(/.test(css), false);
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 2);
    const unselectedHover = /\.camellia-toggle-chip:not\(:disabled\):not\(\[aria-disabled='true'\]\):not\(\[aria-pressed='true'\]\):hover \{[^}]*background: var\(--color-surface-secondary\);/;
    const selectedHover = /\.camellia-toggle-chip\[aria-pressed='true'\]:not\(:disabled\):not\(\[aria-disabled='true'\]\):hover \{[^}]*background: var\(--color-surface-selected\);[^}]*color: var\(--color-action-link\);/;
    assert.match(hover.body, unselectedHover);
    assert.match(hover.body, selectedHover);
    assert.equal(hover.body.includes("--color-surface-primary"), false);
    assert.equal(hover.body.includes("--color-surface-subtle"), false);
    const unselectedPressed = /\.camellia-toggle-chip:not\(:disabled\):not\(\[aria-disabled='true'\]\):not\(\[aria-pressed='true'\]\):active \{\s*background: var\(--color-surface-subtle\);/;
    assert.match(css, unselectedPressed);
    const darkPressed = /\[data-theme='dark'\] \.camellia-toggle-chip:not\(:disabled\):not\(\[aria-disabled='true'\]\):not\(\[aria-pressed='true'\]\):active \{\s*background: var\(--color-surface-secondary\);\s*\}/;
    assert.match(css.slice(hover.end), darkPressed);
    const selectedPressed = /\.camellia-toggle-chip\[aria-pressed='true'\]:not\(:disabled\):not\(\[aria-disabled='true'\]\):active \{\s*background: var\(--color-surface-selected\);\s*color: var\(--color-action-link\);/;
    assert.match(css.slice(hover.end), selectedPressed);
    assert.match(css, /\.camellia-toggle-chip:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-toggle-chip \{\s*transition: none;/);
    assert.match(css, /transition-property: background-color, color, border-color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.equal(css.includes("scale("), false);
    assert.match(css, /height: var\(--size-control-sm\);/);
    assert.match(css, /font: var\(--label-sm\);/);
    assert.match(css, /letter-spacing: var\(--label-sm-letter-spacing\);/);
    assert.match(css, /padding-inline: var\(--space-2\) var\(--space-3\);/);
    assert.match(css, /padding-block: var\(--space-0\);/);
    assert.match(css, /gap: var\(--space-1\);/);
    assert.match(css, /border-radius: var\(--radius-full\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /color: var\(--color-text-secondary\);/);
    assert.match(css, /box-shadow: var\(--shadow-control\);/);
    assert.match(css, /box-shadow: var\(--shadow-control-hover\);/);
    assert.match(css, /background: var\(--color-surface-selected\);/);
    assert.match(css, /color: var\(--color-action-link\);/);
    assert.match(css, /box-shadow: 0 0 0 var\(--border-width-1\) var\(--color-action-primary\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
    assert.match(css, /gap: var\(--space-2\);/);
  });
});
