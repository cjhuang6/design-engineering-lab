import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement, useState } from "react";
import { act } from "react";
import { initialFeedback } from "../../src/components/guide-feedback/model.js";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let GuideFeedback;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "guide-feedback-"));
  const outfile = join(dir, "GuideFeedback.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/guide-feedback/GuideFeedback.jsx"],
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
  ({ GuideFeedback } = await import(pathToFileURL(outfile).href));
});

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(GuideFeedback));
  });
  return {
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function segment(rating) {
  return document.querySelector(`[data-rating="${rating}"]`);
}

function fillOf(rating) {
  return segment(rating).querySelector(".guide-feedback-fill");
}

function buttonNamed(name) {
  return [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === name);
}

function field() {
  return document.querySelector("textarea");
}

function pressKey(target, key, extras = {}) {
  target.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, key, ...extras }));
}

async function chooseRating(rating) {
  await act(async () => {
    pressKey(segment(1), String(rating));
  });
}

async function focusField() {
  await act(async () => {
    field().dispatchEvent(new window.Event("focusin", { bubbles: true }));
  });
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

async function typeComment(text) {
  const input = field();
  await focusField();
  await act(async () => {
    setNativeValue(input, text);
    if (input._valueTracker) input._valueTracker.setValue("previous");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("keyup", { bubbles: true }));
  });
}

async function settleMotion() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

test("pointer rating animates and a keyboard choice fills the segment and opens details", async () => {
  const pointer = await mount();
  try {
    await act(async () => {
      segment(4).click();
    });
    assert.equal(segment(4).getAttribute("aria-checked"), "true");
    assert.notEqual(fillOf(4).style.transform, "scaleX(1)");
    assert.equal(document.querySelector(".guide-feedback-ask").textContent, "What worked well? (optional)");
  } finally {
    await pointer.unmount();
  }

  const keys = await mount();
  try {
    await act(async () => {
      pressKey(segment(1), "ArrowRight");
    });
    assert.equal(segment(2).getAttribute("aria-checked"), "true");
    assert.equal(fillOf(2).style.transform, "scaleX(1)");
    assert.equal(fillOf(1).style.transform, "scaleX(1)");
    assert.equal(document.querySelector(".guide-feedback-ask").textContent, "What got in the way? (optional)");
    assert.equal(buttonNamed("Add a comment").textContent, "Add a comment");
  } finally {
    await keys.unmount();
  }
});

test("the scale word is hidden and each radio name includes its word", async () => {
  const view = await mount();
  try {
    const word = document.querySelector(".guide-feedback-word");
    assert.equal(word.getAttribute("aria-hidden"), "true");
    assert.equal(word.textContent.includes("Okay"), true);
    assert.equal(segment(3).getAttribute("aria-label"), "3 of 5, Okay");
    assert.equal(segment(1).getAttribute("aria-label"), "1 of 5, Confusing");
    assert.equal(segment(5).getAttribute("aria-label"), "5 of 5, Crystal clear");
  } finally {
    await view.unmount();
  }
});

test("a comment over 280 stays quiet until blur or send, then clears at 280", async () => {
  const view = await mount();
  try {
    await chooseRating(3);
    await act(async () => {
      buttonNamed("Add a comment").click();
    });
    const over = "x".repeat(281);
    await typeComment(over);
    const count = document.querySelector(".guide-feedback-count");
    const send = buttonNamed("Submit");
    assert.equal(count.textContent, "281/280 · 1 over");
    assert.equal(count.classList.contains("is-over"), false);
    assert.equal(send.getAttribute("aria-disabled"), "true");
    assert.equal(send.hasAttribute("disabled"), false);
    assert.equal(document.querySelector(".guide-feedback-error").textContent, "");
    assert.equal(field().getAttribute("aria-invalid"), null);

    await act(async () => {
      field().dispatchEvent(new window.Event("focusout", { bubbles: true }));
    });
    assert.equal(document.querySelector(".guide-feedback-error").textContent, "Too long to send");
    assert.equal(field().getAttribute("aria-invalid"), "true");
    assert.equal(count.classList.contains("is-over"), true);
    assert.equal(document.activeElement, field());

    await typeComment("x".repeat(280));
    assert.equal(document.querySelector(".guide-feedback-error").textContent, "");
    assert.equal(field().getAttribute("aria-invalid"), null);
    assert.equal(count.classList.contains("is-over"), false);
    assert.equal(count.textContent, "280/280");
    assert.equal(send.getAttribute("aria-disabled"), null);
  } finally {
    await view.unmount();
  }
});

test("Command or Control and Enter submits once", async () => {
  const control = await mount();
  try {
    await chooseRating(5);
    await focusField();
    await act(async () => {
      pressKey(field(), "Enter", { ctrlKey: true });
    });
    assert.equal(document.querySelectorAll(".guide-feedback-receipt").length, 1);
    const send = buttonNamed("Submit");
    await act(async () => {
      send.click();
      send.click();
    });
    assert.equal(document.querySelectorAll(".guide-feedback-receipt").length, 1);
  } finally {
    await control.unmount();
  }

  const command = await mount();
  try {
    await chooseRating(2);
    await focusField();
    await act(async () => {
      pressKey(field(), "Enter", { metaKey: true });
    });
    assert.equal(document.querySelectorAll(".guide-feedback-receipt").length, 1);
  } finally {
    await command.unmount();
  }
});

