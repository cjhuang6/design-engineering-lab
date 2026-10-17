import { isAbsolute, join, resolve } from "node:path";

const READ_ONLY = /^\s*(?:cat|head|tail|less|wc|ls|rg|grep|git (?:add|diff|log|show|status|blame))\b/;
const CHAINING = /[>;&|`]|\$\(/;

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

function respond(result) {
  process.stdout.write(JSON.stringify(result));
}

if (input.hook_event_name === "beforeShellExecution") {
  const command = (input.command ?? "").replace(/^\s*cd\s+[^;&|`$]+&&\s*/, "");
  const readOnly = READ_ONLY.test(command) && !CHAINING.test(command) && !/--output/.test(command);
  if (!/agents\.md/i.test(command) || readOnly) {
    respond({ permission: "allow" });
  } else {
    respond({
      permission: "deny",
      user_message: "Blocked an agent shell command that could change AGENTS.md. Run it yourself if you've approved the change.",
      agent_message: "AGENTS.md is protected. Show CJ the exact diff and reason; CJ applies approved changes.",
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
