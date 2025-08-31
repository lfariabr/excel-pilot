// src/services/openai.ts
import OpenAI from "openai";
import briefing from "../data/briefing.json";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// micro cache for the big briefing
let cachedBriefing: string | null = null;
function systemPrompt(): string {
  cachedBriefing ??= JSON.stringify(briefing, null, 2);
  return `You are Excel's BM Concierge Personal Assistant.
Follow these rules and only answer using this knowledge base (respond in Markdown, concise sections/bullets):

${cachedBriefing}`;
}

/**
 * One-shot chat using Responses API.
 * Pass prior chat turns as { role: 'user'|'assistant'|'system', content: string }.
 */
export async function askOpenAI({
  history = [],
  userMessage,
  model = "gpt-4o-mini",           // fast+cheap default
  temperature = 0.5,
  maxOutputTokens = 600,
}: {
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  const input = [...history, { role: "user", content: userMessage }];

  const res = await openai.responses.create({
    model,
    instructions: systemPrompt(),   // same idea as your getSystemPrompt()
    input: userMessage,                          // multi-turn: array of role/content items
    temperature,
    // Responses API uses max_output_tokens (not max_tokens)
    max_output_tokens: maxOutputTokens,
  });

  return {
    text: res.output_text ?? "",
    usage: res.usage ?? null,       // input/output/total tokens if present
    model: (res as any).model ?? model,
  };
}

export default openai;
