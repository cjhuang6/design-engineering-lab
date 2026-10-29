import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".sh",
]);

const GENERATED = new Set(["src/styles/tokens.css"]);
const GENERATED_MARK = "Do not edit directly, this file was auto-generated.";
const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
]);

const EXPR_BEFORE = new Set([
  "return",
  "throw",
  "case",
  "typeof",
  "delete",
  "void",
  "in",
  "of",
  "instanceof",
  "await",
  "yield",
  "new",
  "else",
  "do",
]);

const DIRECTIVE =
  /^(?:#\s*)?(?:eslint-disable|eslint-enable|@ts-expect-error|prettier-ignore|istanbul\s+ignore|c8\s+ignore|stylelint-disable|sourceMappingURL)\b/;

const FIX =
  "Remove the comment and make the code say it (a clearer name, a named constant, a test). If it's a legal notice, a tooling directive, or an outside constraint the code can't show, use the allowed form: `external: <the outside thing>`.";

const EXTERNAL_HEADING = "External-constraint comments for CJ to review";

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : "";
    console.error(stderr || error.message);
    process.exit(1);
  }
}

function extensionOf(path) {
  const slash = path.lastIndexOf("/");
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

function unescapeGitPath(path) {
  let out = "";
  for (let i = 0; i < path.length; i += 1) {
    if (path[i] !== "\\" || i + 1 >= path.length) {
      out += path[i];
      continue;
    }
    const next = path[i + 1];
    if (next >= "0" && next <= "7") {
      let oct = next;
      let j = i + 2;
      while (j < path.length && j < i + 4 && path[j] >= "0" && path[j] <= "7") {
        oct += path[j];
        j += 1;
      }
      out += String.fromCharCode(Number.parseInt(oct, 8));
      i = j - 1;
      continue;
    }
    out += next;
    i += 1;
  }
  return out;
}

function cleanPath(raw) {
  let path = raw.trim();
  if (path.startsWith('"') && path.endsWith('"')) path = unescapeGitPath(path.slice(1, -1));
  if (path.startsWith("b/") || path.startsWith("a/")) path = path.slice(2);
  return path;
}

function skipped(path) {
  const parts = path.split("/");
  if (parts.includes("node_modules") || parts.includes("dist")) return true;
  const name = parts[parts.length - 1];
  if (LOCKFILES.has(name)) return true;
  if (path.endsWith(".json")) return true;
  if (GENERATED.has(path)) return true;
  return !SOURCE_EXT.has(extensionOf(path));
}

function addedStart(line) {
  if (!line.startsWith("@@ ")) return null;
  const plus = line.indexOf(" +");
  if (plus < 0) return null;
  let i = plus + 2;
  let num = "";
  while (i < line.length && line[i] >= "0" && line[i] <= "9") {
    num += line[i];
    i += 1;
  }
  return num ? Number(num) : null;
}

function lineChanges(base) {
  const diff = git([
    "diff",
    "--unified=0",
    "--no-color",
    "--no-ext-diff",
    `${base}...HEAD`,
  ]);
  const files = new Map();
  let path = null;
  let newLine = 0;
  let inHunk = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      path = null;
      inHunk = false;
      continue;
    }
    if (!inHunk && line.startsWith("+++ ")) {
      path = null;
      const cleaned = cleanPath(line.slice(4));
      if (cleaned === "/dev/null" || skipped(cleaned)) continue;
      path = cleaned;
      if (!files.has(path)) files.set(path, { added: new Set(), removed: [] });
      continue;
    }
    if (!path) continue;
    const start = addedStart(line);
    if (start != null) {
      newLine = start;
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) {
      files.get(path).added.add(newLine);
      newLine += 1;
    } else if (line.startsWith("-")) {
      files.get(path).removed.push(line.slice(1));
    } else if (line.startsWith("\\")) {
      continue;
    } else {
      newLine += 1;
    }
  }
  return files;
}

function carriedForward(comment, removed) {
  const text = comment.raw.trim();
  if (!text || text.includes("\n")) return false;
  return removed.some((line) => {
    const at = line.indexOf(text);
    if (at < 0) return false;
    return line.slice(at + text.length).trim() === "";
  });
}

function isIdentStart(ch) {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_" || ch === "$";
}