test("submit lands on a receipt with the summary, the live sentence, and the receipt height", async () => {
  const view = await mount();
  try {
    await chooseRating(4);
    await act(async () => {
      buttonNamed("Clear steps").click();
      buttonNamed("Add a comment").click();
    });
    await typeComment("Noted");
    await act(async () => {
      buttonNamed("Submit").click();
    });
    await settleMotion();
    const receipt = document.querySelector(".guide-feedback-receipt");
    const summary = receipt.querySelector("small");
    const token = getComputedStyle(document.documentElement).getPropertyValue("--size-receipt").trim();
    assert.equal(receipt.getAttribute("role"), "group");
    assert.equal(receipt.getAttribute("aria-label"), "Feedback sent");
    assert.equal(summary.textContent, "4/5 · Clear steps · with comment");
    assert.equal(summary.getAttribute("title"), "4/5 · Clear steps · with comment");
    assert.equal(
      document.querySelector(".guide-feedback-live").textContent,
      "Thanks for rating. 4/5, Clear steps, with comment. Edit is available for 6 seconds.",
    );
    assert.equal(document.querySelector(".guide-feedback").style.height, token);
  } finally {
    await view.unmount();
  }
});

test("a rating with no chips uses the rating word in the summary", async () => {
  const view = await mount();
  try {
    await chooseRating(4);
    await act(async () => {
      buttonNamed("Submit").click();
    });
    await settleMotion();
    assert.equal(document.querySelector(".guide-feedback-receipt small").textContent, "4/5 · Clear");
    assert.equal(
      document.querySelector(".guide-feedback-live").textContent,
      "Thanks for rating. 4/5, Clear. Edit is available for 6 seconds.",
    );
  } finally {
    await view.unmount();
  }
});

test("Edit restores the rating, chips, and comment and focuses Submit", async () => {
  const view = await mount();
  try {
    await chooseRating(4);
    await act(async () => {
      buttonNamed("Clear steps").click();
      buttonNamed("Good examples").click();
      buttonNamed("Add a comment").click();
    });
    await typeComment("Noted");
    await act(async () => {
      buttonNamed("Submit").click();
    });
    await act(async () => {
      buttonNamed("Edit").click();
    });
    assert.equal(segment(4).getAttribute("aria-checked"), "true");
    assert.equal(buttonNamed("Clear steps").getAttribute("aria-pressed"), "true");
    assert.equal(buttonNamed("Good examples").getAttribute("aria-pressed"), "true");
    assert.equal(field().value, "Noted");
    assert.equal(document.activeElement, buttonNamed("Submit"));
    assert.equal(document.querySelector(".guide-feedback-receipt"), null);
  } finally {
    await view.unmount();
  }
});

test("Cancel and Escape return to the plain scale, and Escape keeps a comment", async () => {
  const view = await mount();
  try {
    await chooseRating(2);
    await act(async () => {
      buttonNamed("Cancel").click();
    });
    assert.equal(document.querySelector(".guide-feedback-ask"), null);
    assert.equal(segment(2).getAttribute("aria-checked"), "false");
    assert.equal([...document.querySelectorAll("[role='radio']")].every((item) => item.getAttribute("aria-checked") === "false"), true);

    await chooseRating(3);
    await act(async () => {
      pressKey(segment(3), "Escape");
    });
    assert.equal(document.querySelector(".guide-feedback-ask"), null);
    assert.equal(segment(3).getAttribute("aria-checked"), "false");

    await chooseRating(5);
    await act(async () => {
      buttonNamed("Add a comment").click();
    });
    await typeComment("Keep this");
    await act(async () => {
      pressKey(field(), "Escape");
    });
    assert.equal(document.querySelector(".guide-feedback-ask").textContent, "What worked well? (optional)");
    assert.equal(field().value, "Keep this");
    assert.equal(segment(5).getAttribute("aria-checked"), "true");
  } finally {
    await view.unmount();
  }
});

function KeptCard() {
  const [value, setValue] = useState(initialFeedback);
  const [generation, setGeneration] = useState(0);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", className: "remount", onClick: () => setGeneration((next) => next + 1) },
      "Remount",
    ),
    createElement(GuideFeedback, { key: generation, value, onChange: setValue }),
  );
}

test("remounting keeps the sent receipt collapsed", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(KeptCard));
  });
  try {
    await chooseRating(4);
    await act(async () => {
      buttonNamed("Clear steps").click();
      buttonNamed("Submit").click();
    });
    await settleMotion();
    assert.equal(document.querySelector(".guide-feedback-receipt small").textContent, "4/5 · Clear steps");
    await act(async () => {
      document.querySelector(".remount").click();
    });
    const card = document.querySelector(".guide-feedback");
    const token = getComputedStyle(document.documentElement).getPropertyValue("--size-receipt").trim();
    assert.equal(card.style.height, token);
    assert.equal(document.querySelector(".guide-feedback-receipt small").textContent, "4/5 · Clear steps");
    assert.equal(buttonNamed("Edit").textContent, "Edit");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
