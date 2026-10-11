import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";

let client: Anthropic | undefined;

export const MODEL = () => process.env.AGENT_MODEL ?? "claude-sonnet-5-5";

/**
 * LLM_BACKEND=cli uses the `claude` command-line tool (your Claude login, no API key).
 * LLM_BACKEND=api uses ANTHROPIC_API_KEY. Default: api if a key is set, otherwise cli.
 */
const backend = () => process.env.LLM_BACKEND ?? (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "api" : "cli");

function askCli(system: string, user: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--model", MODEL(), "--tools", "", "--no-session-persistence", "--system-prompt", system];
    const p = spawn(process.env.CLAUDE_BIN ?? "claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`Could not run the claude command (${e.message}). Install Claude Code and run \`claude\` once to log in, or set ANTHROPIC_API_KEY.`)));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 500)}`))));
    p.stdin.end(user);
  });
}

export async function ask(system: string, user: string, maxTokens = 2000): Promise<string> {
  if (backend() === "cli") return askCli(system, user);
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const res = await client.messages.create({
    model: MODEL(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** Pull the first JSON object out of a model reply. */
export function extractJson<T = any>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model reply contained no JSON object");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function askJson<T = any>(system: string, user: string, maxTokens = 2000): Promise<T> {
  const text = await ask(system + "\n\nReply with a single JSON object and nothing else.", user, maxTokens);
  try {
    return extractJson<T>(text);
  } catch {
    // one retry: models occasionally wrap or truncate
    return extractJson<T>(await ask(system + "\n\nReply with a single valid JSON object and nothing else.", user, maxTokens));
  }
}