function isIdentPart(ch) {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function scanJs(text) {
  const comments = [];
  let i = 0;
  let line = 1;

  function takeLine() {
    const startLine = line;
    const start = i;
    while (i < text.length && text[i] !== "\n") i += 1;
    comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
  }

  function takeBlock() {
    const startLine = line;
    const start = i;
    i += 2;
    while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
      if (text[i] === "\n") line += 1;
      i += 1;
    }
    if (i < text.length) i += 2;
    comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
  }

  function takeHtml() {
    const startLine = line;
    const start = i;
    i += 4;
    while (i < text.length && !(text[i] === "-" && text[i + 1] === "-" && text[i + 2] === ">")) {
      if (text[i] === "\n") line += 1;
      i += 1;
    }
    if (i < text.length) i += 3;
    comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
  }

  function scanCode(stopBrace) {
    let exprAllowed = true;
    let brace = 0;
    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === "\n") {
        line += 1;
        i += 1;
        continue;
      }
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\f") {
        i += 1;
        continue;
      }
      if (ch === "/" && next === "/" && text[i - 1] !== ":") {
        takeLine();
        continue;
      }
      if (ch === "/" && next === "*") {
        takeBlock();
        continue;
      }
      if (text.startsWith("<!--", i)) {
        takeLine();
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i += 1;
        while (i < text.length) {
          if (text[i] === "\\") {
            if (text[i + 1] === "\n") line += 1;
            i += 2;
            continue;
          }
          if (text[i] === "\n") break;
          if (text[i] === quote) {
            i += 1;
            break;
          }
          i += 1;
        }
        exprAllowed = false;
        continue;
      }
      if (ch === "`") {
        scanTemplate();
        exprAllowed = false;
        continue;
      }
      if (ch === "/" && next !== "/" && next !== "*") {
        if (!exprAllowed) {
          i += 1;
          if (next === "=") i += 1;
          exprAllowed = true;
          continue;
        }
        i += 1;
        let inClass = false;
        while (i < text.length && text[i] !== "\n") {
          if (text[i] === "\\") {
            i += 2;
            continue;
          }
          if (inClass) {
            if (text[i] === "]") inClass = false;
            i += 1;
            continue;
          }
          if (text[i] === "[") {
            inClass = true;
            i += 1;
            continue;
          }
          if (text[i] === "/") {
            i += 1;
            break;
          }
          i += 1;
        }
        while (i < text.length && ((text[i] >= "a" && text[i] <= "z") || (text[i] >= "A" && text[i] <= "Z"))) {
          i += 1;
        }
        exprAllowed = false;
        continue;
      }
      if (isDigit(ch) || (ch === "." && isDigit(next))) {
        i += 1;
        while (
          i < text.length &&
          (isDigit(text[i]) ||
            text[i] === "." ||
            text[i] === "_" ||
            text[i] === "n" ||
            text[i] === "x" ||
            text[i] === "X" ||
            text[i] === "b" ||
            text[i] === "B" ||
            text[i] === "o" ||
            text[i] === "O" ||
            (text[i] >= "a" && text[i] <= "f") ||
            (text[i] >= "A" && text[i] <= "F"))
        ) {
          i += 1;
        }
        exprAllowed = false;
        continue;
      }
      if (ch === "." && next === "." && text[i + 2] === ".") {
        i += 3;
        exprAllowed = true;
        continue;
      }
      if (ch === ".") {
        i += 1;
        exprAllowed = false;
        continue;
      }
      if (isIdentStart(ch)) {
        const start = i;
        i += 1;
        while (i < text.length && isIdentPart(text[i])) i += 1;
        exprAllowed = EXPR_BEFORE.has(text.slice(start, i));
        continue;
      }
      if (ch === "#") {
        i += 1;
        while (i < text.length && isIdentPart(text[i])) i += 1;
        exprAllowed = false;
        continue;
      }
      if (ch === "(" || ch === "[") {
        i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "{") {
        brace += 1;
        i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === ")") {
        i += 1;
        exprAllowed = false;
        continue;
      }
      if (ch === "]") {
        i += 1;
        exprAllowed = false;
        continue;
      }
      if (ch === "}") {
        if (brace === 0 && stopBrace) {
          i += 1;
          return;
        }
        if (brace > 0) brace -= 1;
        i += 1;
        exprAllowed = false;
        continue;
      }
      if (ch === "=") {
        if (next === ">") {
          i += 2;
          exprAllowed = true;
          continue;
        }
        i += 1;
        while (i < text.length && text[i] === "=") i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "!") {
        i += 1;
        while (i < text.length && text[i] === "=") i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "&") {
        i += 1;
        if (text[i] === "&" || text[i] === "=") i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "|") {
        i += 1;
        if (text[i] === "|" || text[i] === "=") i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "?") {
        if (next === ".") {
          i += 2;
          exprAllowed = false;
          continue;
        }
        if (next === "?") {
          i += 2;
          exprAllowed = true;
          continue;
        }
        i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "+" || ch === "-") {
        if (next === ch) {
          i += 2;
          continue;
        }
        i += 1;
        exprAllowed = true;
        continue;
      }
      if (ch === "*" || ch === "%" || ch === "^" || ch === "~" || ch === "<" || ch === ">" || ch === "," || ch === ";" || ch === ":") {
        i += 1;
        if ((ch === "*" || ch === "%" || ch === "^" || ch === "<" || ch === ">") && (text[i] === "=" || text[i] === ch)) i += 1;
        exprAllowed = true;
        continue;
      }
      i += 1;
    }
  }

  function scanTemplate() {
    i += 1;
    while (i < text.length) {
      if (text[i] === "\\") {
        if (text[i + 1] === "\n") line += 1;
        i += 2;
        continue;
      }
      if (text[i] === "\n") {
        line += 1;
        i += 1;
        continue;
      }
      if (text[i] === "`") {
        i += 1;
        return;
      }
      if (text[i] === "$" && text[i + 1] === "{") {
        i += 2;
        scanCode(true);
        continue;
      }
      i += 1;
    }
  }

  scanCode(false);
  return comments;
}

