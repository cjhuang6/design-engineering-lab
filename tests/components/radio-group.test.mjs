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

let Radio;
let RadioGroup;
let RadioGroupDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "radio-group-"));
  const outfile = join(dir, "RadioGroup.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/radio-group/RadioGroup.jsx"],
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
  ({ Radio, RadioGroup, RadioGroupDemo } = await import(pathToFileURL(outfile).href));
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

function groupNamed(host, name) {
  return [...host.querySelectorAll("fieldset")].find(
    (item) => item.querySelector("legend")?.textContent === name,
  );
}

function optionNamed(host, name) {
  return [...host.querySelectorAll("label")].find(
    (item) => item.querySelector(".camellia-radio-label")?.textContent === name,
  );
}

function inputNamed(host, name) {
  return optionNamed(host, name)?.querySelector("input");
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

function shipping(props, radios) {
  return createElement(
    RadioGroup,
    { legend: "Shipping", name: "shipping", ...props },
    ...(radios ?? [
      createElement(Radio, { value: "standard" }, "Standard"),
      createElement(Radio, { value: "express" }, "Express"),
      createElement(Radio, { value: "pickup", disabled: true }, "Pickup"),
    ]),
  );
}

describe("radio group", { concurrency: false }, () => {
  test("a missing, blank, or non-string legend throws", async () => {
    await assert.rejects(
      () => mount(createElement(RadioGroup, { name: "shipping" }, createElement(Radio, { value: "standard" }, "Standard"))),
      /requires a visible legend/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "  ", name: "shipping" }, createElement(Radio, { value: "standard" }, "Standard"))),
      /requires a visible legend/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: 1, name: "shipping" }, createElement(Radio, { value: "standard" }, "Standard"))),
      /requires a visible legend/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", label: "Delivery", name: "shipping" }, createElement(Radio, { value: "standard" }, "Standard"))),
      /takes one visible legend/,
    );
  });

  test("a missing or blank name throws", async () => {
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping" }, createElement(Radio, { value: "standard" }, "Standard"))),
      /requires a name/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "  " }, createElement(Radio, { value: "standard" }, "Standard"))),
      /requires a name/,
    );
  });

  test("a value other than a non-empty string or null throws", async () => {
    await assert.rejects(() => mount(shipping({ value: "" })), /must be a non-empty string/);
    await assert.rejects(() => mount(shipping({ value: 1 })), /must be a non-empty string/);
    await assert.rejects(() => mount(shipping({ defaultValue: "  " })), /must be a non-empty string/);
  });

  test("options and children are required, exclusive, and well formed", async () => {
    await assert.rejects(() => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping" })), /requires options or Radio children/);
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping", options: [] })),
      /requires options or Radio children/,
    );
    await assert.rejects(
      () => mount(shipping({ options: [{ value: "standard", label: "Standard" }] })),
      /not both/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping", options: "standard" })),
      /options must be an array/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping", options: [{ value: "standard", label: "  " }] })),
      /option requires a visible label/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping", options: [{ value: "", label: "Standard" }] })),
      /option requires a value/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, {
        legend: "Shipping",
        name: "shipping",
        options: [
          { value: "standard", label: "Standard" },
          { value: "standard", label: "Again" },
        ],
      })),
      /values must be unique/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping" }, createElement("div", null, "Standard"))),
      /children must be Radio elements/,
    );
    await assert.rejects(
      () => mount(createElement(
        RadioGroup,
        { legend: "Shipping", name: "shipping" },
        createElement(Radio, { value: "standard" }, "Standard"),
        createElement(Radio, { value: "standard" }, "Again"),
      )),
      /values must be unique/,
    );
  });

  test("a radio outside the group, or without a label or value, throws", async () => {
    await assert.rejects(() => mount(createElement(Radio, { value: "standard" }, "Standard")), /inside a RadioGroup/);
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping" }, createElement(Radio, { value: "standard" }, "  "))),
      /requires a visible label/,
    );
    await assert.rejects(
      () => mount(createElement(RadioGroup, { legend: "Shipping", name: "shipping" }, createElement(Radio, { value: "" }, "Standard"))),
      /requires a value/,
    );
  });

  test("a native group starts with nothing selected", async () => {
    const view = await mount(shipping({
      className: "extra",
      id: "ship",
      role: "radiogroup",
      "aria-label": "Ignored",
      "aria-labelledby": "elsewhere",
    }));
    try {
      const group = groupNamed(view.host, "Shipping");
      const standard = optionNamed(view.host, "Standard");
      const input = inputNamed(view.host, "Standard");
      assert.equal(group.tagName, "FIELDSET");
      assert.equal(group.id, "ship");
      assert.equal(group.className, "camellia-radio-group extra");
      assert.equal(group.getAttribute("role"), null);
      assert.equal(group.hasAttribute("aria-label"), false);
      assert.equal(group.hasAttribute("aria-labelledby"), false);
      assert.equal(group.querySelector("legend").textContent, "Shipping");
      assert.equal(standard.tagName, "LABEL");
      assert.equal(input.tagName, "INPUT");
      assert.equal(input.type, "radio");
      assert.equal(input.getAttribute("role"), null);
      assert.equal(input.name, "shipping");
      assert.equal(input.value, "standard");
      assert.equal(input.checked, false);
      assert.equal(input.hasAttribute("aria-checked"), false);
      assert.equal(input.hasAttribute("aria-label"), false);
      assert.equal(standard.getAttribute("data-state"), "unchecked");
      assert.equal(standard.querySelector(".camellia-radio-dot"), null);
      assert.equal(standard.querySelector(".camellia-radio-glyph").getAttribute("aria-hidden"), "true");
      assert.equal(input.closest("label"), standard);
      assert.equal(inputNamed(view.host, "Express").name, "shipping");
      assert.equal(inputNamed(view.host, "Express").checked, false);
      assert.equal(inputNamed(view.host, "Pickup").checked, false);
      const names = [...group.querySelectorAll("input")].map((item) => item.name);
      assert.deepEqual(names, ["shipping", "shipping", "shipping"]);
    } finally {
      await view.unmount();
    }
  });

  test("label is the legend when legend is omitted", async () => {
    const view = await mount(createElement(
      RadioGroup,
      { label: "Shipping", name: "shipping" },
      createElement(Radio, { value: "standard", id: "standard", name: "other", type: "checkbox", "aria-label": "Ignored", "aria-checked": "true" }, "Standard"),
    ));
    try {
      const input = inputNamed(view.host, "Standard");
      assert.equal(groupNamed(view.host, "Shipping").querySelector("legend").textContent, "Shipping");
      assert.equal(input.id, "standard");
      assert.equal(input.type, "radio");
      assert.equal(input.name, "shipping");
      assert.equal(input.hasAttribute("aria-label"), false);
      assert.equal(input.hasAttribute("aria-checked"), false);
    } finally {
      await view.unmount();
    }
  });

  test("an uncontrolled group selects one option and leaves the others clear", async () => {
    const changes = [];
    let seen = 0;
    const view = await mount(shipping({
      defaultValue: "standard",
      onValueChange: (next) => changes.push(next),
    }, [
      createElement(Radio, { value: "standard", onChange: () => { seen += 1; } }, "Standard"),
      createElement(Radio, { value: "express", onChange: () => { seen += 1; } }, "Express"),
    ]));
    try {
      assert.equal(inputNamed(view.host, "Standard").checked, true);
      assert.equal(optionNamed(view.host, "Standard").getAttribute("data-state"), "checked");
      assert.ok(optionNamed(view.host, "Standard").querySelector(".camellia-radio-dot"));
      assert.equal(inputNamed(view.host, "Express").checked, false);
      assert.equal(optionNamed(view.host, "Express").querySelector(".camellia-radio-dot"), null);
      await activate(inputNamed(view.host, "Standard"));
      assert.deepEqual(changes, []);
      assert.equal(seen, 0);
      assert.equal(inputNamed(view.host, "Standard").checked, true);
      await activate(inputNamed(view.host, "Express"));
      assert.deepEqual(changes, ["express"]);
      assert.equal(seen, 1);
      assert.equal(inputNamed(view.host, "Express").checked, true);
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      assert.equal(optionNamed(view.host, "Express").getAttribute("data-state"), "checked");
      assert.equal(optionNamed(view.host, "Standard").querySelector(".camellia-radio-dot"), null);
    } finally {
      await view.unmount();
    }
  });

  test("an empty uncontrolled group stays empty until an option is chosen", async () => {
    const changes = [];
    const view = await mount(shipping({ onValueChange: (next) => changes.push(next) }));
    try {
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      await activate(inputNamed(view.host, "Express"));
      assert.deepEqual(changes, ["express"]);
      assert.equal(inputNamed(view.host, "Express").checked, true);
      assert.equal(inputNamed(view.host, "Standard").checked, false);
    } finally {
      await view.unmount();
    }
  });

  test("a controlled group reports the next value and keeps the value prop", async () => {
    const changes = [];
    const view = await mount(shipping({
      value: null,
      defaultValue: "standard",
      onValueChange: (next) => changes.push(next),
    }));
    try {
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      await activate(inputNamed(view.host, "Standard"));
      assert.deepEqual(changes, ["standard"]);
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      assert.equal(optionNamed(view.host, "Standard").getAttribute("data-state"), "unchecked");
    } finally {
      await view.unmount();
    }
  });

  test("a controlled parent updates the selected option", async () => {
    function Harness() {
      const [current, setCurrent] = useState(null);
      return createElement(
        RadioGroup,
        { legend: "Shipping", name: "shipping", value: current, onValueChange: setCurrent },
        createElement(Radio, { value: "standard" }, "Standard"),
        createElement(Radio, { value: "express" }, "Express"),
      );
    }
    const view = await mount(createElement(Harness));
    try {
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      await activate(inputNamed(view.host, "Express"));
      assert.equal(inputNamed(view.host, "Express").checked, true);
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      await activate(inputNamed(view.host, "Standard"));
      assert.equal(inputNamed(view.host, "Standard").checked, true);
      assert.equal(inputNamed(view.host, "Express").checked, false);
    } finally {
      await view.unmount();
    }
  });

  test("options render the same native group", async () => {
    const changes = [];
    const view = await mount(createElement(RadioGroup, {
      legend: "Shipping",
      name: "shipping",
      options: [
        { value: "standard", label: "Standard" },
        { value: "express", label: "Express" },
        { value: "pickup", label: "Pickup", disabled: true },
      ],
      onValueChange: (next) => changes.push(next),
    }));
    try {
      assert.equal(inputNamed(view.host, "Pickup").hasAttribute("disabled"), true);
      assert.equal(optionNamed(view.host, "Pickup").classList.contains("camellia-radio-disabled"), true);
      await activate(inputNamed(view.host, "Standard"));
      assert.deepEqual(changes, ["standard"]);
      assert.equal(inputNamed(view.host, "Standard").checked, true);
      await activate(inputNamed(view.host, "Pickup"));
      assert.deepEqual(changes, ["standard"]);
      assert.equal(inputNamed(view.host, "Pickup").checked, false);
    } finally {
      await view.unmount();
    }
  });

  test("a disabled group leaves the tab order and does not select", async () => {
    const changes = [];
    let seen = 0;
    const view = await mount(shipping({
      disabled: true,
      defaultValue: "standard",
      onValueChange: (next) => changes.push(next),
    }, [
      createElement(Radio, { value: "standard", onChange: () => { seen += 1; } }, "Standard"),
      createElement(Radio, { value: "express", onChange: () => { seen += 1; } }, "Express"),
    ]));
    try {
      const group = groupNamed(view.host, "Shipping");
      const express = inputNamed(view.host, "Express");
      assert.equal(group.hasAttribute("disabled"), true);
      assert.equal(group.classList.contains("camellia-radio-group-disabled"), true);
      assert.equal(express.hasAttribute("disabled"), true);
      assert.equal(optionNamed(view.host, "Express").classList.contains("camellia-radio-disabled"), false);
      assert.equal(inputNamed(view.host, "Standard").checked, true);
      express.focus();
      assert.notEqual(document.activeElement, express);
      await activate(express);
      assert.deepEqual(changes, []);
      assert.equal(seen, 0);
      assert.equal(express.checked, false);
      assert.equal(inputNamed(view.host, "Standard").checked, true);
    } finally {
      await view.unmount();
    }
  });

  test("a disabled option does not select, and the others still do", async () => {
    const changes = [];
    const view = await mount(shipping({ onValueChange: (next) => changes.push(next) }));
    try {
      const pickup = inputNamed(view.host, "Pickup");
      assert.equal(pickup.hasAttribute("disabled"), true);
      assert.equal(optionNamed(view.host, "Pickup").classList.contains("camellia-radio-disabled"), true);
      pickup.focus();
      assert.notEqual(document.activeElement, pickup);
      await activate(pickup);
      assert.deepEqual(changes, []);
      assert.equal(pickup.checked, false);
      await activate(inputNamed(view.host, "Standard"));
      assert.deepEqual(changes, ["standard"]);
      assert.equal(inputNamed(view.host, "Standard").checked, true);
    } finally {
      await view.unmount();
    }
  });

  test("arrow keys, Space, and Enter are left to the browser", async () => {
    const changes = [];
    const view = await mount(shipping({ onValueChange: (next) => changes.push(next) }));
    try {
      const standard = inputNamed(view.host, "Standard");
      const down = pressKey(standard, "ArrowDown");
      const up = pressKey(standard, "ArrowUp");
      const right = pressKey(standard, "ArrowRight");
      const left = pressKey(standard, "ArrowLeft");
      const space = pressKey(standard, " ");
      const enter = pressKey(standard, "Enter");
      assert.equal(down.defaultPrevented, false);
      assert.equal(up.defaultPrevented, false);
      assert.equal(right.defaultPrevented, false);
      assert.equal(left.defaultPrevented, false);
      assert.equal(space.defaultPrevented, false);
      assert.equal(enter.defaultPrevented, false);
      assert.deepEqual(changes, []);
      assert.equal(standard.checked, false);
      assert.equal(inputNamed(view.host, "Express").checked, false);
    } finally {
      await view.unmount();
    }
  });

  test("the gallery starts empty, selects one option, and shows a disabled group", async () => {
    const view = await mount(createElement(RadioGroupDemo));
    try {
      const shippingGroup = groupNamed(view.host, "Shipping");
      const gift = groupNamed(view.host, "Gift wrap");
      assert.equal(shippingGroup.tagName, "FIELDSET");
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      assert.equal(inputNamed(view.host, "Express").checked, false);
      assert.equal(inputNamed(view.host, "Pickup").hasAttribute("disabled"), true);
      assert.equal(inputNamed(view.host, "Pickup").checked, false);
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Nothing selected.");
      assert.equal(gift.hasAttribute("disabled"), true);
      assert.equal(gift.classList.contains("camellia-radio-group-disabled"), true);
      assert.equal(inputNamed(view.host, "None").checked, true);
      assert.equal(inputNamed(view.host, "None").hasAttribute("disabled"), true);
      assert.ok(optionNamed(view.host, "None").querySelector(".camellia-radio-dot"));
      assert.equal(inputNamed(view.host, "Box").checked, false);
      await activate(inputNamed(view.host, "Express"));
      assert.equal(inputNamed(view.host, "Express").checked, true);
      assert.equal(inputNamed(view.host, "Standard").checked, false);
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Selected Express.");
      await activate(inputNamed(view.host, "Pickup"));
      await activate(inputNamed(view.host, "None"));
      assert.equal(inputNamed(view.host, "Pickup").checked, false);
      assert.equal(inputNamed(view.host, "None").checked, true);
      assert.equal(inputNamed(view.host, "Express").checked, true);
      assert.equal(view.host.querySelector("[aria-live='polite']").textContent, "Selected Express.");
    } finally {
      await view.unmount();
    }
  });

  test("styles use tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/radio-group/RadioGroup.css"), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
    assert.equal(/\d+px\b/.test(css), false);
    assert.equal(/\brgba?\(/.test(css), false);
    assert.equal(css.includes("color-border-default"), false);
    assert.equal(css.includes("scale("), false);
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 3);
    assert.match(hover.body, /\.camellia-radio-input:not\(:disabled\):hover \{\s*border-color: var\(--color-icon-primary\);/);
    assert.match(
      hover.body,
      /\.camellia-radio\[data-state='checked'\] \.camellia-radio-input:not\(:disabled\):hover \{\s*border-color: var\(--color-action-primary-hover\);/,
    );
    assert.match(css, /\.camellia-radio-input:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-radio-input,\s*\.camellia-radio-glyph \{\s*transition: none;/);
    assert.match(css, /transition-property: background-color, color, border-color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.match(css, /width: var\(--size-icon-md\);/);
    assert.match(css, /height: var\(--size-icon-md\);/);
    assert.match(css, /width: var\(--space-2\);/);
    assert.match(css, /height: var\(--space-2\);/);
    assert.match(css, /font: var\(--label-md\);/);
    assert.match(css, /letter-spacing: var\(--label-md-letter-spacing\);/);
    assert.match(css, /gap: var\(--space-2\);/);
    assert.match(css, /border-width: var\(--border-width-1\);/);
    assert.match(css, /border-color: var\(--color-icon-secondary\);/);
    assert.match(css, /border-radius: var\(--radius-full\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /color: var\(--color-text-primary\);/);
    assert.match(css, /border-color: var\(--color-action-primary\);/);
    assert.match(css, /color: var\(--color-action-primary\);/);
    assert.match(css, /background: currentColor;/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
    assert.equal(/background:\s*var\(--color-action-primary\)/.test(css), false);
  });
});
