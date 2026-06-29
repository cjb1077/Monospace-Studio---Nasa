/**
 * src/lib/llm/client.ts
 *
 * Cached OpenAI-compatible client instance.
 * One client per process, reused across all API requests.
 * Works with LM Studio, FAU Trussed, Ollama, and direct OpenAI.
 */

import OpenAI from "openai";
import { getLlmConfig } from "./config";

let _client: OpenAI | null = null;

export function getLlmClient(): OpenAI {
  if (_client) return _client;

  const { apiKey, baseURL } = getLlmConfig();
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}