function scanQuoted(text, i, line) {
  const quote = text[i];
  i += 1;
  while (i < text.length) {
    if (text[i] === "\\") {
      if (text[i + 1] === "\n") line += 1;
      i += 2;
      continue;
    }
    if (text[i] === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (text[i] === quote) {
      i += 1;
      break;
    }
    i += 1;
  }
  return { i, line };
}

function scanStyle(text) {
  const comments = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quoted = scanQuoted(text, i, line);
      i = quoted.i;
      line = quoted.line;
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const startLine = line;
      const start = i;
      i += 4;
      while (i < text.length && !(text[i] === "-" && text[i + 1] === "-" && text[i + 2] === ">")) {
        if (text[i] === "\n") line += 1;
        i += 1;
      }
      if (i < text.length) i += 3;
      comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
      continue;
    }
    if (ch === "/" && next === "*") {
      const startLine = line;
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") line += 1;
        i += 1;
      }
      if (i < text.length) i += 2;
      comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
      continue;
    }
    if (ch === "/" && next === "/" && text[i - 1] !== ":") {
      const startLine = line;
      const start = i;
      while (i < text.length && text[i] !== "\n") i += 1;
      comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
      continue;
    }
    i += 1;
  }
  return comments;
}

function hashWordStart(text, i) {
  if (i === 0) return true;
  const prev = text[i - 1];
  if (prev === "$" || prev === "{") return false;
  return prev === " " || prev === "\t" || prev === "\n" || prev === "\r" || prev === ";" || prev === "|" || prev === "&" || prev === "(";
}

function scanHash(text) {
  const comments = [];
  let i = 0;
  let line = 1;
  let mode = "code";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (mode === "sq") {
      if (ch === "'") mode = "code";
      i += 1;
      continue;
    }
    if (mode === "dq") {
      if (ch === "\\") {
        if (text[i + 1] === "\n") line += 1;
        i += 2;
        continue;
      }
      if (ch === '"') mode = "code";
      i += 1;
      continue;
    }
    if (ch === "'") {
      mode = "sq";
      i += 1;
      continue;
    }
    if (ch === '"') {
      mode = "dq";
      i += 1;
      continue;
    }
    if (ch === "#" && line === 1 && i === 0 && text[1] === "!") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "#" && hashWordStart(text, i)) {
      const startLine = line;
      const start = i;
      while (i < text.length && text[i] !== "\n") i += 1;
      comments.push({ startLine, endLine: line, raw: text.slice(start, i) });
      continue;
    }
    i += 1;
  }
  return comments;
}

