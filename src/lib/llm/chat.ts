/**
 * src/lib/llm/chat.ts
 *
 * Core chat helpers:
 *  - createChatCompletion  — general text completion
 *  - createJsonCompletion  — structured JSON output (used by both AI features)
 *
 * Built-in behavior:
 *  - JSON mode via response_format: { type: "json_object" }
 *  - Up to 3 attempts with exponential backoff on 429 / 502 / 503
 *  - Typed error variants: EMPTY_RESPONSE, REASONING_ONLY, INVALID_JSON, LLM_DOWN
 */

import type OpenAI from "openai";
import { getLlmClient } from "./client";
import { getLlmConfig } from "./config";

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export type LlmErrorCode =
  | "EMPTY_RESPONSE"
  | "REASONING_ONLY"
  | "INVALID_JSON"
  | "LLM_DOWN"
  | "TIMEOUT"
  | "RATE_LIMITED";

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LlmError";
  }
}

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  meta: {
    model: string;
    provider: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
}

export interface JsonResult<T> {
  data: T;
  meta: ChatResult["meta"];
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS = new Set([429, 502, 503]);
const MAX_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      // Retry on OpenAI SDK HTTP errors with retryable status codes
      const status = (err as { status?: number })?.status;
      if (status !== undefined && RETRYABLE_STATUS.has(status)) {
        const wait = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
        await delay(wait);
        continue;
      }
      // Non-retryable — rethrow immediately
      throw err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// createChatCompletion — general text
// ---------------------------------------------------------------------------

export async function createChatCompletion(
  options: ChatOptions
): Promise<ChatResult> {
  const { messages, temperature = 0.3, maxTokens = 800 } = options;
  const { model, provider } = getLlmConfig();
  const client = getLlmClient();

  const raw = await withRetry(() =>
    client.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    })
  );

  const choice = raw.choices[0];
  const text = choice?.message?.content ?? "";

  // Detect thinking models that return empty content
  const reasoningContent = (choice?.message as unknown as Record<string, unknown>)
    ?.reasoning_content as string | undefined;

  if (!text && reasoningContent) {
    throw new LlmError(
      "REASONING_ONLY",
      "The model returned only reasoning_content and no content. " +
        "Switch to an instruct model (not a thinking model)."
    );
  }

  if (!text) {
    throw new LlmError("EMPTY_RESPONSE", "LLM returned an empty response.");
  }

  return {
    text,
    meta: {
      model: raw.model,
      provider,
      usage: raw.usage
        ? {
            prompt_tokens: raw.usage.prompt_tokens,
            completion_tokens: raw.usage.completion_tokens,
            total_tokens: raw.usage.total_tokens,
          }
        : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// createJsonCompletion — structured JSON output
// ---------------------------------------------------------------------------

export async function createJsonCompletion<T>(
  options: ChatOptions
): Promise<JsonResult<T>> {
  const { messages, temperature = 0.2, maxTokens = 600 } = options;
  const { model, provider } = getLlmConfig();
  const client = getLlmClient();

  let rawText = "";
  let meta: ChatResult["meta"] = { model, provider };

  const attemptCompletion = async (): Promise<string> => {
    const raw = await withRetry(() =>
      client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      })
    );

    const choice = raw.choices[0];
    const text = choice?.message?.content ?? "";
    const reasoningContent = (choice?.message as unknown as Record<string, unknown>)
      ?.reasoning_content as string | undefined;

    if (!text && reasoningContent) {
      throw new LlmError(
        "REASONING_ONLY",
        "Thinking model detected. Switch to an instruct model."
      );
    }
    if (!text) {
      throw new LlmError("EMPTY_RESPONSE", "LLM returned an empty response.");
    }

    meta = {
      model: raw.model,
      provider,
      usage: raw.usage
        ? {
            prompt_tokens: raw.usage.prompt_tokens,
            completion_tokens: raw.usage.completion_tokens,
            total_tokens: raw.usage.total_tokens,
          }
        : undefined,
    };

    return text;
  };

  // Attempt 1
  try {
    rawText = await attemptCompletion();
  } catch (err) {
    if (
      err instanceof LlmError &&
      (err.code === "EMPTY_RESPONSE" || err.code === "REASONING_ONLY")
    ) {
      throw err; // Non-retryable LLM structural errors
    }
    throw new LlmError("LLM_DOWN", "LLM request failed.", err);
  }

  // Parse — retry once on bad JSON
  const parseJson = (text: string): T => {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new LlmError("INVALID_JSON", `Failed to parse LLM JSON: ${text}`);
    }
  };

  try {
    return { data: parseJson(rawText), meta };
  } catch (firstErr) {
    if (!(firstErr instanceof LlmError && firstErr.code === "INVALID_JSON")) {
      throw firstErr;
    }
    // Retry once
    try {
      rawText = await attemptCompletion();
      return { data: parseJson(rawText), meta };
    } catch {
      throw firstErr; // Surface the original parse error
    }
  }
}
