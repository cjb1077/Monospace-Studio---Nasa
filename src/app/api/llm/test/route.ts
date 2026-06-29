/**
 * src/app/api/llm/test/route.ts
 *
 * GET /api/llm/test
 *
 * Smoke-test endpoint. Returns:
 *  - The resolved LLM provider config (no secrets)
 *  - Whether a basic round-trip chat completion succeeded
 *
 * Use this from the browser to confirm the LLM layer is wired correctly
 * before relying on Features 1 and 2.
 */

import { NextResponse } from "next/server";
import { getLlmConfig } from "@/lib/llm/config";
import { createChatCompletion } from "@/lib/llm/chat";

export async function GET(): Promise<NextResponse> {
  // Resolve config first — fail fast if env vars are missing
  let config: ReturnType<typeof getLlmConfig>;
  try {
    config = getLlmConfig();
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        step: "config",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // Attempt a minimal round-trip chat completion
  let completionText = "";
  let usage: Record<string, number> | undefined;
  let resolvedModel = config.model;

  try {
    const result = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: "You are a terse assistant. Reply with exactly one word.",
        },
        { role: "user", content: "Say: pong" },
      ],
      temperature: 0,
      maxTokens: 10,
    });
    completionText = result.text;
    resolvedModel = result.meta.model;
    usage = result.meta.usage;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        step: "completion",
        config: {
          provider: config.provider,
          baseURL: config.baseURL,
          model: config.model,
          // Never expose the API key
        },
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    config: {
      provider: config.provider,
      baseURL: config.baseURL,
      model: resolvedModel,
    },
    completion: completionText,
    usage,
  });
}
