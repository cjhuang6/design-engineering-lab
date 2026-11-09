import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let Button;
let ButtonDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "button-"));
  const outfile = join(dir, "Button.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/button/Button.jsx"],
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
  ({ Button, ButtonDemo } = await import(pathToFileURL(outfile).href));
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
  return [...host.querySelectorAll("button")].find((item) => item.textContent === name);
}

function pressKey(target, key) {
  const event = new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
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

describe("button", { concurrency: false }, () => {
  test("a native button takes its name from the label and its classes from variant and size", async () => {
    const view = await mount(createElement(Button, { variant: "secondary", size: "lg", className: "extra" }, "Save"));
    try {
      const button = buttonNamed(view.host, "Save");
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.getAttribute("role"), null);
      assert.equal(button.getAttribute("type"), "button");
      assert.equal(button.className, "camellia-button camellia-button-secondary camellia-button-lg extra");
      assert.equal(button.textContent, "Save");
    } finally {
      await view.unmount();
    }
  });

  test("Enter and Space leave the browser activation alone, and the click runs once", async () => {
    let clicks = 0;
    const view = await mount(createElement(Button, { onClick: () => { clicks += 1; } }, "Save"));
    try {
      const button = buttonNamed(view.host, "Save");
      const enter = pressKey(button, "Enter");
      assert.equal(enter.defaultPrevented, false);
      await act(async () => {
        button.click();
      });
      assert.equal(clicks, 1);
      const space = pressKey(button, " ");
      assert.equal(space.defaultPrevented, false);
      await act(async () => {
        button.click();
      });
      assert.equal(clicks, 2);
    } finally {
      await view.unmount();
    }
  });

  test("native disabled leaves the tab order and does not activate", async () => {
    let clicks = 0;
    const view = await mount(
      createElement(Button, { disabled: true, onClick: () => { clicks += 1; } }, "Save"),
    );
    try {
      const button = buttonNamed(view.host, "Save");
      assert.equal(button.hasAttribute("disabled"), true);
      assert.equal(button.getAttribute("aria-disabled"), null);
      button.focus();
      assert.notEqual(document.activeElement, button);
      const enter = pressKey(button, "Enter");
      const space = pressKey(button, " ");
      await act(async () => {
        button.click();
      });
      assert.equal(enter.defaultPrevented, false);
      assert.equal(space.defaultPrevented, false);
      assert.equal(clicks, 0);
    } finally {
      await view.unmount();
    }
  });

  test("aria-disabled stays focusable and blocks click, Enter, and Space", async () => {
    let clicks = 0;
    const view = await mount(
      createElement(Button, { "aria-disabled": "true", onClick: () => { clicks += 1; } }, "Save"),
    );
    try {
      const button = buttonNamed(view.host, "Save");
      assert.equal(button.hasAttribute("disabled"), false);
      assert.equal(button.getAttribute("aria-disabled"), "true");
      button.focus();
      assert.equal(document.activeElement, button);
      const enter = pressKey(button, "Enter");
      const space = pressKey(button, " ");
      await act(async () => {
        button.click();
      });
      assert.equal(enter.defaultPrevented, true);
      assert.equal(space.defaultPrevented, true);
      assert.equal(clicks, 0);
    } finally {
      await view.unmount();
    }
  });

  test("aria-disabled false still activates, and type and aria-label pass through", async () => {
    let clicks = 0;
    const view = await mount(
      createElement(
        Button,
        { type: "submit", "aria-disabled": "false", "aria-label": "Save draft", onClick: () => { clicks += 1; } },
        "Save",
      ),
    );
    try {
      const button = buttonNamed(view.host, "Save");
      assert.equal(button.getAttribute("type"), "submit");
      assert.equal(button.getAttribute("aria-label"), "Save draft");
      assert.equal(button.getAttribute("aria-disabled"), "false");
      const enter = pressKey(button, "Enter");
      assert.equal(enter.defaultPrevented, false);
      await act(async () => {
        button.click();
      });
      assert.equal(clicks, 1);
    } finally {
      await view.unmount();
    }
  });

  test("the gallery shows every variant and size, and only an enabled button activates", async () => {
    const view = await mount(createElement(ButtonDemo));
    try {
      const variants = ["primary", "secondary", "ghost"];
      const sizes = ["sm", "md", "lg"];
      for (const variant of variants) {
        for (const size of sizes) {
          const label = `${variant[0].toUpperCase()}${variant.slice(1)} ${size}`;
          const button = buttonNamed(view.host, label);
          assert.ok(button, label);
          assert.equal(button.classList.contains(`camellia-button-${variant}`), true);
          assert.equal(button.classList.contains(`camellia-button-${size}`), true);
        }
      }
      assert.equal(view.host.querySelectorAll("button").length, 15);
      assert.equal(buttonNamed(view.host, "Primary disabled").hasAttribute("disabled"), true);
      const unavailable = buttonNamed(view.host, "Primary unavailable");
      assert.equal(unavailable.getAttribute("aria-disabled"), "true");
      assert.equal(unavailable.hasAttribute("disabled"), false);
      unavailable.focus();
      assert.equal(document.activeElement, unavailable);
      await act(async () => {
        buttonNamed(view.host, "Primary md").click();
      });
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Activated Primary md.");
      await act(async () => {
        buttonNamed(view.host, "Primary disabled").click();
        unavailable.click();
      });
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Activated Primary md.");
    } finally {
      await view.unmount();
    }
  });

  test("styles use the button tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/button/Button.css"), "utf8");
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 3);
    assert.match(css, /\.camellia-button:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-button \{\s*transition: none;/);
    assert.match(css, /transition-property: background-color, color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.equal(css.includes("scale("), false);
    assert.match(css, /height: var\(--size-control-sm\);/);
    assert.match(css, /height: var\(--size-control-md\);/);
    assert.match(css, /height: var\(--size-control-lg\);/);
    assert.match(css, /padding-inline: var\(--control-padding-inline-sm\);/);
    assert.match(css, /padding-inline: var\(--control-padding-inline-md\);/);
    assert.match(css, /padding-inline: var\(--control-padding-inline-lg\);/);
    assert.match(css, /padding-block: var\(--space-0\);/);
    assert.match(css, /border-radius: var\(--radius-md\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
    assert.match(css, /background: var\(--color-action-primary-pressed\);/);
    assert.match(css, /background: var\(--color-action-primary-hover\);/);
    assert.match(css, /box-shadow: var\(--shadow-control-hover\);/);
    assert.match(css, /background: var\(--color-surface-subtle\);/);
  });
});
