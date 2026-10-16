/**
 * src/lib/llm/config.ts
 *
 * Reads LLM_PROVIDER from the environment and resolves the correct
 * API key, base URL, and model for the configured provider.
 *
 * Supported providers (switch via LLM_PROVIDER env var only):
 *  - openai-compatible  →  LM Studio / Ollama (local dev default)
 *  - trussed            →  FAU Trussed proxy  (demo / deploy)
 *  - openai             →  Direct OpenAI
 *  - anthropic          →  Claude via Anthropic's OpenAI-compatible endpoint
 */

export interface LlmConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  provider: string;
}

export function getLlmConfig(): LlmConfig {
  const provider = process.env.LLM_PROVIDER ?? "openai-compatible";
  const model = process.env.LLM_MODEL ?? "qwen/qwen2.5-27b-instruct";

  switch (provider) {
    case "trussed": {
      const apiKey = process.env.TRUSSED_API_KEY;
      const baseURL = process.env.TRUSSED_BASE_URL;
      if (!apiKey) {
        throw new Error(
          "LLM config error: TRUSSED_API_KEY is not set. " +
            "Add it to .env.local and restart the dev server."
        );
      }
      if (!baseURL) {
        throw new Error(
          "LLM config error: TRUSSED_BASE_URL is not set. " +
            "Add it to .env.local and restart the dev server."
        );
      }
      return { apiKey, baseURL, model, provider };
    }

    case "anthropic": {
      // Uses Anthropic's OpenAI-compatible endpoint, so the `openai` client
      // is reused unchanged.
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const baseURL =
        process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1/";
      if (!apiKey) {
        throw new Error(
          "LLM config error: ANTHROPIC_API_KEY is not set. " +
            "Add it to .env.local and restart the dev server."
        );
      }
      return {
        apiKey,
        baseURL,
        model: process.env.LLM_MODEL ?? "claude-haiku-5-5",
        provider,
      };
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      if (!apiKey) {
        throw new Error(
          "LLM config error: OPENAI_API_KEY is not set. " +
            "Add it to .env.local and restart the dev server."
        );
      }
      return { apiKey, baseURL, model, provider };
    }

    case "openai-compatible":
    default: {
      const apiKey = process.env.OPENAI_API_KEY ?? "lm-studio";
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "http://localhost:1234/v1";
      return { apiKey, baseURL, model, provider };
    }
  }
}
