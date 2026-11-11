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

let Checkbox;
let CheckboxDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "checkbox-"));
  const outfile = join(dir, "Checkbox.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/checkbox/Checkbox.jsx"],
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
  ({ Checkbox, CheckboxDemo } = await import(pathToFileURL(outfile).href));
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
    (item) => item.querySelector(".camellia-checkbox-label")?.textContent === name,
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

describe("checkbox", { concurrency: false }, () => {
  test("a missing, blank, or non-string label throws", async () => {
    await assert.rejects(() => mount(createElement(Checkbox)), /requires a visible label/);
    await assert.rejects(() => mount(createElement(Checkbox, null, "  ")), /requires a visible label/);
    await assert.rejects(() => mount(createElement(Checkbox, null, 1)), /requires a visible label/);
  });

  test("a state other than true, false, or mixed throws", async () => {
    await assert.rejects(
      () => mount(createElement(Checkbox, { checked: "yes" }, "Email")),
      /must be true, false, or "mixed"/,
    );
    await assert.rejects(
      () => mount(createElement(Checkbox, { defaultChecked: 1 }, "Email")),
      /must be true, false, or "mixed"/,
    );
  });

  test("a native checkbox takes its name from the label and starts unchecked", async () => {
    const view = await mount(
      createElement(
        Checkbox,
        {
          className: "extra",
          id: "email",
          name: "notify",
          value: "email",
          "aria-label": "Ignored",
          "aria-labelledby": "elsewhere",
          "aria-checked": "mixed",
          indeterminate: true,
          type: "radio",
        },
        "Email",
      ),
    );
    try {
      const label = boxNamed(view.host, "Email");
      const input = inputNamed(view.host, "Email");
      assert.equal(label.tagName, "LABEL");
      assert.equal(input.tagName, "INPUT");
      assert.equal(input.type, "checkbox");
      assert.equal(input.getAttribute("role"), null);
      assert.equal(input.id, "email");
      assert.equal(input.name, "notify");
      assert.equal(input.value, "email");
      assert.equal(label.className, "camellia-checkbox extra");
      assert.equal(label.getAttribute("data-state"), "unchecked");
      assert.equal(input.checked, false);
      assert.equal(input.indeterminate, false);
      assert.equal(input.hasAttribute("aria-checked"), false);
      assert.equal(input.hasAttribute("aria-label"), false);
      assert.equal(input.hasAttribute("aria-labelledby"), false);
      assert.equal(label.querySelector(".camellia-checkbox-label").textContent, "Email");
      assert.equal(label.querySelector(".camellia-checkbox-glyph").getAttribute("aria-hidden"), "true");
      assert.equal(label.querySelector(".camellia-checkbox-check"), null);
      assert.equal(label.querySelector(".camellia-checkbox-dash"), null);
      assert.equal(input.closest("label"), label);
    } finally {
      await view.unmount();
    }
  });

  test("an uncontrolled checkbox toggles on change and reports the next state", async () => {
    const changes = [];
    let seen = 0;
    const view = await mount(
      createElement(
        Checkbox,
        {
          defaultChecked: true,
          onCheckedChange: (next) => changes.push(next),
          onChange: () => { seen += 1; },
        },
        "Email",
      ),
    );
    try {
      const label = boxNamed(view.host, "Email");
      const input = inputNamed(view.host, "Email");
      assert.equal(input.checked, true);
      assert.equal(input.indeterminate, false);
      assert.equal(label.getAttribute("data-state"), "checked");
      assert.ok(label.querySelector(".camellia-checkbox-check"));
      await activate(input);
      assert.equal(input.checked, false);
      assert.equal(label.getAttribute("data-state"), "unchecked");
      assert.equal(label.querySelector(".camellia-checkbox-check"), null);
      assert.deepEqual(changes, [false]);
      assert.equal(seen, 1);
      await activate(input);
      assert.equal(input.checked, true);
      assert.deepEqual(changes, [false, true]);
    } finally {
      await view.unmount();
    }
  });

  test("an uncontrolled mixed checkbox shows a dash and moves to checked", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        Checkbox,
        { defaultChecked: "mixed", onCheckedChange: (next) => changes.push(next) },
        "Some devices",
      ),
    );
    try {
      const label = boxNamed(view.host, "Some devices");
      const input = inputNamed(view.host, "Some devices");
      assert.equal(label.getAttribute("data-state"), "mixed");
      assert.equal(input.checked, false);
      assert.equal(input.indeterminate, true);
      assert.equal(input.hasAttribute("aria-checked"), false);
      assert.ok(label.querySelector(".camellia-checkbox-dash"));
      assert.equal(label.querySelector(".camellia-checkbox-check"), null);
      assert.equal(label.querySelector(".camellia-checkbox-glyph").getAttribute("aria-hidden"), "true");
      await activate(input);
      assert.deepEqual(changes, [true]);
      assert.equal(input.checked, true);
      assert.equal(input.indeterminate, false);
      assert.equal(label.getAttribute("data-state"), "checked");
      assert.ok(label.querySelector(".camellia-checkbox-check"));
      assert.equal(label.querySelector(".camellia-checkbox-dash"), null);
    } finally {
      await view.unmount();
    }
  });

  test("a controlled checkbox reports the next state and keeps the checked prop", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        Checkbox,
        { checked: false, defaultChecked: true, onCheckedChange: (next) => changes.push(next) },
        "Email",
      ),
    );
    try {
      const input = inputNamed(view.host, "Email");
      assert.equal(input.checked, false);
      assert.equal(input.indeterminate, false);
      await activate(input);
      assert.deepEqual(changes, [true]);
      assert.equal(input.checked, false);
      assert.equal(boxNamed(view.host, "Email").getAttribute("data-state"), "unchecked");
    } finally {
      await view.unmount();
    }
  });

  test("a controlled mixed checkbox reports checked and stays mixed until the prop changes", async () => {
    const changes = [];
    const view = await mount(
      createElement(
        Checkbox,
        { checked: "mixed", defaultChecked: false, onCheckedChange: (next) => changes.push(next) },
        "Some devices",
      ),
    );
    try {
      const input = inputNamed(view.host, "Some devices");
      assert.equal(input.indeterminate, true);
      assert.equal(input.checked, false);
      await activate(input);
      assert.deepEqual(changes, [true]);
      assert.equal(input.indeterminate, true);
      assert.equal(input.checked, false);
      assert.ok(boxNamed(view.host, "Some devices").querySelector(".camellia-checkbox-dash"));
    } finally {
      await view.unmount();
    }
  });

  test("a controlled parent updates checked and mixed", async () => {
    function Harness() {
      const [value, setValue] = useState("mixed");
      return createElement(Checkbox, { checked: value, onCheckedChange: setValue }, "Some devices");
    }
    const view = await mount(createElement(Harness));
    try {
      const input = inputNamed(view.host, "Some devices");
      assert.equal(input.indeterminate, true);
      await activate(input);
      assert.equal(input.checked, true);
      assert.equal(input.indeterminate, false);
      assert.equal(boxNamed(view.host, "Some devices").getAttribute("data-state"), "checked");
      await activate(input);
      assert.equal(input.checked, false);
      assert.equal(input.indeterminate, false);
      assert.equal(boxNamed(view.host, "Some devices").getAttribute("data-state"), "unchecked");
    } finally {
      await view.unmount();
    }
  });

  test("Space and Enter are left to the browser, and one change toggles once", async () => {
    const changes = [];
    const view = await mount(
      createElement(Checkbox, { onCheckedChange: (next) => changes.push(next) }, "Email"),
    );
    try {
      const input = inputNamed(view.host, "Email");
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
        Checkbox,
        {
          disabled: true,
          defaultChecked: true,
          onCheckedChange: (next) => changes.push(next),
          onChange: () => { seen += 1; },
        },
        "SMS",
      ),
    );
    try {
      const label = boxNamed(view.host, "SMS");
      const input = inputNamed(view.host, "SMS");
      assert.equal(input.hasAttribute("disabled"), true);
      assert.equal(label.classList.contains("camellia-checkbox-disabled"), true);
      assert.equal(input.checked, true);
      input.focus();
      assert.notEqual(document.activeElement, input);
      await activate(input);
      assert.deepEqual(changes, []);
      assert.equal(seen, 0);
      assert.equal(input.checked, true);
      assert.equal(label.getAttribute("data-state"), "checked");
    } finally {
      await view.unmount();
    }
  });

  test("the gallery is a labeled group, and mixed moves to checked", async () => {
    const view = await mount(createElement(CheckboxDemo));
    try {
      const group = view.host.querySelector("fieldset");
      assert.equal(group.tagName, "FIELDSET");
      assert.equal(group.querySelector("legend").textContent, "Notifications");
      assert.equal(inputNamed(view.host, "Email").checked, true);
      assert.equal(inputNamed(view.host, "Email").indeterminate, false);
      assert.equal(inputNamed(view.host, "Push").checked, false);
      assert.equal(inputNamed(view.host, "Some devices").indeterminate, true);
      assert.ok(boxNamed(view.host, "Some devices").querySelector(".camellia-checkbox-dash"));
      const sms = inputNamed(view.host, "SMS");
      assert.equal(sms.hasAttribute("disabled"), true);
      assert.equal(sms.checked, false);
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Email is on. Push is off. Some devices is mixed. SMS is off.",
      );
      await activate(inputNamed(view.host, "Some devices"));
      assert.equal(inputNamed(view.host, "Some devices").checked, true);
      assert.equal(inputNamed(view.host, "Some devices").indeterminate, false);
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Email is on. Push is off. Some devices is on. SMS is off.",
      );
      await activate(inputNamed(view.host, "Email"));
      await activate(sms);
      assert.equal(inputNamed(view.host, "Email").checked, false);
      assert.equal(sms.checked, false);
      assert.equal(
        view.host.querySelector("[aria-live='polite']").textContent,
        "Email is off. Push is off. Some devices is on. SMS is off.",
      );
    } finally {
      await view.unmount();
    }
  });

  test("styles use tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/checkbox/Checkbox.css"), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
    assert.equal(/\d+px\b/.test(css), false);
    assert.equal(/\brgba?\(/.test(css), false);
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 3);
    assert.match(hover.body, /\.camellia-checkbox-input:not\(:disabled\):hover \{\s*border-color: var\(--color-icon-primary\);/);
    assert.match(
      hover.body,
      /\.camellia-checkbox\[data-state='checked'\] \.camellia-checkbox-input:not\(:disabled\):hover,[\s\S]*border-color: var\(--color-action-primary-hover\);[\s\S]*background: var\(--color-action-primary-hover\);/,
    );
    assert.match(css, /\.camellia-checkbox-input:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-checkbox-input \{\s*transition: none;/);
    assert.match(css, /transition-property: background-color, color, border-color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.equal(css.includes("scale("), false);
    assert.match(css, /width: var\(--size-icon-md\);/);
    assert.match(css, /height: var\(--size-icon-md\);/);
    assert.match(css, /font: var\(--label-md\);/);
    assert.match(css, /letter-spacing: var\(--label-md-letter-spacing\);/);
    assert.match(css, /gap: var\(--space-2\);/);
    assert.match(css, /border-width: var\(--border-width-1\);/);
    assert.match(css, /border-color: var\(--color-icon-secondary\);/);
    assert.match(css, /border-radius: var\(--radius-sm\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /color: var\(--color-text-primary\);/);
    assert.match(css, /border-color: var\(--color-action-primary\);/);
    assert.match(css, /background: var\(--color-action-primary\);/);
    assert.match(css, /color: var\(--color-action-primary-text\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
  });
});
