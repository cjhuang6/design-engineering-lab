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

let IconButton;
let IconButtonDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "icon-button-"));
  const outfile = join(dir, "IconButton.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/icon-button/IconButton.jsx"],
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
  ({ IconButton, IconButtonDemo } = await import(pathToFileURL(outfile).href));
});

function icon() {
  return createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M5 12h14" }));
}

async function mount(node) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
  } catch (error) {
    await act(async () => root.unmount());
    host.remove();
    throw error;
  }
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function buttonNamed(host, name) {
  return [...host.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === name);
}

function pressKey(target, key) {
  const event = new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
}

describe("icon button", { concurrency: false }, () => {
  test("a missing, blank, or non-string label throws", async () => {
    await assert.rejects(() => mount(createElement(IconButton, null, icon())), /requires a label/);
    await assert.rejects(() => mount(createElement(IconButton, { label: "  " }, icon())), /requires a label/);
    await assert.rejects(() => mount(createElement(IconButton, { label: 1 }, icon())), /requires a label/);
  });

  test("the label is the accessible name, the icon is hidden, and type defaults to button", async () => {
    const view = await mount(
      createElement(
        IconButton,
        { label: "Close", variant: "secondary", size: "lg", className: "extra", "aria-label": "Ignored", "aria-labelledby": "elsewhere" },
        icon(),
      ),
    );
    try {
      const button = buttonNamed(view.host, "Close");
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.getAttribute("role"), null);
      assert.equal(button.getAttribute("type"), "button");
      assert.equal(button.getAttribute("aria-label"), "Close");
      assert.equal(button.hasAttribute("aria-labelledby"), false);
      assert.equal(button.className, "camellia-button camellia-button-secondary camellia-button-lg camellia-icon-button extra");
      const hidden = button.querySelector("[aria-hidden='true']");
      assert.ok(hidden);
      assert.equal(hidden.getAttribute("aria-hidden"), "true");
      assert.ok(hidden.querySelector("svg"));
      assert.equal(button.textContent, "");
    } finally {
      await view.unmount();
    }
  });

  test("Enter and Space leave the browser activation alone, and the click runs once", async () => {
    let clicks = 0;
    const view = await mount(createElement(IconButton, { label: "Add", onClick: () => { clicks += 1; } }, icon()));
    try {
      const button = buttonNamed(view.host, "Add");
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
      createElement(IconButton, { label: "Add", disabled: true, onClick: () => { clicks += 1; } }, icon()),
    );
    try {
      const button = buttonNamed(view.host, "Add");
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
      createElement(IconButton, { label: "Add", "aria-disabled": "true", onClick: () => { clicks += 1; } }, icon()),
    );
    try {
      const button = buttonNamed(view.host, "Add");
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

  test("native disabled wins when aria-disabled is also set", async () => {
    let clicks = 0;
    const view = await mount(
      createElement(
        IconButton,
        { label: "Add", disabled: true, "aria-disabled": "true", onClick: () => { clicks += 1; } },
        icon(),
      ),
    );
    try {
      const button = buttonNamed(view.host, "Add");
      assert.equal(button.hasAttribute("disabled"), true);
      button.focus();
      assert.notEqual(document.activeElement, button);
      await act(async () => {
        button.click();
      });
      assert.equal(clicks, 0);
    } finally {
      await view.unmount();
    }
  });

  test("type submit is passed through", async () => {
    const view = await mount(createElement(IconButton, { label: "Add", type: "submit" }, icon()));
    try {
      assert.equal(buttonNamed(view.host, "Add").getAttribute("type"), "submit");
    } finally {
      await view.unmount();
    }
  });

  test("the gallery shows every variant and size, and only an enabled button activates", async () => {
    const view = await mount(createElement(IconButtonDemo));
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
          assert.equal(button.classList.contains("camellia-icon-button"), true);
          assert.ok(button.querySelector("[aria-hidden='true'] svg"));
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
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Activated icon Primary md.");
      await act(async () => {
        buttonNamed(view.host, "Primary disabled").click();
        unavailable.click();
      });
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Activated icon Primary md.");
    } finally {
      await view.unmount();
    }
  });

  test("styles square the control, pair the icon size, and leave hover, focus, and motion on Button", async () => {
    const css = await readFile(join(ROOT, "src/components/icon-button/IconButton.css"), "utf8");
    const buttonCss = await readFile(join(ROOT, "src/components/button/Button.css"), "utf8");
    assert.equal(css.includes(":hover"), false);
    assert.equal(css.includes(":active"), false);
    assert.equal(css.includes("scale("), false);
    assert.equal(css.includes("transition"), false);
    assert.match(css, /\.camellia-icon-button\.camellia-button-sm \{\s*width: var\(--size-control-sm\);\s*padding-inline: var\(--space-0\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-md \{\s*width: var\(--size-control-md\);\s*padding-inline: var\(--space-0\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-lg \{\s*width: var\(--size-control-lg\);\s*padding-inline: var\(--space-0\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-sm \.camellia-icon-button-icon \{\s*width: var\(--size-icon-sm\);\s*height: var\(--size-icon-sm\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-md \.camellia-icon-button-icon \{\s*width: var\(--size-icon-md\);\s*height: var\(--size-icon-md\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-lg \.camellia-icon-button-icon \{\s*width: var\(--size-icon-lg\);\s*height: var\(--size-icon-lg\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-primary \{\s*color: var\(--color-action-primary-text\);/);
    assert.match(css, /\.camellia-icon-button\.camellia-button-secondary,\s*\.camellia-icon-button\.camellia-button-ghost \{\s*color: var\(--color-icon-primary\);/);
    assert.match(buttonCss, /@media \(hover: hover\) and \(pointer: fine\)/);
    assert.match(buttonCss, /\.camellia-button:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(buttonCss, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(buttonCss, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-button \{\s*transition: none;/);
    assert.match(buttonCss, /transition-duration: var\(--duration-fast\);/);
    assert.match(buttonCss, /transition-timing-function: var\(--ease-standard\);/);
  });
});
