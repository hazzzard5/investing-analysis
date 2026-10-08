import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

export const MODEL = () => process.env.AGENT_MODEL ?? "claude-sonnet-5-5";

export async function ask(system: string, user: string, maxTokens = 2000): Promise<string> {
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
