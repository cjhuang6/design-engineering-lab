import { isAbsolute, join, resolve } from "node:path";

const METACHARACTERS = /[;&|<>$`\\(){}\n\r]/;
const NUMBER = /^\d+$/;
const ANY = /^.*$/;

const SEARCH_VALUES = { "-A": NUMBER, "-B": NUMBER, "-C": NUMBER, "-m": NUMBER, "-e": ANY };
const SEARCH_LONG_VALUES = { "--context": NUMBER, "--max-count": NUMBER, "--regexp": ANY };

const READ_COMMANDS = {
  cat: { shortFlags: "n" },
  head: { values: { "-n": NUMBER, "-c": NUMBER } },
  tail: { values: { "-n": NUMBER, "-c": NUMBER } },
  wc: { shortFlags: "lwcm" },
  ls: { shortFlags: "lah1d" },
  rg: {
    shortFlags: "niSFwclxvHN",
    longFlags: ["--line-number", "--ignore-case", "--smart-case", "--fixed-strings", "--word-regexp", "--count",
      "--files-with-matches", "--invert-match", "--no-heading", "--with-filename", "--no-line-number"],
    values: SEARCH_VALUES,
    longValues: SEARCH_LONG_VALUES,
  },
  grep: {
    shortFlags: "niFEwclvHh",
    longFlags: ["--line-number", "--ignore-case", "--fixed-strings", "--extended-regexp", "--word-regexp", "--count",
      "--files-with-matches", "--invert-match", "--with-filename", "--no-filename"],
    values: SEARCH_VALUES,
    longValues: SEARCH_LONG_VALUES,
  },
};

const GIT_SUBCOMMANDS = {
  diff: {
    longFlags: ["--stat", "--shortstat", "--numstat", "--name-only", "--name-status", "--cached", "--staged",
      "--no-index", "--no-color", "--no-ext-diff", "--no-textconv", "--quiet", "--exit-code"],
  },
  log: {
    longFlags: ["--oneline", "--stat", "--name-only", "--name-status", "--no-color", "--follow", "--no-ext-diff",
      "--no-textconv"],
    numericShort: true,
    values: { "-n": NUMBER },
    longValues: { "--max-count": NUMBER, "--format": ANY, "--pretty": ANY },
  },
  show: {
    longFlags: ["--stat", "--name-only", "--name-status", "--no-color", "--no-ext-diff", "--no-textconv"],
    longValues: { "--format": ANY, "--pretty": ANY },
  },
  status: { shortFlags: "s", longFlags: ["--short", "--porcelain"] },
  blame: {},
  add: {},
};

const input = JSON.parse(await new Promise((done) => {
  let data = "";
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => done(data || "{}"));
}));

const root = input.workspace_roots?.[0] ?? process.cwd();
const target = join(root, "AGENTS.md").toLowerCase();

function targetsAgentsMd(toolInput = {}) {
  return Object.entries(toolInput)
    .filter(([key, value]) => /path|file/i.test(key) && typeof value === "string")
    .some(([, value]) => (isAbsolute(value) ? value : resolve(root, value)).toLowerCase() === target);
}

function tokenize(command) {
  const tokens = [];
  let current = "";
  let quote = null;
  let started = false;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) return null;
  if (started) tokens.push(current);
  return tokens;
}

function optionsAllowed(args, spec) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") return true;
    if (!arg.startsWith("-") || arg === "-") continue;
    if (spec.values?.[arg]) {
      i += 1;
      if (i >= args.length || !spec.values[arg].test(args[i])) return false;
      continue;
    }
    if (arg.startsWith("--")) {
      const [name, ...rest] = arg.split("=");
      if (rest.length === 0 && spec.longFlags?.includes(name)) continue;
      if (rest.length > 0 && spec.longValues?.[name]?.test(rest.join("="))) continue;
      return false;
    }
    if (spec.numericShort && /^-\d+$/.test(arg)) continue;
    if (spec.shortFlags && [...arg.slice(1)].every((flag) => spec.shortFlags.includes(flag))) continue;
    return false;
  }
  return true;
}

function isPermittedRead(command) {
  const rest = command.replace(/^\s*cd\s+[^\s;&|<>$`\\(){}'"]+\s*&&\s*/, "");
  if (METACHARACTERS.test(rest)) return false;
  const tokens = tokenize(rest);
  if (!tokens || tokens.length === 0) return false;
  const [program, ...args] = tokens;
  if (program === "git") {
    const [subcommand, ...subArgs] = args;
    const spec = GIT_SUBCOMMANDS[subcommand];
    return Boolean(spec) && optionsAllowed(subArgs, spec);
  }
  const spec = READ_COMMANDS[program];
  return Boolean(spec) && optionsAllowed(args, spec);
}

function respond(result) {
  process.stdout.write(JSON.stringify(result));
}

if (input.hook_event_name === "beforeShellExecution") {
  const command = input.command ?? "";
  if (!/agents\.md/i.test(command) || isPermittedRead(command)) {
    respond({ permission: "allow" });
  } else {
    respond({
      permission: "deny",
      user_message: "Blocked an agent shell command that could change AGENTS.md. Run it yourself if you've approved the change.",
      agent_message: "AGENTS.md is protected. Show CJ the exact diff and reason; CJ applies approved changes. Plain reads with common options are allowed.",
    });
  }
} else if (targetsAgentsMd(input.tool_input)) {
  respond({
    permission: "deny",
    user_message: "Blocked an agent edit to AGENTS.md. Edit it yourself, or approve a specific diff.",
    agent_message: "AGENTS.md is protected. Propose the exact diff and reason to CJ instead of editing it.",
  });
} else {
  respond({ permission: "allow" });
}
