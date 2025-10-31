// src/services/openai.ts
import OpenAI from "openai";
import briefing from "../data/briefing.json";
import { GraphQLError } from "graphql";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Cache system prompt
let cachedSystemPrompt: string | null = null;
export function getSystemPrompt(): string {
  if(!cachedSystemPrompt){
    const briefingText = JSON.stringify(briefing, null, 2);
    cachedSystemPrompt = `You are Excel's BM Concierge Personal Assistant.
Follow these rules and only answer using this knowledge base (respond in Markdown, concise sections/bullets):

${briefingText}`;
  }
  return cachedSystemPrompt;
}

/**
 * Chat with OpenAI using Responses API using this doc:
 * https://platform.openai.com/docs/guides/migrate-to-responses?update-item-definitions=responses&update-multiturn=chat-completions#about-the-responses-api
 */

export async function askOpenAI({
  history = [],
  userMessage,
  model = "gpt-4o-mini",
  temperature = 0.7,
  maxOutputTokens = 600,
}: {
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  try {
    // Build contextual instructions from history
    let contextualInstructions = getSystemPrompt();

    if (history.length > 0) {
      const conversationContext = history.reverse()
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");
      
      contextualInstructions += "\n\nPrevious conversation:\n" + conversationContext;
    }

    const response = await openai.responses.create({
      model,
      instructions: contextualInstructions,
      input: userMessage,
      temperature,
      max_output_tokens: maxOutputTokens,
    });
    
    return {
      text: response.output_text ?? "",
      usage: response.usage ? {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      } : null,
      model: response.model ?? model,
      finishReason: (response as any).finish_reason,
    };

  } catch (error) {
    console.error("OpenAI Responses API error:", error);
    throw new GraphQLError("Failed to get response from OpenAI", {
      extensions: {
        code: "OPENAI_ERROR",
        originalError: error instanceof Error ? error.message : "Unknown error",
      }
    });
  }
}

export default openai;
