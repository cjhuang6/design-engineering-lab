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

let Switch;
let SwitchDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "switch-"));
  const outfile = join(dir, "Switch.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/switch/Switch.jsx"],
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
  ({ Switch, SwitchDemo } = await import(pathToFileURL(outfile).href));
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

function boxNamed(host, name) {
  return [...host.querySelectorAll("label")].find(
    (item) => item.querySelector(".camellia-switch-label")?.textContent === name,
  );
}

function inputNamed(host, name) {
  return boxNamed(host, name)?.querySelector("input");
}

function pressKey(target, key, type = "keydown") {
  const event = new window.KeyboardEvent(type, { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
}

async function activate(input) {
  await act(async () => {
    input.click();
  });
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

describe("switch", { concurrency: false }, () => {
  test("a missing, blank, or non-string label throws", async () => {
    await assert.rejects(() => mount(createElement(Switch)), /requires a visible label/);
    await assert.rejects(() => mount(createElement(Switch, null, "  ")), /requires a visible label/);
    await assert.rejects(() => mount(createElement(Switch, null, 1)), /requires a visible label/);
  });

  test("a state other than true or false throws", async () => {
    await assert.rejects(
      () => mount(createElement(Switch, { checked: "mixed" }, "Wi-Fi")),
      /must be true or false/,
    );
    await assert.rejects(
      () => mount(createElement(Switch, { checked: "yes" }, "Wi-Fi")),
      /must be true or false/,
    );
    await assert.rejects(
      () => mount(createElement(Switch, { defaultChecked: 1 }, "Wi-Fi")),
      /must be true or false/,
    );
  });

  test("a native switch takes its name from the label and starts off", async () => {
    const view = await mount(
      createElement(
        Switch,
        {
          className: "extra",
          id: "wifi",
          name: "connections",
          value: "wifi",
          role: "checkbox",
          type: "radio",
          "aria-label": "Ignored",
          "aria-labelledby": "elsewhere",
          "aria-checked": "mixed",
          indeterminate: true,
        },
        "Wi-Fi",
      ),
    );
    try {
      const label = boxNamed(view.host, "Wi-Fi");
      const input = inputNamed(view.host, "Wi-Fi");
      assert.equal(label.tagName, "LABEL");
      assert.equal(input.tagName, "INPUT");
      assert.equal(input.type, "checkbox");
      assert.equal(input.getAttribute("role"), "switch");
      assert.equal(input.id, "wifi");
      assert.equal(input.name, "connections");
      assert.equal(input.value, "wifi");
      assert.equal(label.className, "camellia-switch extra");
      assert.equal(label.getAttribute("data-state"), "off");
      assert.equal(input.checked, false);
      assert.notEqual(input.indeterminate, true);
      assert.equal(input.hasAttribute("aria-checked"), false);
      assert.equal(input.hasAttribute("aria-label"), false);
      assert.equal(input.hasAttribute("aria-labelledby"), false);
      assert.equal(label.querySelector(".camellia-switch-label").textContent, "Wi-Fi");
      assert.equal(label.querySelector(".camellia-switch-thumb").getAttribute("aria-hidden"), "true");
      assert.equal(label.querySelector("svg"), null);
      assert.equal(input.closest("label"), label);
    } finally {
      await view.unmount();
    }
  });

  test("an uncontrolled switch toggles on change and reports the next state", async () => {
    const changes = [];
    let seen = 0;
    const view = await mount(
      createElement(
        Switch,
        {
          defaultChecked: true,
          onCheckedChange: (next) => changes.push(next),
          onChange: () => { seen += 1; },
        },
        "Wi-Fi",
      ),
    );
    try {
      const label = boxNamed(view.host, "Wi-Fi");
      const input = inputNamed(view.host, "Wi-Fi");
      assert.equal(input.checked, true);
      assert.equal(label.getAttribute("data-state"), "on");
      assert.ok(label.querySelector(".camellia-switch-thumb"));
      await activate(input);
      assert.equal(input.checked, false);
      assert.equal(label.getAttribute("data-state"), "off");
      assert.deepEqual(changes, [false]);
      assert.equal(seen, 1);
      await activate(input);
      assert.equal(input.checked, true);
      assert.equal(label.getAttribute("data-state"), "on");
      assert.deepEqual(changes, [false, true]);
    } finally {
      await view.unmount();
    }
  });

  test("a controlled switch reports the next state and keeps the checked prop", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        Switch,
        { checked: false, defaultChecked: true, onCheckedChange: (next) => changes.push(next) },
        "Wi-Fi",
      ),
    );
    try {
      const input = inputNamed(view.host, "Wi-Fi");
      assert.equal(input.checked, false);
      assert.equal(boxNamed(view.host, "Wi-Fi").getAttribute("data-state"), "off");
      await activate(input);
      assert.deepEqual(changes, [true]);
      assert.equal(input.checked, false);
      assert.equal(boxNamed(view.host, "Wi-Fi").getAttribute("data-state"), "off");
    } finally {
      await view.unmount();
    }
  });

  test("a controlled parent updates on and off", async () => {
    function Harness() {
      const [value, setValue] = useState(false);
      return createElement(Switch, { checked: value, onCheckedChange: setValue }, "Wi-Fi");
    }
    const view = await mount(createElement(Harness));
    try {
      const input = inputNamed(view.host, "Wi-Fi");
      assert.equal(input.checked, false);
      await activate(input);
      assert.equal(input.checked, true);
      assert.equal(boxNamed(view.host, "Wi-Fi").getAttribute("data-state"), "on");
      await activate(input);
      assert.equal(input.checked, false);
      assert.equal(boxNamed(view.host, "Wi-Fi").getAttribute("data-state"), "off");
    } finally {
      await view.unmount();
    }
  });

  test("Space and Enter are left to the browser, and one change toggles once", async () => {
    const changes = [];
    const view = await mount(
      createElement(Switch, { onCheckedChange: (next) => changes.push(next) }, "Wi-Fi"),
    );
    try {
      const input = inputNamed(view.host, "Wi-Fi");
      const enter = pressKey(input, "Enter");
      const space = pressKey(input, " ");
      const enterUp = pressKey(input, "Enter", "keyup");
      const spaceUp = pressKey(input, " ", "keyup");
      assert.equal(enter.defaultPrevented, false);
      assert.equal(space.defaultPrevented, false);
      assert.equal(enterUp.defaultPrevented, false);
      assert.equal(spaceUp.defaultPrevented, false);
      assert.deepEqual(changes, []);
      await activate(input);
      assert.deepEqual(changes, [true]);
      await activate(input);
      assert.deepEqual(changes, [true, false]);
    } finally {
      await view.unmount();
    }
  });

  test("native disabled leaves the tab order and does not toggle", async () => {
    const changes = [];
    let seen = 0;
    const view = await mount(
      createElement(
        Switch,
        {
          disabled: true,
          defaultChecked: true,
          onCheckedChange: (next) => changes.push(next),
          onChange: () => { seen += 1; },
        },
        "Airplane mode",
      ),
    );
    try {
      const label = boxNamed(view.host, "Airplane mode");
      const input = inputNamed(view.host, "Airplane mode");
      assert.equal(input.hasAttribute("disabled"), true);
      assert.equal(label.classList.contains("camellia-switch-disabled"), true);
      assert.equal(input.checked, true);
      assert.equal(input.getAttribute("role"), "switch");
      input.focus();
      assert.notEqual(document.activeElement, input);
      await activate(input);
      assert.deepEqual(changes, []);
      assert.equal(seen, 0);
      assert.equal(input.checked, true);
      assert.equal(label.getAttribute("data-state"), "on");
    } finally {
      await view.unmount();
    }
  });

  test("the gallery is a labeled group, and only an enabled switch toggles", async () => {
    const view = await mount(createElement(SwitchDemo));
    try {
      const group = view.host.querySelector("fieldset");
      assert.equal(group.tagName, "FIELDSET");
      assert.equal(group.querySelector("legend").textContent, "Connections");
      assert.equal(inputNamed(view.host, "Wi-Fi").checked, true);
      assert.equal(inputNamed(view.host, "Wi-Fi").getAttribute("role"), "switch");
      assert.equal(boxNamed(view.host, "Wi-Fi").getAttribute("data-state"), "on");
      assert.equal(inputNamed(view.host, "Bluetooth").checked, false);
      assert.equal(boxNamed(view.host, "Bluetooth").getAttribute("data-state"), "off");
      const airplane = inputNamed(view.host, "Airplane mode");
      assert.equal(airplane.hasAttribute("disabled"), true);
      assert.equal(airplane.checked, false);
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Wi-Fi is on. Bluetooth is off. Airplane mode is off.",
      );
      await activate(inputNamed(view.host, "Bluetooth"));
      assert.equal(inputNamed(view.host, "Bluetooth").checked, true);
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Wi-Fi is on. Bluetooth is on. Airplane mode is off.",
      );
      await activate(inputNamed(view.host, "Wi-Fi"));
      await activate(airplane);
      assert.equal(inputNamed(view.host, "Wi-Fi").checked, false);
      assert.equal(airplane.checked, false);
      assert.equal(boxNamed(view.host, "Wi-Fi").querySelector(".camellia-switch-label").textContent, "Wi-Fi");
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Wi-Fi is off. Bluetooth is on. Airplane mode is off.",
      );
    } finally {
      await view.unmount();
    }
  });

  test("styles use tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/switch/Switch.css"), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
    assert.equal(/\d+px\b/.test(css), false);
    assert.equal(/\brgba?\(/.test(css), false);
    assert.equal(css.includes("--color-border-default"), false);
    assert.equal(css.includes("--color-border-strong"), false);
    assert.equal(css.includes("scale("), false);
    assert.equal(css.includes("--radius-sm"), false);
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 2);
    assert.match(hover.body, /\.camellia-switch-input:not\(:disabled\):hover \{\s*background: var\(--color-icon-primary\);/);
    assert.match(
      hover.body,
      /\.camellia-switch\[data-state='on'\] \.camellia-switch-input:not\(:disabled\):hover \{\s*background: var\(--color-action-primary-hover\);/,
    );
    assert.match(css, /\.camellia-switch-input:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-switch-input,\s*\.camellia-switch-thumb \{\s*transition: none;/);
    assert.match(css, /\.camellia-switch-input \{[\s\S]*transition-property: background-color, color, border-color, box-shadow;/);
    assert.match(css, /\.camellia-switch-thumb \{[\s\S]*transition-property: transform, background-color, color, border-color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.match(css, /width: var\(--size-control-lg\);/);
    assert.match(css, /height: var\(--size-control-sm\);/);
    assert.match(css, /width: var\(--size-icon-lg\);/);
    assert.match(css, /height: var\(--size-icon-lg\);/);
    assert.match(css, /border-radius: var\(--radius-full\);/);
    assert.match(css, /background: var\(--color-icon-secondary\);/);
    assert.match(css, /background: var\(--color-action-primary\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /font: var\(--label-md\);/);
    assert.match(css, /letter-spacing: var\(--label-md-letter-spacing\);/);
    assert.match(css, /gap: var\(--space-2\);/);
    assert.match(css, /color: var\(--color-text-primary\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
    assert.match(css, /inset-inline-start: var\(--space-1\);/);
    assert.match(css, /transform: translateX\(0\);/);
    assert.match(
      css,
      /transform: translateX\(calc\(var\(--size-control-lg\) - var\(--size-icon-lg\) - var\(--space-1\) - var\(--space-1\)\)\);/,
    );
    assert.match(css, /:dir\(rtl\)/);
  });
});
