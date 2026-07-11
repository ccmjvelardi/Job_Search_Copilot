import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const CLAUDE_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function anthropic() {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

interface ClaudeJsonParams {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: JsonSchema;
  maxTokens?: number;
}

/**
 * Gets structured JSON out of Claude via forced tool use instead of asking
 * it to emit JSON as prose text. This is more reliable than parsing a text
 * block: the API guarantees `tool_use.input` matches the schema, so there's
 * no markdown-fence stripping, no stray-text trimming, and no risk of
 * invalid tokens (e.g. a bare `undefined`) breaking JSON.parse.
 */
export async function claudeJson<T>({
  system,
  prompt,
  toolName,
  toolDescription,
  schema,
  maxTokens = 4096,
}: ClaudeJsonParams): Promise<T> {
  const message = await anthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: schema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  const toolUse = message.content.find(
    (block) => block.type === "tool_use" && block.name === toolName,
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured result");
  }

  return toolUse.input as T;
}
