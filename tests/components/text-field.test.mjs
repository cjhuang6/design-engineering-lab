import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let TextField;
let TextFieldDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "text-field-"));
  const outfile = join(dir, "TextField.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/text-field/TextField.jsx"],
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
  ({ TextField, TextFieldDemo } = await import(pathToFileURL(outfile).href));
});

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

function byLabel(host, name) {
  const label = [...host.querySelectorAll("label")].find((item) => item.textContent === name);
  assert.ok(label, name);
  const input = host.ownerDocument.getElementById(label.getAttribute("for"));
  assert.ok(input);
  return { label, input, root: label.closest(".camellia-text-field") };
}

function described(host, input) {
  const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return ids.map((id) => host.ownerDocument.getElementById(id));
}

function setNativeValue(node, text) {
  let proto = Object.getPrototypeOf(node);
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(node, text);
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
  node.value = text;
}

async function typeInto(input, text) {
  await act(async () => {
    input.dispatchEvent(new window.Event("focusin", { bubbles: true }));
    setNativeValue(input, text);
    if (input._valueTracker) input._valueTracker.setValue("previous");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("keyup", { bubbles: true }));
  });
}

function fieldProp(node, name) {
  const direct = node[name];
  if (direct != null && direct !== "") return String(direct);
  return node.getAttribute(name);
}

async function leave(input) {
  await act(async () => {
    input.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  });
}

async function submit(form) {
  let event;
  await act(async () => {
    event = new window.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
  });
  return event;
}

function emailError(value) {
  return value.includes("@") ? "" : "Enter an email address.";
}

function LateField({ withHint = true }) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState("idle");
  return createElement(
    "form",
    {
      onSubmit: (event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        setSent(value);
      },
    },
    createElement(TextField, {
      label: "Email",
      hint: withHint ? "Work address" : undefined,
      error: emailError(value),
      value,
      onChange: (event) => setValue(event.target.value),
    }),
    createElement("button", { type: "submit" }, "Send"),
    createElement("p", { className: "sent" }, sent),
  );
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