function kindOf(path) {
  const ext = extensionOf(path);
  if (ext === ".css") return "css";
  if (ext === ".html") return "html";
  if (ext === ".yml" || ext === ".yaml") return "hash";
  if (ext === ".sh") return "hash";
  return "js";
}

function commentsIn(text, path) {
  const kind = kindOf(path);
  if (kind === "css" || kind === "html") return scanStyle(text);
  if (kind === "hash") return scanHash(text);
  return scanJs(text);
}

function commentBody(raw) {
  let text = raw.trim();
  if (text.startsWith("<!--")) text = text.slice(4);
  else if (text.startsWith("//")) text = text.slice(2);
  else if (text.startsWith("/*")) text = text.slice(2);
  else if (text.startsWith("#")) text = text.slice(1);
  text = text.trim();
  if (text.endsWith("-->")) text = text.slice(0, -3);
  else if (text.endsWith("*/")) text = text.slice(0, -2);
  const lines = text.split("\n").map((line) => {
    let part = line.trim();
    if (part.startsWith("*")) part = part.slice(1).trim();
    return part;
  });
  return lines.join("\n").trim();
}

function isLegal(raw) {
  return raw.includes("License") || raw.includes("SPDX-License-Identifier") || raw.includes("Copyright");
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".js") || entry.name.endsWith(".cjs")) out.push(path);
  }
}

function stringLiterals(source) {
  const values = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i += 1;
      let value = "";
      let skip = false;
      while (i < source.length) {
        if (source[i] === "\\") {
          value += source[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
          skip = true;
          break;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        value += source[i];
        i += 1;
      }
      if (!skip && value.includes("PLACEHOLDER")) values.push(value);
      continue;
    }
    i += 1;
  }
  return values;
}

function markerNeedles() {
  const files = [];
  walk("scripts", files);
  walk("tests/guardrails", files);
  const needles = new Set();
  for (const file of files) {
    const rel = file.split("\\").join("/");
    if (rel.endsWith("scripts/guardrails/check-no-new-comments.mjs")) continue;
    if (rel.endsWith("tests/guardrails/no-new-comments.test.mjs")) continue;
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const reads =
      source.includes(".includes(") ||
      source.includes(".indexOf(") ||
      source.includes(".split(") ||
      source.includes(".search(") ||
      source.includes(".match(") ||
      source.includes(".matchAll(");
    if (!reads) continue;
    for (const value of stringLiterals(source)) needles.add(value);
  }
  return [...needles];
}

function classify(comment, needles) {
  const body = commentBody(comment.raw);
  if (body.startsWith("external:")) return "external";
  if (body.includes("@ts-ignore")) return "violation";
  if (DIRECTIVE.test(body)) return "allow";
  if (isLegal(comment.raw)) return "allow";
  if (needles.some((needle) => comment.raw.includes(needle))) return "allow";
  return "violation";
}

function readHead(path) {
  return git(["show", `HEAD:${path}`]);
}

function generated(path, content) {
  if (GENERATED.has(path)) return true;
  return content.slice(0, 400).includes(GENERATED_MARK);
}

function formatFinding(item) {
  return `${item.path}:${item.line}\n${item.text}`;
}

const base = process.argv[2] ?? "origin/main";
const files = lineChanges(base);
const needles = markerNeedles();
const violations = [];
const externals = [];

for (const [path, changes] of files) {
  if (changes.added.size === 0) continue;
  const content = readHead(path);
  if (content.includes("\0")) continue;
  if (generated(path, content)) continue;
  for (const comment of commentsIn(content, path)) {
    if (!changes.added.has(comment.startLine)) continue;
    if (carriedForward(comment, changes.removed)) continue;
    const kind = classify(comment, needles);
    if (kind === "allow") continue;
    const item = { path, line: comment.startLine, text: comment.raw.trim() };
    if (kind === "external") externals.push(item);
    else violations.push(item);
  }
}

const chunks = [];
if (violations.length) {
  chunks.push(violations.map(formatFinding).join("\n"));
  chunks.push(FIX);
}
if (externals.length) {
  chunks.push([EXTERNAL_HEADING, ...externals.map(formatFinding)].join("\n"));
}
if (chunks.length) console.log(chunks.join("\n"));

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary && externals.length) {
  appendFileSync(summary, `${[EXTERNAL_HEADING, ...externals.map(formatFinding)].join("\n")}\n`);
}

process.exitCode = violations.length ? 1 : 0;
