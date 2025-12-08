import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIProvider } from "@ai-sdk/openai";

// Function to get AI provider - creates it dynamically to ensure env vars are available
export function getAIProvider(): OpenAIProvider {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (openRouterApiKey) {
    // Use OpenRouter
    return createOpenAI({
      apiKey: openRouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  } else if (openAIApiKey) {
    // Use standard OpenAI
    return createOpenAI({
      apiKey: openAIApiKey,
    });
  } else {
    // Fallback - will throw error if used without API key
    throw new Error(
      "No AI API key found. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in your environment variables."
    );
  }
}