describe("text field", { concurrency: false }, () => {
  test("a missing, blank, or non-string label throws", async () => {
    await assert.rejects(() => mount(createElement(TextField)), /requires a label/);
    await assert.rejects(() => mount(createElement(TextField, { label: "  " })), /requires a label/);
    await assert.rejects(() => mount(createElement(TextField, { label: 1 })), /requires a label/);
  });

  test("the visible label is tied to the input by id", async () => {
    const view = await mount(createElement(TextField, { label: "Email", id: "email-id" }));
    try {
      const { label, input } = byLabel(view.host, "Email");
      assert.equal(input.tagName, "INPUT");
      assert.equal(input.getAttribute("role"), null);
      assert.equal(input.type, "text");
      assert.equal(input.id, "email-id");
      assert.equal(label.getAttribute("for"), "email-id");
      assert.equal(label.tagName, "LABEL");
      assert.equal(input.getAttribute("aria-invalid"), null);
    } finally {
      await view.unmount();
    }
  });

  test("hint and error are linked with describedby, and the error is a polite live region", async () => {
    const view = await mount(createElement(LateField));
    try {
      const { input } = byLabel(view.host, "Email");
      const error = view.host.querySelector(".camellia-text-field-error");
      assert.equal(error.getAttribute("aria-live"), "polite");
      assert.equal(error.textContent, "");
      const before = described(view.host, input);
      assert.equal(before.length, 1);
      assert.equal(before[0].textContent, "Work address");
      assert.equal(before[0].className, "camellia-text-field-hint");
      await typeInto(input, "nope");
      await leave(input);
      const after = described(view.host, input);
      assert.equal(after.length, 2);
      assert.equal(after[0].textContent, "Enter an email address.");
      assert.equal(after[0], view.host.querySelector(".camellia-text-field-error"));
      assert.equal(after[1].textContent, "Work address");
      assert.equal(input.getAttribute("aria-invalid"), "true");
    } finally {
      await view.unmount();
    }
  });

  test("a field with only an error omits the hint id", async () => {
    const view = await mount(createElement(LateField, { withHint: false }));
    try {
      const { input } = byLabel(view.host, "Email");
      assert.equal(input.getAttribute("aria-describedby"), null);
      await typeInto(input, "nope");
      await leave(input);
      const nodes = described(view.host, input);
      assert.equal(nodes.length, 1);
      assert.equal(nodes[0].textContent, "Enter an email address.");
    } finally {
      await view.unmount();
    }
  });

  test("late validation shows on blur and submit, clears as soon as the value is valid, and stays quiet on the next invalid keystroke", async () => {
    const view = await mount(createElement(LateField));
    try {
      const { input } = byLabel(view.host, "Email");
      const error = () => view.host.querySelector(".camellia-text-field-error").textContent;
      await typeInto(input, "n");
      await typeInto(input, "no");
      await typeInto(input, "nope");
      assert.equal(error(), "");
      assert.equal(input.getAttribute("aria-invalid"), null);
      await leave(input);
      assert.equal(error(), "Enter an email address.");
      assert.equal(input.getAttribute("aria-invalid"), "true");
      await typeInto(input, "no");
      assert.equal(error(), "Enter an email address.");
      await typeInto(input, "a@b.co");
      assert.equal(error(), "");
      assert.equal(input.getAttribute("aria-invalid"), null);
      await typeInto(input, "nope");
      assert.equal(error(), "");
      assert.equal(input.getAttribute("aria-invalid"), null);
      await leave(input);
      assert.equal(error(), "Enter an email address.");
      await typeInto(input, "a@b.co");
      assert.equal(error(), "");
      const form = view.host.querySelector("form");
      await typeInto(input, "nope");
      const blocked = await submit(form);
      assert.equal(blocked.defaultPrevented, true);
      assert.equal(error(), "Enter an email address.");
      assert.equal(view.host.querySelector(".sent").textContent, "idle");
      await typeInto(input, "a@b.co");
      const allowed = await submit(form);
      assert.equal(allowed.defaultPrevented, true);
      assert.equal(view.host.querySelector(".sent").textContent, "a@b.co");
      assert.equal(error(), "");
    } finally {
      await view.unmount();
    }
  });

  test("a native invalid event reveals the error and suppresses the browser tooltip", async () => {
    const view = await mount(createElement(LateField));
    try {
      const { input } = byLabel(view.host, "Email");
      let event;
      await act(async () => {
        event = new window.Event("invalid", { cancelable: true });
        input.dispatchEvent(event);
      });
      assert.equal(event.defaultPrevented, true);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "Enter an email address.");
      assert.equal(input.getAttribute("aria-invalid"), "true");
    } finally {
      await view.unmount();
    }
  });

  test("required marks the input, and an empty field uses the fallback until it has a value", async () => {
    const view = await mount(createElement(TextField, { label: "Name", required: true }));
    try {
      const { input } = byLabel(view.host, "Name");
      assert.equal(input.hasAttribute("required"), true);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
      await leave(input);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "Fill in this field.");
      assert.equal(input.getAttribute("aria-invalid"), "true");
      await typeInto(input, "A");
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
      assert.equal(input.getAttribute("aria-invalid"), null);
      assert.equal(input.value, "A");
    } finally {
      await view.unmount();
    }
  });

  test("a passed error replaces the required fallback", async () => {
    const view = await mount(
      createElement(TextField, { label: "Name", required: true, error: "Enter your name." }),
    );
    try {
      const { input } = byLabel(view.host, "Name");
      await leave(input);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "Enter your name.");
    } finally {
      await view.unmount();
    }
  });

  test("disabled sets the native attribute, dims the field, and does not reveal an error", async () => {
    const view = await mount(
      createElement(TextField, { label: "Company", disabled: true, required: true, error: "Enter a company.", defaultValue: "" }),
    );
    try {
      const { input, root } = byLabel(view.host, "Company");
      assert.equal(input.hasAttribute("disabled"), true);
      assert.equal(root.classList.contains("camellia-text-field-disabled"), true);
      input.focus();
      assert.notEqual(document.activeElement, input);
      await leave(input);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
      assert.equal(input.getAttribute("aria-invalid"), null);
      let event;
      await act(async () => {
        event = new window.Event("invalid", { cancelable: true });
        input.dispatchEvent(event);
      });
      assert.equal(event.defaultPrevented, false);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
    } finally {
      await view.unmount();
    }
  });

  test("sizes add the matching class, and an unknown size does not", async () => {
    const view = await mount(
      createElement(
        "div",
        null,
        createElement(TextField, { label: "Small", size: "sm" }),
        createElement(TextField, { label: "Medium", size: "md" }),
        createElement(TextField, { label: "Large", size: "lg" }),
        createElement(TextField, { label: "Other", size: "xl" }),
      ),
    );
    try {
      assert.equal(byLabel(view.host, "Small").root.classList.contains("camellia-text-field-sm"), true);
      assert.equal(byLabel(view.host, "Medium").root.classList.contains("camellia-text-field-md"), true);
      assert.equal(byLabel(view.host, "Large").root.classList.contains("camellia-text-field-lg"), true);
      const other = byLabel(view.host, "Other").root;
      assert.equal(other.className, "camellia-text-field");
    } finally {
      await view.unmount();
    }
  });

  test("other input attributes pass through, including a ref, and className stays on the field", async () => {
    const ref = { current: null };
    let changes = 0;
    const view = await mount(
      createElement(TextField, {
        label: "Email",
        name: "email",
        type: "email",
        placeholder: "name@example.com",
        autoComplete: "email",
        maxLength: 40,
        inputMode: "email",
        readOnly: true,
        className: "extra",
        "data-track": "email",
        "aria-invalid": "false",
        ref,
        onChange: () => {
          changes += 1;
        },
      }),
    );
    try {
      const { input, root } = byLabel(view.host, "Email");
      assert.equal(fieldProp(input, "name"), "email");
      assert.equal(input.type, "email");
      assert.equal(fieldProp(input, "placeholder"), "name@example.com");
      assert.equal(fieldProp(input, "autoComplete") ?? fieldProp(input, "autocomplete"), "email");
      assert.equal(fieldProp(input, "maxLength") ?? input.getAttribute("maxlength"), "40");
      assert.equal(fieldProp(input, "inputMode") ?? input.getAttribute("inputmode"), "email");
      assert.equal(input.readOnly === true || input.hasAttribute("readonly"), true);
      assert.equal(input.getAttribute("data-track"), "email");
      assert.equal(input.getAttribute("aria-invalid"), null);
      assert.equal(root.className, "camellia-text-field camellia-text-field-md extra");
      assert.equal(input.className, "camellia-text-field-input");
      assert.equal(ref.current, input);
      await typeInto(input, "a@b.co");
      assert.equal(changes, 1);
    } finally {
      await view.unmount();
    }
  });

  test("uncontrolled defaultValue stays editable", async () => {
    const view = await mount(createElement(TextField, { label: "Name", defaultValue: "Ada" }));
    try {
      const { input } = byLabel(view.host, "Name");
      assert.equal(input.value, "Ada");
      await typeInto(input, "Ada Lovelace");
      assert.equal(input.value, "Ada Lovelace");
    } finally {
      await view.unmount();
    }
  });

  test("the gallery shows the email example, the three sizes, and a disabled field", async () => {
    const view = await mount(createElement(TextFieldDemo));
    try {
      const { input } = byLabel(view.host, "Email");
      assert.equal(input.type, "email");
      assert.equal(fieldProp(input, "placeholder"), "name@example.com");
      assert.equal(input.hasAttribute("required"), true);
      assert.equal(view.host.querySelector(".camellia-text-field-hint").textContent, "We'll reply to this address.");
      assert.equal(view.host.querySelector("[aria-live='polite'].note").textContent, "Nothing sent.");
      await typeInto(input, "nope");
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
      const blocked = await submit(view.host.querySelector("form"));
      assert.equal(blocked.defaultPrevented, true);
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "Enter an email address.");
      assert.equal(view.host.querySelector("[aria-live='polite'].note").textContent, "Nothing sent.");
      await typeInto(input, "ada@example.com");
      assert.equal(view.host.querySelector(".camellia-text-field-error").textContent, "");
      await submit(view.host.querySelector("form"));
      assert.equal(view.host.querySelector("[aria-live='polite'].note").textContent, "Sent to ada@example.com.");
      assert.equal(byLabel(view.host, "Small").root.classList.contains("camellia-text-field-sm"), true);
      assert.equal(byLabel(view.host, "Medium").root.classList.contains("camellia-text-field-md"), true);
      assert.equal(byLabel(view.host, "Large").root.classList.contains("camellia-text-field-lg"), true);
      const company = byLabel(view.host, "Company");
      assert.equal(company.input.hasAttribute("disabled"), true);
      assert.equal(company.input.value, "Camellia");
    } finally {
      await view.unmount();
    }
  });

  test("styles use the field tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/text-field/TextField.css"), "utf8");
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.match(hover.body, /border-color: var\(--color-border-strong\);/);
    assert.equal(hover.body.includes("--feedback-error"), false);
    assert.match(css, /\.camellia-text-field-input:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{\s*\.camellia-text-field-control \{\s*min-height: var\(--size-touch-target\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-text-field-input \{\s*transition: none;/);
    assert.match(css, /transition-property: color, border-color, box-shadow;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.equal(css.includes("scale("), false);
    assert.equal(css.includes("--color-action-primary"), false);
    assert.match(css, /\.camellia-text-field-sm \.camellia-text-field-input \{\s*height: var\(--size-control-sm\);\s*padding-inline: var\(--control-padding-inline-sm\);/);
    assert.match(css, /\.camellia-text-field-md \.camellia-text-field-input \{\s*height: var\(--size-control-md\);\s*padding-inline: var\(--control-padding-inline-md\);/);
    assert.match(css, /\.camellia-text-field-lg \.camellia-text-field-input \{\s*height: var\(--size-control-lg\);\s*padding-inline: var\(--control-padding-inline-lg\);/);
    assert.match(css, /padding-block: var\(--space-0\);/);
    assert.match(css, /border-radius: var\(--radius-md\);/);
    assert.match(css, /border-color: var\(--color-border-default\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /color: var\(--color-text-primary\);/);
    assert.match(css, /font: var\(--body-md\);/);
    assert.match(css, /font: var\(--label-sm\);/);
    assert.match(css, /color: var\(--color-text-placeholder\);/);
    assert.match(css, /opacity: var\(--opacity-full\);/);
    assert.match(css, /\.camellia-text-field-input\[aria-invalid='true'\] \{\s*border-color: var\(--feedback-error\);/);
    assert.match(css, /\.camellia-text-field-error \{\s*color: var\(--feedback-error\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
  });
});
